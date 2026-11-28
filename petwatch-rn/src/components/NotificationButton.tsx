import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useOwnerNotifications } from '../context/OwnerNotificationsContext';

export default function NotificationButton() {
  const navigation = useNavigation<any>();
  const { notifications } = useOwnerNotifications();
  const unread = notifications.some(item => !item.read && !/outbreak|disease|epidemic/i.test(item.type));
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={unread ? 'Open notifications, unread notifications' : 'Open notifications'} onPress={() => navigation.navigate('Notifications')} style={s.icon}>
    <Ionicons name="notifications-outline" size={22} color="#E7F4EC" />
    {unread && <View style={s.dot} />}
  </TouchableOpacity>;
}

const s = StyleSheet.create({
  icon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: 5, top: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: '#00D61B' },
});
