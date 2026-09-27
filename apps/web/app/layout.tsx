import type { Metadata } from "next";
import Link from "next/link";
import type React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bulk URL Health Checker",
  description: "Submit a list of URLs and watch their health checks complete live.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full">
        <header className="border-b">
          <nav className="mx-auto flex max-w-6xl items-center gap-4 p-4">
            <Link href="/" className="font-semibold">
              Bulk URL Health Checker
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl p-4">{children}</main>
      </body>
    </html>
  );
}
