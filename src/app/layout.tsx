import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#059669",
};

export const metadata: Metadata = {
  title: "Kelas App - Manajemen Kelas",
  description: "Aplikasi manajemen kelas untuk guru dan wali kelas. Kelola rombel, data siswa, nilai, eligible, dan rekomendasi jurusan/PT.",
  keywords: ["kelas", "manajemen", "siswa", "nilai", "pendidikan"],
  authors: [{ name: "Kelas App" }],
  icons: {
    icon: [
      { url: "/api/logo?size=32", sizes: "32x32", type: "image/png" },
      { url: "/api/logo?size=192", sizes: "192x192", type: "image/png" },
      { url: "/logo.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/api/logo?size=180", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/api/manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kelas App",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="apple-touch-icon" href="/api/logo?size=180" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Kelas App" />
        <meta name="apple-mobile-web-app-title" content="Kelas App" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
