import type { Metadata } from "next";
import { Roboto } from "next/font/google";

import { Toaster } from "@/components/ui/toaster";
import { deskimobFaviconMetadata } from "@/lib/site/deskimob-favicon";
import {
  DESKIMOB_PWA_NAME,
  DESKIMOB_PWA_SHORT_NAME,
  DESKIMOB_PWA_THEME_COLOR,
} from "@/lib/site/deskimob-pwa";

import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "Deskimob — CRM Imobiliário",
  description: "CRM imobiliário SaaS para corretores autônomos no Brasil",
  applicationName: DESKIMOB_PWA_SHORT_NAME,
  icons: deskimobFaviconMetadata,
  appleWebApp: {
    capable: true,
    title: DESKIMOB_PWA_NAME,
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: DESKIMOB_PWA_THEME_COLOR,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${roboto.variable} h-full antialiased`}>
      <body className={`${roboto.className} flex min-h-full flex-col font-sans`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
