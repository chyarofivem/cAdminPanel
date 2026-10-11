/* eslint-disable */
const { fontFamily } = require("tailwindcss/defaultTheme");
const colors = require('tailwindcss/colors');

/**
 * Design system tokens.
 * Every colour resolves to a CSS custom property declared in src/globals.css,
 * so changing the accent (or any surface) re-themes the whole panel.
 * The token reference lives in docs/design-system.md.
 *
 * Status colours expose `rgb(var(--x-rgb) / <alpha-value>)` so a status badge can
 * use its 15% tint (`bg-success/15`). Translucent surfaces are already alpha
 * values and are referenced directly.
 */
const statusColor = (name) => ({
  DEFAULT: `rgb(var(--${name}-rgb) / <alpha-value>)`,
  text: `var(--${name}-text)`,
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        md: "1.5rem",
        lg: "2rem",
      },
    },
    //Only menus, modals and the primary button get elevation. Everything else is flat.
    boxShadow: {
      none: 'none',
      DEFAULT: 'none',
      sm: 'none',
      md: 'none',
      lg: 'none',
      xl: 'none',
      '2xl': 'none',
      inner: 'none',
      button: '0 1px 3px rgb(0 0 0 / 0.1)',
      menu: '0 20px 25px -5px rgb(0 0 0 / 0.25), 0 8px 10px -6px rgb(0 0 0 / 0.25)',
      modal: '0 25px 50px -12px rgb(0 0 0 / 0.5), 0 0 0 1px var(--hairline)',
    },
    //No glassmorphism.
    backdropBlur: {
      none: '0',
      DEFAULT: '0',
      sm: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
    },
    //Weights 400, 500 and 600 only.
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '600',
      extrabold: '600',
      black: '600',
    },
    borderRadius: {
      none: '0px',
      xs: 'var(--radius-xs)',
      DEFAULT: 'var(--radius-xs)',
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-md)',
      '2xl': 'var(--radius-lg)',
      '3xl': 'var(--radius-lg)',
      full: 'var(--radius-pill)',
      pill: 'var(--radius-pill)',
    },
    fontSize: {
      micro: ['11px', { lineHeight: '1.5' }],
      '2xs': ['11px', { lineHeight: '1.5' }],
      xs: ['12px', { lineHeight: '1.5' }],
      dense: ['13px', { lineHeight: '1.5' }],
      sm: ['14px', { lineHeight: '1.5' }],
      base: ['16px', { lineHeight: '1.5' }],
      lg: ['18px', { lineHeight: '1.25' }],
      xl: ['20px', { lineHeight: '1.25' }],
      '2xl': ['24px', { lineHeight: '1.25' }],
      '3xl': ['24px', { lineHeight: '1.25' }],
      '4xl': ['24px', { lineHeight: '1.25' }],
    },
    extend: {
      typography: {
        toast: {
          css: [
            {
              '--tw-prose-body': colors.zinc[200],
              '--tw-prose-invert-body': colors.zinc[200],
              '--tw-prose-bullets': colors.zinc[400],
              '--tw-prose-invert-bullets': colors.zinc[400],
              a: {
                fontWeight: '500',
              },
              p: {
                marginTop: '0.5em',
                marginBottom: '0.5em',
              },
              ul: {
                marginTop: '0.5em',
                marginBottom: '0.5em',
              },
            },
            {
              '> :first-child': {
                marginTop: '0',
              },
              '> :last-child': {
                marginBottom: '0',
              },
            },
          ],
        },
      },
      spacing: {
        navbarvh: "var(--navbar-vh)", //navbar height (including border)
        contentoffset: "var(--content-offset)", // screen - navbar - pt
        contentvh: "var(--content-vh)", // screen - navbar - pt - pb
        sidebar: "16rem", //256px
        touch: "44px", //minimum touch target height
      },
      minHeight: {
        touch: "44px",
      },
      screens: {
        xs: "480px",
        "2xl": "1400px",
        "3xl": "1600px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        mono: ["var(--font-mono)", ...fontFamily.mono],
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      colors: {
        //Accent: the one knob. Never use `text-accent`; accent as text is `text-accent-text`.
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          text: "var(--accent-text)",
          glow: "var(--accent-glow)",
          soft: "var(--accent-soft)",
          tint: "var(--accent-tint)",
          edge: "var(--accent-edge)",
          foreground: "var(--text)",
        },

        //Surfaces
        "bg-top": "var(--bg-top)",
        "bg-bottom": "var(--bg-bottom)",
        sidebar: "var(--sidebar)",
        menu: "var(--menu)",
        modal: "var(--modal)",
        raise: {
          DEFAULT: "var(--raise)",
          2: "var(--raise-2)",
          3: "var(--raise-3)",
        },
        sunken: "var(--sunken)",
        hairline: "var(--hairline)",

        //Text: white is `text-white`, body copy is the default colour.
        body: "var(--text-body)",
        faint: "var(--text-faint)",
        badge: "var(--badge-text)",

        //Status: never follows the accent
        success: statusColor('success'),
        warning: statusColor('warning'),
        danger: statusColor('danger'),
        info: statusColor('info'),

        discord: {
          DEFAULT: "#5865F2",
          active: "#7289DA"
        },

        //Legacy shadcn names, mapped onto the closest design token so the
        //generated primitives keep working. Prefer the token names above.
        destructive: {
          DEFAULT: "rgb(var(--danger-rgb) / <alpha-value>)",
          foreground: "var(--text)",
          hint: "var(--danger-tint)",
          inline: "var(--danger-text)",
        },
        border: "var(--hairline)",
        input: "var(--hairline)",
        ring: "var(--accent-text)",
        background: "var(--bg-bottom)",
        foreground: "var(--text)",
        primary: {
          DEFAULT: "var(--text)",
          foreground: "var(--bg-bottom)",
        },
        secondary: {
          DEFAULT: "var(--raise-2)",
          foreground: "var(--text)",
        },
        muted: {
          DEFAULT: "var(--raise)",
          foreground: "var(--text-muted)",
        },
        popover: {
          DEFAULT: "var(--menu)",
          foreground: "var(--text-body)",
        },
        card: {
          DEFAULT: "var(--raise)",
          foreground: "var(--text-body)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "toastbar-progress": {
          '0%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0)' },
        },
        "loading-bar": {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 150ms ease",
        "accordion-up": "accordion-up 150ms ease",
        //NOTE: the duration is overridden inline with the toast's own duration
        "toastbar-progress": 'toastbar-progress 5s linear forwards',
        "loading-bar": 'loading-bar 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require('@tailwindcss/typography'),
  ],
};
