import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Brewery Scheduler",
  description: "Flexible schedule management for breweries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="ja">
        <body className={inter.className}>
          <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
              <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px]" />
            </div>
            
            <main className="relative flex-grow flex flex-col">
              {children}
            </main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
