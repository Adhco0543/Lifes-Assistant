import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Business Assistant",
  description: "AI-powered business assistant for service professionals - quotes, notes, materials, email, and more"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
