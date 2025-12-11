import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ACTIVE_THEME } from "@/lib/theme-config";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Dynamic metadata based on active theme
export const metadata: Metadata = {
  title: `${ACTIVE_THEME.branding.logoText} - Education Portal`,
  description: `${ACTIVE_THEME.name} - Production-grade Agency CRM for university applications.`,
};

// Theme class mapping
const getThemeClass = () => {
  switch (ACTIVE_THEME.name) {
    case 'Global Compass':
      return 'theme-global-compass';
    case 'UniConsulting':
    default:
      return ''; // Default theme, no class needed
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeClass = getThemeClass();

  return (
    <html lang="en" className={themeClass}>
      <body
        className={`${montserrat.variable} ${inter.variable} antialiased`}
      >
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}

