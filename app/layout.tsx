import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import Navbar from "@/components/Navbar";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "EngineX Arena",
  description: "Code and design battle arena",
};

export default function RootLayout({
  children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="antialiased bg-bg text-cream font-sans flex flex-col h-screen w-screen overflow-hidden">
        <SessionProvider>
          <ToastProvider>
            <Navbar />
            <main className="flex-1 min-h-0 relative flex flex-col">
              {children}
            </main>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
