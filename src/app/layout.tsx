import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sittr",
  description: "A trusted pet-sitting marketplace for South Africa.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#E9E5DC]">
        <div className="mx-auto w-full max-w-[430px] flex-1 bg-paper shadow-[0_0_60px_rgba(0,0,0,0.1)]">
          {children}
        </div>
      </body>
    </html>
  );
}
