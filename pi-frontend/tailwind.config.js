/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        poly: {
          dark: '#0f172a',
          card: 'rgba(30, 41, 59, 0.7)',
          accent: '#3b82f6',
          text: '#f8fafc'
        }
      }
    },
  },
  plugins: [],
}
