/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tema escuro: preto, cinza grafite, laranja, branco.
        background: "#0a0a0a",
        surface: "#161616",
        graphite: {
          DEFAULT: "#1f2023",
          light: "#2a2c30",
          border: "#34373c",
        },
        brand: {
          DEFAULT: "#f97316", // laranja
          hover: "#ea670c",
          muted: "#7c3a0f",
        },
        ink: {
          DEFAULT: "#fafafa",
          muted: "#a1a1aa",
          faint: "#71717a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
      },
    },
  },
  plugins: [],
};
