import type { Metadata, Viewport } from "next";
import { Anek_Latin, Geist, Geist_Mono, Golos_Text, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Headings: Anek Latin by Ek Type (Mumbai), used at a condensed width. Reading: Golos Text.
// Geist, Geist Mono and Instrument Serif are kept for the receipt and the receipts band, which keep their original look.
const display = Anek_Latin({ subsets: ["latin"], axes: ["wdth"], variable: "--font-display" });
const body = Golos_Text({ subsets: ["latin"], variable: "--font-body" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: { default: "beep-jobs: fresher jobs in India, with receipts", template: "%s | beep-jobs" },
  description: "Fresher jobs and internships in India, tagged by AI. Every tag shows the sentence from the post that proves it. Accuracy and cost are measured in public.",
  openGraph: { title: "beep-jobs: fresher jobs in India, with receipts", description: "Every AI tag shows the sentence from the post that proves it.", type: "website", siteName: "beep-jobs" },
};
export const viewport: Viewport = { themeColor: "#f5f5f2", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${geist.variable} ${mono.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
