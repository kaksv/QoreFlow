import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: {
    default: "QoreFlow — Money that flows",
    template: "%s · QoreFlow",
  },
  description:
    "Quantum-secure continuous payment streaming on QoreChain. Stream QOR by the second, withdraw what you earn, and protect sensitive actions with ML-DSA-87 signatures verified on chain.",
  keywords: [
    "QoreChain",
    "payment streaming",
    "post-quantum",
    "ML-DSA-87",
    "QOR",
  ],
  openGraph: {
    title: "QoreFlow — Money that flows. Security built for tomorrow.",
    description:
      "Continuous QOR payment streams with post-quantum authorized cancellation on QoreChain.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
