import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Tools",
  description: "Self-owned internal tools platform (proof of concept)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
