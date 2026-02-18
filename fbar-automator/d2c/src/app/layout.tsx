import type { Metadata } from "next";
import { Inter, Merriweather, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-merriweather",
});
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  title: "FBAR Direct — Report of Foreign Bank and Financial Accounts",
  description:
    "Securely file your FBAR (FinCEN Form 114) online. FinCEN-registered BSA E-Filing institution. AES-256 encryption. Starting at $59 per filing.",
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
      <body className={`${inter.variable} ${merriweather.variable} ${sourceSans.variable} ${inter.className}`}>{children}</body>
    </html>
  );
}
