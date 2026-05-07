import type { Metadata } from "next";
import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "LineupCast OS",
  description: "Open-source football pre-match commentary data cockpit",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <main className="md:ml-56 flex-1 pt-14 md:pt-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
