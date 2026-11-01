import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Pwa } from "@/components/Pwa";

export const metadata: Metadata = {
  title: "VetKonnect P.O.S & Management",
  description: "Veterinary practice management and point of sale",
  applicationName: "VetKonnect P.O.S & Management",
  appleWebApp: { capable: true, title: "VetKonnect POS", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/pwa-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/pwa-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#143d26",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const practiceCode = (await headers()).get("x-practice-code");
  const manifestUrl = practiceCode && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(practiceCode)
    ? `/practice/${practiceCode}/manifest.webmanifest`
    : "/manifest.webmanifest";
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href={manifestUrl} />
      </head>
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
