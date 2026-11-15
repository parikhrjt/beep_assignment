import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: { default: "Beep — fresher jobs, with receipts", template: "%s · Beep" },
  description: "India fresher jobs and internships, tagged by AI. Every tag ships with a verbatim quote from the post as proof. Accuracy and cost are measured in public.",
  openGraph: { title: "Beep — fresher jobs, with receipts", description: "Every AI tag carries a verbatim quote from the post. No quote, no tag.", type: "website" },
};
export const viewport: Viewport = { themeColor: "#0a0a0b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
