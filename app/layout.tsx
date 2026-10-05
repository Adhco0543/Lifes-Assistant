import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Life's Assistant",
  description:
    "A personal and business AI assistant for planning, drafts, tasks, quotes, notes, and everyday organization",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
