// Modern Design System for SplitChey
export const DesignSystem = {
  // Color Palette - Modern, accessible colors
  colors: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9', // Main primary
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    secondary: {
      50: '#fdf4ff',
      100: '#fae8ff',
      200: '#f5d0fe',
      300: '#f0abfc',
      400: '#e879f9',
      500: '#d946ef', // Main secondary
      600: '#c026d3',
      700: '#a21caf',
      800: '#86198f',
      900: '#701a75',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e', // Main success
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b', // Main warning
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444', // Main error
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    neutral: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
    },
  },

  // Typography Scale
  typography: {
    fontSizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
    },
    fontWeights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
    lineHeights: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  // Spacing Scale (8px base)
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
    24: 96,
  },

  // Border Radius
  borderRadius: {
    none: 0,
    sm: 4,
    base: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    full: 9999,
  },

  // Shadows
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    base: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 10,
    },
  },

  // Animation Durations
  animation: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
};

// Component Variants
export const ComponentVariants = {
  button: {
    primary: {
      backgroundColor: DesignSystem.colors.primary[500],
      borderRadius: DesignSystem.borderRadius.md,
      paddingVertical: DesignSystem.spacing[3],
      paddingHorizontal: DesignSystem.spacing[6],
      ...DesignSystem.shadows.base,
    },
    secondary: {
      backgroundColor: DesignSystem.colors.secondary[500],
      borderRadius: DesignSystem.borderRadius.md,
      paddingVertical: DesignSystem.spacing[3],
      paddingHorizontal: DesignSystem.spacing[6],
      ...DesignSystem.shadows.base,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: DesignSystem.colors.primary[500],
      borderRadius: DesignSystem.borderRadius.md,
      paddingVertical: DesignSystem.spacing[3],
      paddingHorizontal: DesignSystem.spacing[6],
    },
    ghost: {
      backgroundColor: 'transparent',
      borderRadius: DesignSystem.borderRadius.md,
      paddingVertical: DesignSystem.spacing[3],
      paddingHorizontal: DesignSystem.spacing[6],
    },
  },
  card: {
    default: {
      backgroundColor: '#ffffff',
      borderRadius: DesignSystem.borderRadius.xl,
      padding: DesignSystem.spacing[6],
      ...DesignSystem.shadows.base,
    },
    elevated: {
      backgroundColor: '#ffffff',
      borderRadius: DesignSystem.borderRadius.xl,
      padding: DesignSystem.spacing[6],
      ...DesignSystem.shadows.lg,
    },
  },
  input: {
    default: {
      borderRadius: DesignSystem.borderRadius.md,
      borderWidth: 1.5,
      borderColor: DesignSystem.colors.neutral[300],
      paddingVertical: DesignSystem.spacing[3],
      paddingHorizontal: DesignSystem.spacing[4],
      fontSize: DesignSystem.typography.fontSizes.base,
    },
    focused: {
      borderColor: DesignSystem.colors.primary[500],
      ...DesignSystem.shadows.base,
    },
    error: {
      borderColor: DesignSystem.colors.error[500],
    },
  },
};