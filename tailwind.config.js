/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Futuristic UI Theme Colors
        quantum: {
          cyan: '#40dcff', // Primary cyan
          purple: '#aa55ff', // Primary purple
        },
        neon: {
          green: '#00ffaa', // Success green
          pink: '#ff3366', // Error pink
          yellow: '#ffdc00', // Accent yellow
        },
        space: {
          dark: '#0a0e17', // Deep space dark
          surface: '#111827', // Surface gray
          card: '#1a1f2e', // Card background
          elevated: '#242938', // Elevated background
        },
      },
      boxShadow: {
        'quantum': '0 8px 25px rgba(64, 220, 255, 0.4)',
        'nebula': '0 8px 25px rgba(139, 92, 246, 0.4)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 4s ease infinite',
        'border-flow': 'border-flow 3s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(64, 220, 255, 0.3), 0 0 40px rgba(170, 85, 255, 0.2), 0 0 60px rgba(64, 220, 255, 0.1)'
          },
          '50%': {
            boxShadow: '0 0 30px rgba(64, 220, 255, 0.5), 0 0 60px rgba(170, 85, 255, 0.3), 0 0 90px rgba(64, 220, 255, 0.2)'
          }
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' }
        },
        'border-flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      }
    },
  },
  plugins: [],
}