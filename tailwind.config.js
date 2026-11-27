/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#101116',
        'app-header': '#171820',
        card: '#1B1D23',
        input: '#41494A',
        'input-border': '#70A98C',
        'input-text': '#CFF5DC',
        divider: '#45464E',
        nav: '#414149',
        'nav-inactive': '#D0CBDD',
        ink: {
          DEFAULT: '#F5F5F7',
          muted: '#C6C8D0',
          inverse: '#101116',
        },
        accent: '#39E5E8',
        connected: {
          DEFAULT: '#176D49',
          border: '#42B987',
        },
        lavender: '#C9B7E8',
        danger: '#FF8A80',
        success: '#8BE9B0',
      },
      keyframes: {
        'sheet-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'sheet-up': 'sheet-up 200ms ease-out',
      },
    },
  },
  plugins: [],
};
