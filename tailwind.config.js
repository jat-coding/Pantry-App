/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        eggshell: '#F0EAD6',
        'surface-2': '#FAF4E8',
        peach: '#FFCBA4',
        'peach-dark': '#F2A977',
        // Reserved for the primary action only (white text passes AA).
        cta: '#BE531F',
        'cta-dark': '#9C4019',
        // Positive / "in pantry" accent.
        herb: '#5E7C4F',
        'herb-dark': '#4C6740',
        warm: '#2C2416',
        'warm-soft': '#6B5E4A',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 4px 16px rgba(44, 36, 22, 0.08)',
        'card-hover': '0 10px 28px rgba(44, 36, 22, 0.14)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.35)' },
          '100%': { transform: 'scale(1)' },
        },
        fadein: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        toastin: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pop: 'pop 0.35s ease-out',
        fadein: 'fadein 0.3s ease-out',
        toastin: 'toastin 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
