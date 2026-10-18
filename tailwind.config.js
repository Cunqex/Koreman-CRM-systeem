/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Primary brand: deep navy, used for the sidebar and active pills.
        navy: {
          50: '#f3f4f8',
          100: '#e3e5ef',
          200: '#c6cadd',
          300: '#9aa1c2',
          400: '#6c74a3',
          500: '#4b5285',
          600: '#373c69',
          700: '#262a4d',
          800: '#141830',
          900: '#0a0e20',
          950: '#020826',
        },
        canvas: '#F5F6F8',
        line: '#E7E9EE',
        // Chart / accent ramp.
        accent: {
          purple: '#7C5CFC',
          blue: '#3B82F6',
          green: '#22C55E',
          amber: '#F59E0B',
          red: '#EF4444',
        },
        // Soft status badge backgrounds + matching text.
        status: {
          bluebg: '#EAF2FE',
          bluefg: '#1D4ED8',
          greenbg: '#E9F8EF',
          greenfg: '#15803D',
          amberbg: '#FEF4E6',
          amberfg: '#B45309',
          redbg: '#FDECEC',
          redfg: '#B91C1C',
          greybg: '#F1F2F5',
          greyfg: '#52566B',
          purplebg: '#F1EDFE',
          purplefg: '#5B38E0',
        },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.04)',
        pop: '0 12px 32px -8px rgb(16 24 40 / 0.18)',
      },
      fontSize: {
        kpi: ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
};
