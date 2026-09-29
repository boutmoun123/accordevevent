import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["IBM Plex Sans Arabic", "Tahoma", "sans-serif"] },
      colors: {
        brand: {
          rose: "#8E3D6B",
          navy: "#2A1630",
          pink: "#F3E6EC",
          paper: "#FFF9FB",
        },
      },
      boxShadow: { soft: "0 14px 45px rgba(42,22,48,.08)" },
    },
  },
  plugins: [],
} satisfies Config;
