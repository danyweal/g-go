/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'palestine-green': '#009739',
        'palestine-red': '#CE1126',
        'palestine-black': '#000000',
        'palestine-white': '#ffffff',
        'palestine-accent': '#FFD700',
        'palestine-light': '#f5f5f5',
        'palestine-dark': '#1f2937',
        'palestine-muted': '#6b7280',
      },
      boxShadow: {
        card: '0 10px 25px -5px rgba(0,0,0,0.15)',
        hover: '0 15px 30px -10px rgba(0,0,0,0.2)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        cairo: ['Cairo', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/line-clamp')],
};
