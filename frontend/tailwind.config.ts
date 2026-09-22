import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["IBM Plex Sans Arabic", "Tahoma", "sans-serif"] },
      colors: {
        brand: {
          rose: "#D63362",
          navy: "#151A2D",
          pink: "#FFF2F6",
          paper: "#FFFCFB",
        },
      },
      boxShadow: { soft: "0 14px 45px rgba(21,26,45,.08)" },
    },
  },
  plugins: [],
} satisfies Config;
