import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Priinteve — Business OS",
    template: "%s · Priinteve",
  },
  description: "Priinteve internal business management platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SessionProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster position="top-right" richColors closeButton />
            </TooltipProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
