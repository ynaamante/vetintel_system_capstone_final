// Shared veterinary palette used across VetIntel and Petwatch.
export const colors = {
  deepForest: '#075F4F',
  botanicalTeal: '#087A70',
  eucalyptus: '#6F9D8D',
  paleSage: '#E1EFE8',
  warmIvory: '#F7F8F5',
  white: '#FFFFFF',

  // Compatibility aliases used throughout existing Petwatch screens.
  teal: '#087A70',
  blue: '#087A70',
  violet: '#6F9D8D',
  deepSpace: '#12352D',
  primary: '#087A70',
  ink: '#1F2D28',
  slate: '#526B62',
  slateLight: '#6F8178',
  mist: '#91A79C',
  fog: '#D5E3DB',
  cloud: '#E1EFE8',
  paper: '#F7F8F5',

  // Semantic colors remain distinct from the brand palette.
  success: '#16845B',
  successBg: '#E1EFE8',
  warning: '#B7791F',
  warningBg: '#FFF4D6',
  danger: '#C53E3E',
  dangerBg: '#FCE9E7',
  secondary: '#6F9D8D',
  secondaryBg: '#E1EFE8',

  light: {
    background: '#F7F8F5',
    surface: '#FFFFFF',
    border: '#D5E3DB',
    inputBg: '#F7F8F5',
    text: '#1F2D28',
    textSecondary: '#526B62',
    textMuted: '#71877C',
  },

  dark: {
    background: '#10251F',
    surface: '#18362E',
    border: '#3D6859',
    inputBg: '#18362E',
    text: '#F7F8F5',
    textSecondary: '#D2E5DC',
    textMuted: '#A9C3B7',
  },
};

export const gradients = {
  brand: ['#075F4F', '#087A70', '#6F9D8D'] as const,
  brandSubtle: ['#075F4F22', '#087A7022', '#6F9D8D22'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};
