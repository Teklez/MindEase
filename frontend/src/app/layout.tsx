import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import GoogleAuthProvider from "@/components/GoogleAuthProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "MindEase — AI Mental Health Companion",
  description: "Your AI-powered mental health support platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <GoogleAuthProvider>
          <DisclaimerBanner />
          {children}
        </GoogleAuthProvider>
      </body>
    </html>
  );
}
