/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand colors (dynamic from CSS variables)
        primary: 'var(--color-primary)',
        'primary-light': 'var(--color-primary-light)',
        accent: 'var(--color-accent)',
        'accent-dark': 'var(--color-accent-dark)',

        // Status colors
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',

        // Surface / background
        surface: 'var(--color-surface)',
        'surface-base': 'var(--color-surface)',
        'surface-0': 'var(--color-surface-0)',
        'surface-1': 'var(--color-surface-1)',
        'surface-2': 'var(--color-surface-1)',

        // Text colors
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'text-dim': 'var(--color-text-dim)',
        'text-inverse': 'var(--color-text-inverse)',

        // Borders
        line: 'var(--color-line)',
        'line-soft': 'var(--color-line-soft)',

        // Panels (compat aliases)
        panel: 'var(--color-panel)',
        'panel-strong': 'var(--color-panel-strong)',

        neutral: 'var(--color-surface-1)',
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
        sm: '0 1px 4px rgba(0, 0, 0, 0.1)',
        md: '0 4px 12px rgba(0, 0, 0, 0.15)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.2)',
        xl: '0 16px 40px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [],
};

