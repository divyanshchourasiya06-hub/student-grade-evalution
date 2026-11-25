/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Main brand — muted navy/slate
        navy: {
          50:  '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
          950: '#0b1f31',
        },
        // App surface tokens (light)
        surface: {
          bg:   '#F7F8FA',
          card: '#FFFFFF',
          border: '#E5E8ED',
        },
        // Text tokens
        ink: {
          primary:   '#202733',
          secondary: '#687386',
        },
        // Status
        ok:   { DEFAULT: '#17803D', light: '#E4F5EA' },
        warn: { DEFAULT: '#9A5B00', light: '#FFF3DC' },
        bad:  { DEFAULT: '#B42318', light: '#FDECEB' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
        xs:   ['12px', '18px'],
        sm:   ['13px', '20px'],
        base: ['14px', '22px'],
        md:   ['15px', '24px'],
        lg:   ['16px', '24px'],
        xl:   ['18px', '28px'],
        '2xl': ['20px', '30px'],
        '3xl': ['24px', '32px'],
      },
      boxShadow: {
        card: '0 1px 4px 0 rgba(16, 28, 55, 0.07)',
        dropdown: '0 4px 16px 0 rgba(16, 28, 55, 0.12)',
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
    },
  },
  plugins: [],
};
