import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getFileBuffer } from "@/lib/s3"

interface RouteParams {
  params: Promise<{ key: string[] }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Verify authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { key } = await params

    const keyPracticeId = key[0]
    if (!keyPracticeId || keyPracticeId !== session.user.practiceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Join path segments — catch-all handles slashes in S3 keys natively
    const decodedKey = key.join("/")

    // Fetch file from S3
    const buffer = await getFileBuffer(decodedKey)

    // Determine content type from key extension
    const ext = decodedKey.split(".").pop()?.toLowerCase()
    const contentTypeMap: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      heic: "image/heic",
      tiff: "image/tiff",
      tif: "image/tiff",
    }
    const contentType = contentTypeMap[ext || ""] || "application/octet-stream"

    // Return file with appropriate headers
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        // Add CORS headers to allow client-side PDF libraries to fetch
        "Access-Control-Allow-Origin": process.env.NEXTAUTH_URL || "",
        "Access-Control-Allow-Methods": "GET",
      },
    })
  } catch (error) {
    console.error("File proxy error:", error)
    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500 }
    )
  }
}
