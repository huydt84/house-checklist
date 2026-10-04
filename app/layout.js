import { Geist, Noto_Sans, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});
const noto = Noto_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-noto",
  display: "swap",
  preload: false,
});
const japanese = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-japanese",
  display: "swap",
  preload: false,
});
export const metadata = {
  metadataBase: new URL(
    process.env.APP_URL || "https://house-checklist-three.vercel.app",
  ),
  title: "House Checklist",
  description: "Your rental shortlist, viewing notes, and shared checklist.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    title: "House Checklist",
    description: "Your rental shortlist, viewing notes, and shared checklist.",
    siteName: "House Checklist",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "House Checklist",
    description: "Your rental shortlist, viewing notes, and shared checklist.",
  },
  robots: { index: false, follow: false },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f8f8",
};
export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${noto.variable} ${japanese.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
