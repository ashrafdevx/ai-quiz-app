export const typography = {
  fonts: {
    heading: 'Syne_700Bold',
    body:    'Inter_400Regular',
    mono:    'JetBrainsMono_400Regular',
  },
  scale: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:   24,
    '2xl': 30,
    '3xl': 38,
  },
  weights: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
    black:    '900' as const,
  },
} as const;
