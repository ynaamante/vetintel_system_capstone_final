import React, { useCallback } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { colors, gradients } from '../theme/colors';

const cornerRadius = 24;
const waveHeight = 22 + cornerRadius;

export const roundedScreenPanel = {
  flex: 1,
  borderTopLeftRadius: cornerRadius,
  borderTopRightRadius: cornerRadius,
  overflow: 'hidden',
} as const;

export default function HeaderSurface({ children }: React.PropsWithChildren) {
  const { top } = useSafeAreaInsets();
  useFocusEffect(useCallback(() => {
    StatusBar.setBarStyle('dark-content');
    return () => StatusBar.setBarStyle('default');
  }, []));

  return (
    <View style={styles.surface}>
      <LinearGradient
        pointerEvents="none"
        colors={gradients.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[StyleSheet.absoluteFill, { top: -top }]}
      />
      <View pointerEvents="none" style={styles.wave}>
        <Svg width="100%" height="100%" viewBox={`0 0 1000 ${waveHeight}`} preserveAspectRatio="none">
          <Path
            d={`M790 24 Q890 18 1000 14 V${waveHeight} H790 Z`}
            fill={colors.bannerEnd}
          />
          <Path
            d={`M-20 25 C125 12 310 6 480 6 C670 6 845 12 965 22 Q1000 25 1040 29 V${waveHeight} H-20 Z`}
            fill={colors.primary}
            fillOpacity={0.16}
          />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    // The panel overlaps this area, revealing the wave behind its rounded corners.
    paddingBottom: cornerRadius,
    marginBottom: -cornerRadius,
  },
  wave: { position: 'absolute', left: 0, right: 0, bottom: 0, height: waveHeight },
});
