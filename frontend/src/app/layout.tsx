import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

// Always read cookie on the server so locale updates immediately after /set-locale redirect
export const dynamic = "force-dynamic";
import DisclaimerBanner from "@/components/layout/DisclaimerBanner";
import GoogleAuthProvider from "@/components/GoogleAuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MindEase — AI Mental Health Companion",
  description: "Your AI-powered mental health support platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir="ltr"
      className={`${inter.variable} ${fraunces.variable}`}
      data-locale={locale}
      suppressHydrationWarning
    >
      <body className={`${inter.variable} ${fraunces.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <TooltipProvider delayDuration={0}>
              <GoogleAuthProvider>
                <DisclaimerBanner />
                {children}
                <Toaster />
              </GoogleAuthProvider>
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
