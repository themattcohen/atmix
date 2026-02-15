import { jsPDF } from "jspdf";
import { uploadFile } from "@/lib/s3";

export interface Form114aData {
  firstName: string;
  lastName: string;
  tinLast4: string;
  calendarYear: number;
  accountCount: number;
  signatureData: string;
  signatureType: "typed" | "drawn";
  signedAt: Date;
  signatureIp: string;
}

export async function generateForm114a(data: Form114aData): Promise<{ buffer: Buffer; key: string }> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(17, 46, 81); // navy #112e51
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("FinCEN Form 114a", pageWidth / 2, 18, { align: "center" });
  doc.setFontSize(12);
  doc.text("Record of Authorization to Electronically File FBARs", pageWidth / 2, 30, { align: "center" });

  // Reset colors
  doc.setTextColor(0, 0, 0);
  let y = 55;

  // Filing details
  doc.setFontSize(14);
  doc.text("Filing Authorization", 20, y);
  y += 12;

  doc.setFontSize(10);
  const details = [
    ["Filer Name:", `${data.firstName} ${data.lastName}`],
    ["TIN (last 4):", `XXX-XX-${data.tinLast4}`],
    ["Calendar Year:", String(data.calendarYear)],
    ["Number of Accounts:", String(data.accountCount)],
    ["Date Signed:", data.signedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
    ["IP Address:", data.signatureIp],
  ];

  for (const [label, value] of details) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 80, y);
    y += 8;
  }

  y += 10;

  // Certification text
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Certification", 20, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const certText = "I certify that I am the filer of this Report of Foreign Bank and Financial Accounts (FBAR), " +
    "and that the information provided in the report is true, correct, and complete to the best of my knowledge and belief. " +
    "I authorize FBAR Direct to electronically file this FBAR on my behalf through the BSA E-Filing System. " +
    "I understand that I remain responsible for the accuracy and completeness of the information reported.";

  const lines = doc.splitTextToSize(certText, pageWidth - 40);
  doc.text(lines, 20, y);
  y += lines.length * 5 + 15;

  // Signature
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Digital Signature", 20, y);
  y += 10;

  doc.setDrawColor(17, 46, 81);
  doc.line(20, y + 5, pageWidth - 20, y + 5);

  if (data.signatureType === "typed") {
    doc.setFontSize(16);
    doc.setFont("courier", "italic");
    doc.text(data.signatureData, 25, y + 2);
  } else {
    doc.setFontSize(10);
    doc.text("[Digital signature on file]", 25, y + 2);
  }

  y += 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Electronically signed on ${data.signedAt.toISOString()} from IP ${data.signatureIp}`, 20, y);

  // Footer disclaimer
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency. " +
    "FBAR Direct is a FinCEN-registered BSA E-Filing institution.",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  // Convert to buffer
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  // Upload to S3
  const key = `form114a/${data.calendarYear}/${Date.now()}_form114a.pdf`;
  await uploadFile(key, pdfBuffer, "application/pdf");

  return { buffer: pdfBuffer, key };
}
