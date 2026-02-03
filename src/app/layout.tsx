import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ACTIVE_THEME } from "@/lib/theme-config";
import { LanguageProvider } from "@/lib/i18n";
import QueryProvider from "@/providers/QueryProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeApplier } from "@/components/shared/ThemeApplier";

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
  icons: {
    icon: "/logo-icon.png",
    shortcut: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
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
        suppressHydrationWarning
      >
        <LanguageProvider>
          <QueryProvider>
            <AuthProvider>
              <ThemeApplier>
                {children}
              </ThemeApplier>
            </AuthProvider>
          </QueryProvider>
          <Toaster position="top-right" />
        </LanguageProvider>
      </body>
    </html>
  );
}


