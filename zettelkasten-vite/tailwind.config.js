/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Wombat palette als Tailwind tokens
        wombat: {
          bg:        '#242424',
          bg2:       '#1c1c1c',
          bg3:       '#2d2d2d',
          bg4:       '#333333',
          statusBg:  '#3a3a3a',
          splitBg:   '#3a4046',
          lineNrBg:  '#303030',
          fg:        '#e3e0d7',
          fgMuted:   '#857b6f',
          fgDim:     '#a0a8b0',
          statusFg:  '#ffffd7',
          comment:   '#9fca56',
          string:    '#cae682',
          keyword:   '#8ac6f2',
          type:      '#92b5dc',
          orange:    '#e5786d',
          purple:    '#d787ff',
          yellow:    '#eae788',
          blue:      '#8ac6f2',
          green:     '#9fca56',
          cursor:    '#eae788',
        },
        // shadcn/ui CSS variable mapping
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        mono: ["'Hack'", "'Cascadia Code'", "'JetBrains Mono'", "'Fira Code'", "monospace"],
        sans: ["'DM Sans'", "'Outfit'", "system-ui", "sans-serif"],
      },
      animation: {
        'fade-in':    'fadeIn 0.18s ease-out',
        'slide-in':   'slideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ai-pulse':   'aiPulse 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateY(-4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        aiPulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
    },
  },
  plugins: [],
}
