import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FBAR Direct — File Your FBAR in 10 Minutes",
  description:
    "The trustworthy, affordable way to file your Report of Foreign Bank and Financial Accounts (FBAR/FinCEN Form 114). FinCEN-registered BSA E-Filer. $59 flat fee.",
  keywords: [
    "FBAR",
    "FinCEN Form 114",
    "file FBAR online",
    "FBAR filing service",
    "foreign bank account report",
    "BSA E-Filing",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
