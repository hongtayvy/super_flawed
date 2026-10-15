/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17183E',
        cobalt: '#3153F5',
        sun: '#FFE56A',
        coral: '#FF7369',
        lilac: '#B8B5FF',
        ice: '#F8F9FF',
        mint: '#B8F1D0',
        muted: '#5B6080',
        line: '#CED3EF',
      },
      fontFamily: {
        display: ['Impact', '"Arial Black"', 'sans-serif'],
        body: ['"Trebuchet MS"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        pop: '5px 6px 0 #17183E',
        'pop-sm': '3px 4px 0 #17183E',
        'pop-lg': '8px 9px 0 #17183E',
        'pop-xl': '12px 13px 0 #17183E',
      },
    },
  },
  plugins: [],
};
