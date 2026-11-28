import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import HeaderSurface from './HeaderSurface';
import NotificationButton from './NotificationButton';
import { colors } from '../theme/colors';

type Props = {
  title: string;
  subtitle?: string;
  subtitleLines?: number;
  onBack?: () => void;
  backDisabled?: boolean;
  home?: boolean;
  compact?: boolean;
};

export default function AppHeader({ title, subtitle, subtitleLines = 1, onBack, backDisabled, home, compact }: Props) {
  const navigation = useNavigation<any>();
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'Home' });
  };

  return (
    <HeaderSurface>
      <View style={s.header}>
        <View style={s.row}>
          {!home && (
            <TouchableOpacity accessibilityLabel="Go back" disabled={backDisabled} onPress={onBack || goBack} style={s.back}>
              <Ionicons name="arrow-back" size={21} color={colors.ink} />
            </TouchableOpacity>
          )}
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <View style={s.actions}>
            <TouchableOpacity accessibilityLabel="Open messages" onPress={() => navigation.navigate('Messages')} style={s.icon}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-6 4V5a2 2 0 0 1 2-2Z" />
                <Path d="M7 8h10M7 12h6" />
              </Svg>
            </TouchableOpacity>
            <NotificationButton />
          </View>
        </View>
        {!compact && (
          <Text
            style={s.subtitle}
            numberOfLines={subtitleLines}
            accessibilityElementsHidden={!subtitle}
            importantForAccessibility={subtitle ? 'auto' : 'no-hide-descendants'}
          >
            {subtitle || ' '}
          </Text>
        )}
      </View>
    </HeaderSurface>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  row: { height: 44, flexDirection: 'row', alignItems: 'center' },
  back: { width: 34, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  title: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.ink },
  actions: { flexDirection: 'row', gap: 2, marginLeft: 8 },
  icon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  subtitle: { minHeight: 17, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginLeft: 4 },
});
