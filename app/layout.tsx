import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavigationWrapper from "./components/NavigationWrapper";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  title: "Parasite",
  description: "Parasite bitcoin mining pool",
  metadataBase: new URL('https://parasite.wtf'),
  openGraph: {
    title: "Parasite",
    description: "Parasite bitcoin mining pool",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Parasite",
    description: "Parasite bitcoin mining pool",
  },
};

// Disable zooming on mobile
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <div className="min-h-screen flex flex-col container mx-auto">
          <NavigationWrapper />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
