/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        utah: {
          50:  '#EEEDFE',
          100: '#CECBF6',
          500: '#534AB7',
          600: '#3C3489',
          700: '#26215C',
        },
      },
    },
  },
  plugins: [],
}
