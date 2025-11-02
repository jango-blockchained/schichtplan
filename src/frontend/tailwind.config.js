/** @type {import('tailwindcss').Config} *//** @type {import('tailwindcss').Config} */

export default {export default {

  darkMode: ["class"],    darkMode: ["class"],

  content: [    content: [

    "./index.html",		"./index.html",

    "./src/**/*.{js,ts,jsx,tsx}",		"./src/**/*.{js,ts,jsx,tsx}",

  ],	],

  safelist: [	safelist: [

    'data-[state=closed]:slide-out-to-top-[48%]',		'data-[state=closed]:slide-out-to-top-[48%]',

    'data-[state=open]:slide-in-from-top-[48%]',		'data-[state=open]:slide-in-from-top-[48%]',

    'data-[state=closed]:slide-out-to-left-1/2',		'data-[state=closed]:slide-out-to-left-1/2',

    'data-[state=open]:slide-in-from-left-1/2'		'data-[state=open]:slide-in-from-left-1/2'

  ],	],

  theme: {	theme: {

    container: {    	container: {

      center: true,    		center: true,

      padding: '2rem',    		padding: '2rem',

      screens: {    		screens: {

        '2xl': '1400px'    			'2xl': '1400px'

      }    		}

    },    	},

    /* ────────────────────────────────────────────────────────────────    	extend: {

       DESIGN SYSTEM COLOR PALETTE - Integrated from CSS Variables    		colors: {

       ──────────────────────────────────────────────────────────────── */    			border: 'hsl(var(--border))',

    colors: {    			input: 'hsl(var(--input))',

      /* Primary Brand Colors */    			ring: 'hsl(var(--ring))',

      primary: {    			background: 'hsl(var(--background))',

        50: 'var(--color-primary-50)',    			foreground: 'hsl(var(--foreground))',

        100: 'var(--color-primary-100)',    			primary: {

        200: 'var(--color-primary-200)',    				DEFAULT: 'hsl(var(--primary))',

        300: 'var(--color-primary-300)',    				foreground: 'hsl(var(--primary-foreground))'

        400: 'var(--color-primary-400)',    			},

        500: 'var(--color-primary-500)',    			secondary: {

        600: 'var(--color-primary-600)',    				DEFAULT: 'hsl(var(--secondary))',

        700: 'var(--color-primary-700)',    				foreground: 'hsl(var(--secondary-foreground))'

        800: 'var(--color-primary-800)',    			},

        900: 'var(--color-primary-900)',    			destructive: {

        950: 'var(--color-primary-950)',    				DEFAULT: 'hsl(var(--destructive))',

      },    				foreground: 'hsl(var(--destructive-foreground))'

      /* Semantic Colors */    			},

      success: {    			muted: {

        50: 'var(--color-success-50)',    				DEFAULT: 'hsl(var(--muted))',

        100: 'var(--color-success-100)',    				foreground: 'hsl(var(--muted-foreground))'

        200: 'var(--color-success-200)',    			},

        300: 'var(--color-success-300)',    			accent: {

        400: 'var(--color-success-400)',    				DEFAULT: 'hsl(var(--accent))',

        500: 'var(--color-success-500)',    				foreground: 'hsl(var(--accent-foreground))'

        600: 'var(--color-success-600)',    			},

        700: 'var(--color-success-700)',    			popover: {

        800: 'var(--color-success-800)',    				DEFAULT: 'hsl(var(--popover))',

        900: 'var(--color-success-900)',    				foreground: 'hsl(var(--popover-foreground))'

      },    			},

      warning: {    			card: {

        50: 'var(--color-warning-50)',    				DEFAULT: 'hsl(var(--card))',

        100: 'var(--color-warning-100)',    				foreground: 'hsl(var(--card-foreground))'

        200: 'var(--color-warning-200)',    			},

        300: 'var(--color-warning-300)',    			chart: {

        400: 'var(--color-warning-400)',    				'1': 'hsl(var(--chart-1))',

        500: 'var(--color-warning-500)',    				'2': 'hsl(var(--chart-2))',

        600: 'var(--color-warning-600)',    				'3': 'hsl(var(--chart-3))',

        700: 'var(--color-warning-700)',    				'4': 'hsl(var(--chart-4))',

        800: 'var(--color-warning-800)',    				'5': 'hsl(var(--chart-5))'

        900: 'var(--color-warning-900)',    			},

      },    			sidebar: {

      destructive: {    				DEFAULT: 'hsl(var(--sidebar-background))',

        50: 'var(--color-destructive-50)',    				foreground: 'hsl(var(--sidebar-foreground))',

        100: 'var(--color-destructive-100)',    				primary: 'hsl(var(--sidebar-primary))',

        200: 'var(--color-destructive-200)',    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',

        300: 'var(--color-destructive-300)',    				accent: 'hsl(var(--sidebar-accent))',

        400: 'var(--color-destructive-400)',    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',

        500: 'var(--color-destructive-500)',    				border: 'hsl(var(--sidebar-border))',

        600: 'var(--color-destructive-600)',    				ring: 'hsl(var(--sidebar-ring))'

        700: 'var(--color-destructive-700)',    			}

        800: 'var(--color-destructive-800)',    		},

        900: 'var(--color-destructive-900)',    		borderRadius: {

      },    			lg: 'var(--radius)',

      info: {    			md: 'calc(var(--radius) - 2px)',

        50: 'var(--color-info-50)',    			sm: 'calc(var(--radius) - 4px)'

        100: 'var(--color-info-100)',    		},

        200: 'var(--color-info-200)',    		keyframes: {

        300: 'var(--color-info-300)',    			'accordion-down': {

        400: 'var(--color-info-400)',    				from: {

        500: 'var(--color-info-500)',    					height: '0'

        600: 'var(--color-info-600)',    				},

        700: 'var(--color-info-700)',    				to: {

        800: 'var(--color-info-800)',    					height: 'var(--radix-accordion-content-height)'

        900: 'var(--color-info-900)',    				}

      },    			},

      neutral: {    			'accordion-up': {

        50: 'var(--color-neutral-50)',    				from: {

        100: 'var(--color-neutral-100)',    					height: 'var(--radix-accordion-content-height)'

        200: 'var(--color-neutral-200)',    				},

        300: 'var(--color-neutral-300)',    				to: {

        400: 'var(--color-neutral-400)',    					height: '0'

        500: 'var(--color-neutral-500)',    				}

        600: 'var(--color-neutral-600)',    			},

        700: 'var(--color-neutral-700)',    			'collapsible-down': {

        800: 'var(--color-neutral-800)',    				from: {

        900: 'var(--color-neutral-900)',    					height: 0

        950: 'var(--color-neutral-950)',    				},

      },    				to: {

      /* Semantic Aliases */    					height: 'var(--radix-collapsible-content-height)'

      background: 'var(--color-background)',    				}

      surface: 'var(--color-surface)',    			},

      'surface-secondary': 'var(--color-surface-secondary)',    			'collapsible-up': {

      border: 'var(--color-border)',    				from: {

      'border-subtle': 'var(--color-border-subtle)',    					height: 'var(--radix-collapsible-content-height)'

      muted: 'var(--color-muted)',    				},

      'muted-foreground': 'var(--color-muted-foreground)',    				to: {

      /* Text Colors */    					height: 0

      foreground: 'var(--color-text-primary)',    				}

      'text-primary': 'var(--color-text-primary)',    			},

      'text-secondary': 'var(--color-text-secondary)',    			/*'shine': {

      'text-tertiary': 'var(--color-text-tertiary)',    				'0%': { 'background-position': '100%' },

      'text-disabled': 'var(--color-text-disabled)',    				'100%': { 'background-position': '-100%' },

      'text-inverse': 'var(--color-text-inverse)',    			},*/

      'text-success': 'var(--color-text-success)',    			'star-movement-bottom': {

      'text-warning': 'var(--color-text-warning)',    				'0%': { transform: 'translate(0%, 0%)', opacity: '1' },

      'text-destructive': 'var(--color-text-destructive)',    				'100%': { transform: 'translate(-100%, 0%)', opacity: '0' },

      'text-info': 'var(--color-text-info)',    			},

      /* Legacy Shadcn/UI colors - compatibility */    			'star-movement-top': {

      card: 'var(--color-surface)',    				'0%': { transform: 'translate(0%, 0%)', opacity: '1' },

      'card-foreground': 'var(--color-text-primary)',    				'100%': { transform: 'translate(100%, 0%)', opacity: '0' },

      popover: 'var(--color-background)',    			},

      'popover-foreground': 'var(--color-text-primary)',    		},

      'primary-foreground': 'var(--color-text-inverse)',    		animation: {

      secondary: {    			'accordion-down': 'accordion-down 0.2s ease-out',

        DEFAULT: 'var(--color-surface)',    			'accordion-up': 'accordion-up 0.2s ease-out',

        foreground: 'var(--color-text-primary)',    			'collapsible-down': 'collapsible-down 0.2s ease-out',

      },    			'collapsible-up': 'collapsible-up 0.2s ease-out',

      accent: {    			/*'shine': 'shine 5s linear infinite',*/

        DEFAULT: 'var(--color-primary-100)',    			/*'star-movement-bottom': 'star-movement-bottom linear infinite alternate',*/

        foreground: 'var(--color-text-primary)',    			/*'star-movement-top': 'star-movement-top linear infinite alternate',*/

      },    		}

      input: 'var(--color-border)',    	}

      ring: 'var(--color-primary-600)',    },

      /* Charts */	plugins: [

      chart: {		require('@tailwindcss/container-queries'),

        '1': 'hsl(var(--chart-1))',		require('tailwindcss-animate')

        '2': 'hsl(var(--chart-2))',	],

        '3': 'hsl(var(--chart-3))',} 
        '4': 'hsl(var(--chart-4))',
        '5': 'hsl(var(--chart-5))'
      },
      /* Sidebar */
      sidebar: {
        DEFAULT: 'hsl(var(--sidebar-background))',
        foreground: 'hsl(var(--sidebar-foreground))',
        primary: 'hsl(var(--sidebar-primary))',
        'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
        accent: 'hsl(var(--sidebar-accent))',
        'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
        border: 'hsl(var(--sidebar-border))',
        ring: 'hsl(var(--sidebar-ring))'
      }
    },
    /* ────────────────────────────────────────────────────────────────
       DESIGN SYSTEM SPACING - 4px Grid
       ──────────────────────────────────────────────────────────────── */
    spacing: {
      0: 'var(--spacing-0)',
      1: 'var(--spacing-1)',
      2: 'var(--spacing-2)',
      3: 'var(--spacing-3)',
      4: 'var(--spacing-4)',
      5: 'var(--spacing-5)',
      6: 'var(--spacing-6)',
      7: 'var(--spacing-7)',
      8: 'var(--spacing-8)',
      10: 'var(--spacing-10)',
      12: 'var(--spacing-12)',
      14: 'var(--spacing-14)',
      16: 'var(--spacing-16)',
      20: 'var(--spacing-20)',
      24: 'var(--spacing-24)',
      28: 'var(--spacing-28)',
      32: 'var(--spacing-32)',
      36: 'var(--spacing-36)',
      40: 'var(--spacing-40)',
      44: 'var(--spacing-44)',
      48: 'var(--spacing-48)',
    },
    /* ────────────────────────────────────────────────────────────────
       DESIGN SYSTEM TYPOGRAPHY
       ──────────────────────────────────────────────────────────────── */
    fontSize: {
      xs: 'var(--font-size-xs)',
      sm: 'var(--font-size-sm)',
      base: 'var(--font-size-base)',
      lg: 'var(--font-size-lg)',
      xl: 'var(--font-size-xl)',
      '2xl': 'var(--font-size-2xl)',
      '3xl': 'var(--font-size-3xl)',
      '4xl': 'var(--font-size-4xl)',
      '5xl': 'var(--font-size-5xl)',
      '6xl': 'var(--font-size-6xl)',
    },
    fontWeight: {
      normal: 'var(--font-weight-normal)',
      medium: 'var(--font-weight-medium)',
      semibold: 'var(--font-weight-semibold)',
      bold: 'var(--font-weight-bold)',
    },
    lineHeight: {
      tight: 'var(--line-height-tight)',
      normal: 'var(--line-height-normal)',
      relaxed: 'var(--line-height-relaxed)',
    },
    letterSpacing: {
      tight: 'var(--letter-spacing-tight)',
      normal: 'var(--letter-spacing-normal)',
      wide: 'var(--letter-spacing-wide)',
    },
    /* ────────────────────────────────────────────────────────────────
       DESIGN SYSTEM SHADOWS
       ──────────────────────────────────────────────────────────────── */
    boxShadow: {
      none: 'var(--shadow-none)',
      sm: 'var(--shadow-sm)',
      base: 'var(--shadow-base)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      xl: 'var(--shadow-xl)',
      '2xl': 'var(--shadow-2xl)',
      inset: 'var(--shadow-inset)',
      'inset-sm': 'var(--shadow-inset-sm)',
      focus: 'var(--shadow-focus)',
      'focus-ring': 'var(--shadow-focus-ring)',
    },
    /* ────────────────────────────────────────────────────────────────
       DESIGN SYSTEM BORDER RADIUS
       ──────────────────────────────────────────────────────────────── */
    borderRadius: {
      none: 'var(--radius-none)',
      xs: 'var(--radius-xs)',
      sm: 'var(--radius-sm)',
      base: 'var(--radius-base)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
      '2xl': 'var(--radius-2xl)',
      full: 'var(--radius-full)',
    },
    extend: {
      /* ────────────────────────────────────────────────────────────────
         DESIGN SYSTEM ANIMATIONS
         ──────────────────────────────────────────────────────────────── */
      duration: {
        instant: 'var(--duration-instant)',
        fastest: 'var(--duration-fastest)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
      },
      transitionTimingFunction: {
        'ease-out': 'var(--ease-out)',
        'ease-in': 'var(--ease-in)',
        'ease-in-out': 'var(--ease-in-out)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        },
        'collapsible-down': {
          from: {
            height: 0
          },
          to: {
            height: 'var(--radix-collapsible-content-height)'
          }
        },
        'collapsible-up': {
          from: {
            height: 'var(--radix-collapsible-content-height)'
          },
          to: {
            height: 0
          }
        },
        'star-movement-bottom': {
          '0%': { transform: 'translate(0%, 0%)', opacity: '1' },
          '100%': { transform: 'translate(-100%, 0%)', opacity: '0' },
        },
        'star-movement-top': {
          '0%': { transform: 'translate(0%, 0%)', opacity: '1' },
          '100%': { transform: 'translate(100%, 0%)', opacity: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
      }
    }
  },
  plugins: [
    require('@tailwindcss/container-queries'),
    require('tailwindcss-animate')
  ],
}
