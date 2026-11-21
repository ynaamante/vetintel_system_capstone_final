// Shared veterinary palette used across VetIntel and Petwatch.
export const colors = {
  deepForest: '#013826',
  botanicalTeal: '#086B50',
  eucalyptus: '#A9D6B7',
  paleSage: '#E7F4EC',
  warmIvory: '#FAFBF8',
  white: '#FFFFFF',

  // Compatibility aliases used throughout existing Petwatch screens.
  teal: '#086B50',
  blue: '#086B50',
  violet: '#A9D6B7',
  deepSpace: '#12352D',
  primary: '#086B50',
  ink: '#14211C',
  slate: '#172B24',
  slateLight: '#34463D',
  mist: '#91A79C',
  fog: '#BED6C5',
  cloud: '#E7F4EC',
  paper: '#FAFBF8',

  // Semantic colors remain distinct from the brand palette.
  success: '#16845B',
  successBg: '#E7F4EC',
  warning: '#B7791F',
  warningBg: '#FFF4D6',
  danger: '#C53E3E',
  dangerBg: '#FCE9E7',
  secondary: '#086B50',
  secondaryBg: '#E7F4EC',

  light: {
    background: '#FAFBF8',
    surface: '#FFFFFF',
    border: '#BED6C5',
    inputBg: '#FAFBF8',
    text: '#14211C',
    textSecondary: '#172B24',
    textMuted: '#34463D',
  },

  dark: {
    background: '#10251F',
    surface: '#18362E',
    border: '#3D6859',
    inputBg: '#18362E',
    text: '#FAFBF8',
    textSecondary: '#D2E5DC',
    textMuted: '#A9C3B7',
  },
};

export const gradients = {
  brand: ['#013826', '#086B50', '#086B50'] as const,
  brandSubtle: ['#01382622', '#086B5022', '#A9D6B722'] as const,
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
