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
          <Suspense
            fallback={
              <aside className="fixed left-0 top-0 z-40 hidden md:flex h-screen w-56 flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <div className="flex h-14 items-center gap-2 border-b border-[var(--border-color)] px-4">
                  <div className="h-6 w-6 rounded bg-[var(--bg-card)] animate-pulse" />
                  <div className="h-5 w-24 rounded bg-[var(--bg-card)] animate-pulse" />
                </div>
                <div className="flex-1 space-y-2 px-2 py-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-9 rounded-md bg-[var(--bg-card)] animate-pulse"
                    />
                  ))}
                </div>
              </aside>
            }
          >
            <Sidebar />
          </Suspense>
          <main className="md:ml-56 flex-1 pt-14 md:pt-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
