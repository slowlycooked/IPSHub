/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colors (from DESIGN.md Enterprise)
        primary: '#072C2C',
        'primary-light': '#0f4a4a',
        accent: '#FF5F03',
        'accent-dark': '#d94e00',

        // Status colors
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',

        // Surface / background
        surface: '#EDEADE',
        'surface-base': '#EDEADE',
        'surface-0': '#ffffff',
        'surface-1': '#f4f0e5',
        'surface-2': '#ede9dc',

        // Text colors (light theme)
        text: '#111827',
        'text-muted': '#4B5563',
        'text-dim': '#9CA3AF',
        'text-inverse': '#ffffff',

        // Borders
        line: '#d1d9c8',
        'line-soft': '#e5ead9',

        // Panels (compat aliases)
        panel: '#ffffff',
        'panel-strong': '#f4f0e5',

        neutral: '#F3F4F6',
      },
      fontFamily: {
        sans: ['Ubuntu', 'system-ui', 'sans-serif'],
        display: ['Oswald', 'system-ui', 'sans-serif'],
        mono: ['Ubuntu Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '18px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['20px', { lineHeight: '28px' }],
        xl: ['24px', { lineHeight: '32px' }],
        '2xl': ['32px', { lineHeight: '40px' }],
        '3xl': ['48px', { lineHeight: '56px' }],
      },
      boxShadow: {
        sm: '0 1px 4px rgba(7, 44, 44, 0.07)',
        md: '0 4px 12px rgba(7, 44, 44, 0.10)',
        lg: '0 8px 24px rgba(7, 44, 44, 0.12)',
        xl: '0 16px 40px rgba(7, 44, 44, 0.16)',
      },
    },
  },
  plugins: [],
};

