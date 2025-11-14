import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavigationWrapper from "./components/NavigationWrapper";
import Footer from "./components/Footer";
import { WalletProvider } from "./hooks/useWallet";
import { validateEnv } from "./lib/env-validation";

// Validate environment variables on server startup
if (typeof window === 'undefined') {
  validateEnv();
}

export const metadata: Metadata = {
  title: "Parasite",
  description: "Parasite bitcoin mining pool",
  metadataBase: new URL('https://parasite.space'),
  openGraph: {
    title: "Parasite",
    description: "Parasite bitcoin mining pool",
    type: "website",
    images: [
      {
        url: "/og-bug.png",
        width: 600,
        height: 315,
        alt: "Parasite",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Parasite",
    description: "Parasite bitcoin mining pool",
    images: ["/og-bug.png"],
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
        <WalletProvider>
          <div className="min-h-screen flex flex-col container mx-auto">
            <NavigationWrapper />
            {children}
            <Footer />
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
