import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

export default function NavigationIcon({ name, color }: { name: string; color: string }) {
  return <Svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {name === 'Home' && <Path d="M3 10 12 2.5 21 10v10a1 1 0 0 1-1 1h-5.5v-7h-5v7H4a1 1 0 0 1-1-1Z" fill={color} />}
    {name === 'Appointments' && <><Rect x={3} y={4.5} width={18} height={17} rx={2} /><Path d="M3 9h18M7 2v5M17 2v5" /></>}
    {name === 'Alerts' && <><Path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><Path d="M9.5 21a3 3 0 0 0 5 0" /></>}
    {name === 'Profile' && <><Circle cx={12} cy={7} r={4} /><Path d="M4 21a8 8 0 0 1 16 0Z" /></>}
  </Svg>;
}
