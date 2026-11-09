/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f1f8f2',
          100: '#e7f4ec',
          200: '#c8e6d3',
          300: '#a9d6b7',
          400: '#0a966b',
          500: '#086b50',
          600: '#086b50',
          700: '#086b50',
          800: '#004b35',
          900: '#013826',
        },
        secondary: {
          50: '#f5f9f1',
          100: '#eaf3df',
          200: '#d4e7bd',
          300: '#b1d28c',
          400: '#8eb75e',
          500: '#668e3b',
          600: '#50732f',
          700: '#3f5c28',
          800: '#344a24',
          900: '#293c1e',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
