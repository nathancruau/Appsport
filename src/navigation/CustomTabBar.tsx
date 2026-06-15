import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, [IoniconName, IoniconName]> = {
  Home:      ['home',        'home-outline'],
  History:   ['time',        'time-outline'],
  Exercises: ['barbell',     'barbell-outline'],
  Stats:     ['stats-chart', 'stats-chart-outline'],
};

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom - 6, 2) }]}>
      <View style={styles.pill}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const [activeIcon, inactiveIcon] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={() => { if (!focused) navigation.navigate(route.name); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={focused ? activeIcon : inactiveIcon}
                size={26}
                color={focused ? theme.colors.text : theme.colors.textMuted}
              />
              {focused && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.colors.background,
    paddingTop: 4,
    paddingHorizontal: 20,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.text,
  },
});
