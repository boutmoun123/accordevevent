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
    ? "border-[#4A3040] bg-[#261722] text-[#C97AA1] hover:bg-[#30202C] hover:text-[#E8BDD0]"
    : "border-[#E6D7E0] bg-white text-[#6E3357] hover:bg-[#F3E6EC]";

  return (
    <header className={`relative z-30 border-b backdrop-blur ${isDark ? "border-[#4A3040] bg-[#21121E]/95" : "border-brand-pink bg-brand-paper/90"}`}>
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
