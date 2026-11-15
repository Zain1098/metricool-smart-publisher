/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        metricool: {
          teal: "#00D2B4",
          tealHover: "#00BFA3",
          tealLight: "#E6FAF7",
          tealBorder: "#7FE8D9",
          indigo: "#596CF2",
          indigoLight: "#EEF1FE",
          header: "#0D1525",
          headerBorder: "#1C273C",
          canvas: "#F4F6F8",
          card: "#FFFFFF",
          border: "#E2E8F0",
          borderStrong: "#CBD5E1",
          textPrimary: "#0F172A",
          textSecondary: "#475569",
          textMuted: "#94A3B8",
          pink: "#FF3366",
        },
        studio: {
          canvas: "#F4F6F8",
          shell: "#FFFFFF",
          surface: "#FFFFFF",
          subtle: "#F8FAFC",
          hover: "#F1F5F9",
          border: "#E2E8F0",
          borderStrong: "#CBD5E1",
        },
        ink: {
          primary: "#0F172A",
          secondary: "#475569",
          muted: "#94A3B8",
        },
        accent: {
          DEFAULT: "#00D2B4",
          hover: "#00BFA3",
          soft: "#E6FAF7",
        },
        status: {
          success: "#10B981",
          cloud: "#0EA5E9",
          warning: "#F59E0B",
          danger: "#EF4444",
        },
        platforms: {
          youtube: "#FF0000",
          instagram: "#E4405F",
          tiktok: "#000000",
          facebook: "#1877F2",
          twitter: "#0F1419",
          linkedin: "#0A66C2",
          threads: "#000000",
          pinterest: "#BD081C",
          twitch: "#9146FF",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Plus Jakarta Sans", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        metricool: "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)",
        popover: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
