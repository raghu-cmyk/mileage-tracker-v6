import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-muted': 'var(--color-primary-muted)',
        surface: 'var(--color-surface)',
        background: 'var(--color-background)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-inverse': 'var(--color-text-inverse)',
        success: 'var(--color-success)',
        'success-muted': 'var(--color-success-muted)',
        warning: 'var(--color-warning)',
        'warning-muted': 'var(--color-warning-muted)',
        error: 'var(--color-error)',
        'error-muted': 'var(--color-error-muted)',
      },
      borderRadius: {
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      maxWidth: {
        content: 'var(--max-width-content)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
