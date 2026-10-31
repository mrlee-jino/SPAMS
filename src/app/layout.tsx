import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SPAMS-S · Pond intelligence",
  description:
    "Public aquaculture monitoring research platform with labeled simulation and hardware telemetry.",
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
