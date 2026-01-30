/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'media',
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#292524',
            '--tw-prose-headings': '#1c1917',
            '--tw-prose-links': '#1c1917',
            '--tw-prose-bullets': '#57534e',
            '--tw-prose-counters': '#57534e',
            'ul, ol': {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
            'li': {
              marginTop: '0.125em',
              marginBottom: '0.125em',
            },
            'li > p': {
              marginTop: '0 !important',
              marginBottom: '0 !important',
            },
            'li > ul, li > ol': {
              marginTop: '0 !important',
              marginBottom: '0 !important',
            },
          },
        },
        invert: {
          css: {
            '--tw-prose-body': '#d6d3d1',
            '--tw-prose-headings': '#fafaf9',
            '--tw-prose-links': '#e7e5e4',
            '--tw-prose-bullets': '#78716c',
            '--tw-prose-counters': '#78716c',
          },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
