/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.ts'],
  theme: {
    extend: {
      colors: {
        docker: '#2496ed',
        neon: '#39ff14',
        cyan: '#00d4ff',
        terminal: '#0d1117',
        daylight: '#74bdf3',
        ink: '#cdd6e0',
        muted: '#4a5568',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
