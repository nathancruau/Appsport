import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Fix iOS PWA status bar and safe areas for web
if (typeof document !== 'undefined') {
  const vp = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (vp) vp.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.00001, viewport-fit=cover';
  const addMeta = (name: string, content: string) => {
    let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  };
  addMeta('apple-mobile-web-app-capable', 'yes');
  addMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  addMeta('theme-color', '#0F0F0F');
  document.documentElement.style.background = '#0F0F0F';
  if (document.body) document.body.style.background = '#0F0F0F';
}
import { initDB } from './src/database/database';
import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/theme';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDB().then(() => setReady(true)).catch(console.error);
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
