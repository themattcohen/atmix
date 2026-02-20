import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/s3";
import { validateFile, validateMagicBytes, normalizeMimeType, getFileExtension } from "@/lib/upload-validation";
import { extractFromStatement } from "@/lib/extraction";
import { mapExtractedAccounts } from "@/lib/extraction-mapper";
import { sanitizeFileName } from "@/lib/sanitize";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const filingYearId = formData.get("filingYearId") as string | null;

    if (!file || !filingYearId) {
      return NextResponse.json(
        { error: "file and filingYearId are required" },
        { status: 400 }
      );
    }

    // Validate file metadata
    const normalizedType = normalizeMimeType({ name: file.name, type: file.type });
    const validationError = validateFile({ name: file.name, type: file.type, size: file.size });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Verify filing year belongs to user and is premium tier
    const filingYear = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId: session.user.id },
    });

    if (!filingYear) {
      return NextResponse.json({ error: "Filing year not found" }, { status: 404 });
    }

    if (filingYear.tier !== "PREMIUM") {
      return NextResponse.json(
        { error: "Statement upload is only available for Premium tier filings" },
        { status: 403 }
      );
    }

    if (!["NOT_STARTED", "IN_PROGRESS"].includes(filingYear.status)) {
      return NextResponse.json(
        { error: "Cannot upload statements for a filing that has already been submitted" },
        { status: 400 }
      );
    }

    // Read file buffer and validate magic bytes
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytes(buffer, normalizedType)) {
      return NextResponse.json(
        { error: "File content does not match declared type. Possible file corruption or spoofing." },
        { status: 400 }
      );
    }

    // Upload to S3
    const ext = getFileExtension(file.name);
    const s3Key = `d2c/${session.user.id}/${filingYearId}/${randomUUID()}.${ext}`;
    await uploadFile(s3Key, buffer, normalizedType);

    // Create statement record
    const statement = await prisma.statement.create({
      data: {
        userId: session.user.id,
        filingYearId,
        filePath: s3Key,
        fileName: sanitizeFileName(file.name),
        fileType: normalizedType,
        fileSizeBytes: file.size,
        extractionStatus: "PENDING",
      },
    });

    // Run extraction synchronously
    const extractionResult = await extractFromStatement(s3Key, ext || normalizedType);

    if (!extractionResult.success || !extractionResult.result) {
      // Update statement as failed
      await prisma.statement.update({
        where: { id: statement.id },
        data: {
          extractionStatus: "FAILED",
          extractionError: extractionResult.error || "Extraction failed",
          llmModel: extractionResult.model,
          llmTokensUsed: extractionResult.tokensUsed,
        },
      });

      return NextResponse.json({
        statementId: statement.id,
        extractedAccounts: [],
        warnings: [extractionResult.error || "Extraction failed. You can still add accounts manually."],
      });
    }

    // Map extracted accounts to D2C format
    const mappedAccounts = mapExtractedAccounts(
      extractionResult.result.accounts,
      filingYear.calendarYear
    );

    // Update statement with results
    await prisma.statement.update({
      where: { id: statement.id },
      data: {
        extractionStatus: "COMPLETED",
        rawExtraction: extractionResult.result as unknown as import("@prisma/client").Prisma.InputJsonValue,
        extractedAccounts: mappedAccounts as unknown as import("@prisma/client").Prisma.InputJsonValue,
        llmModel: extractionResult.model,
        llmTokensUsed: extractionResult.tokensUsed,
      },
    });

    // Gather warnings
    const warnings: string[] = [];
    for (const mapped of mappedAccounts) {
      if (mapped.warnings.length > 0) {
        warnings.push(...mapped.warnings.map((w) => `Account ${mapped.sourceIndex + 1}: ${w}`));
      }
      if (mapped.confidence.overall === "low") {
        warnings.push(`Account ${mapped.sourceIndex + 1}: Low overall confidence — please review carefully.`);
      }
    }

    return NextResponse.json({
      statementId: statement.id,
      extractedAccounts: mappedAccounts,
      warnings,
    });
  } catch (error) {
    console.error("Statement upload error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
