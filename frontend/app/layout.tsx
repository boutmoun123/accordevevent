import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";

const logoSrc = "/logo.png";

export const metadata: Metadata = {
  title: { default: "Farah | Smart Matchmaking Platform", template: "%s | Farah" },
  description: "A private, guided matchmaking journey with trusted matchmaker support.",
  icons: {
    icon: logoSrc,
    shortcut: logoSrc,
    apple: logoSrc,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <PreferencesProvider>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
