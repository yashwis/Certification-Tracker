import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Niubiz Certification Tracker",
  description: "PAC and AP certification coverage and test-case status dashboard.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
