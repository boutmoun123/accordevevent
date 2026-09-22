"use client";

import { Moon, Sun } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { languageLabel } from "@/lib/i18n";

export function Navbar() {
  const { language, toggleLanguage, toggleTheme, isDark } = usePreferences();
  const themeLabel = language === "ar" ? "تغيير المظهر" : "Change theme";
  const buttonClass = isDark
    ? "border-[#4A2134] bg-[#2B1421] text-[#FF6F9C] hover:bg-[#3A1730] hover:text-[#FF8CB1]"
    : "border-[#f1d9e1] bg-white text-[#a92850] hover:bg-[#fff6f9]";

  return (
    <header className={`relative z-30 border-b backdrop-blur ${isDark ? "border-[#4A2134] bg-[#21101A]/95" : "border-rose-100/60 bg-brand-paper/90"}`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2" dir="ltr">
          <Button type="button" variant="outline" className={buttonClass} onClick={toggleLanguage}>
            {languageLabel[language]}
          </Button>
          <Button type="button" size="icon" variant="outline" className={buttonClass} onClick={toggleTheme} aria-label={themeLabel}>
            {isDark ? <Moon size={17} /> : <Sun size={17} />}
          </Button>
        </div>
      </div>
    </header>
  );
}
