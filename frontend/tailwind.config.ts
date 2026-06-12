import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ワンゲル部のアースカラーシステム
        earth: {
          50: '#f7f6ef',
          100: '#ece9db',
          200: '#d9d2b8',
          300: '#bfb38d',
          400: '#a79567',
          500: '#8f7c49',
          600: '#736037',
          700: '#5c4c2e',
          800: '#4b3f29',
          900: '#3f3625',
          950: '#231d14',
        },
        forest: {
          50: '#f2f7f2',
          100: '#e2efe1',
          200: '#c5dfc4',
          300: '#9bc698',
          400: '#68a663',
          500: '#42873c',
          600: '#336c2e',
          700: '#2a5627',
          800: '#254623',
          900: '#203b1f',
          950: '#0d200d',
        },
        accent: {
          orange: '#e67e22',
          yellow: '#f39c12',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
