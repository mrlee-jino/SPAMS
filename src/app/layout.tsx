import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SPAMS-S · Pond intelligence",
  description:
    "Six-node aquaculture monitoring research platform. Phase 1 simulation.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
