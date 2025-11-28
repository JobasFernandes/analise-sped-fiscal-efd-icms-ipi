import {
  slate,
  blue,
  green,
  yellow,
  red,
  orange,
  purple,
  gray,
  slateA,
  blueA,
  greenA,
  yellowA,
  redA,
  orangeA,
  purpleA,
  grayA,
  slateDark,
  blueDark,
  greenDark,
  yellowDark,
  redDark,
  orangeDark,
  purpleDark,
  grayDark,
  slateDarkA,
  blueDarkA,
  greenDarkA,
  yellowDarkA,
  redDarkA,
  orangeDarkA,
  purpleDarkA,
  grayDarkA,
} from "@radix-ui/colors";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class"],
  theme: {
    screens: {
      xs: "480px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        // Radix UI light colors
        slate,
        blue,
        green,
        yellow,
        red,
        orange,
        purple,
        gray,

        // Radix UI alpha colors
        slateA,
        blueA,
        greenA,
        yellowA,
        redA,
        orangeA,
        purpleA,
        grayA,

        // Dark mode colors
        dark: {
          slate: slateDark,
          blue: blueDark,
          green: greenDark,
          yellow: yellowDark,
          red: redDark,
          orange: orangeDark,
          purple: purpleDark,
          gray: grayDark,
        },

        // Dark alpha colors
        darkA: {
          slate: slateDarkA,
          blue: blueDarkA,
          green: greenDarkA,
          yellow: yellowDarkA,
          red: redDarkA,
          orange: orangeDarkA,
          purple: purpleDarkA,
          gray: grayDarkA,
        },

        // Theme semantic colors
        primary: {
          50: blue.blue1,
          100: blue.blue2,
          200: blue.blue3,
          300: blue.blue4,
          400: blue.blue5,
          500: blue.blue6,
          600: blue.blue7,
          700: blue.blue8,
          800: blue.blue9,
          900: blue.blue10,
          950: blue.blue11,
        },

        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
