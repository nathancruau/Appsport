import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Web-specific setup: meta tags + auto-update
if (typeof document !== 'undefined') {
  // Fix iOS PWA status bar and safe areas
  const vp = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (vp) vp.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.00001, viewport-fit=cover';
  const addMeta = (name: string, content: string) => {
    let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  };
  addMeta('apple-mobile-web-app-capable', 'yes');
  addMeta('apple-mobile-web-app-status-bar-style', 'default');
  addMeta('theme-color', '#F5F5F7');
  document.documentElement.style.background = '#F5F5F7';
  if (document.body) document.body.style.background = '#F5F5F7';
  // PWA icon for home screen bookmark
  const addLink = (rel: string, href: string) => {
    let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
    el.setAttribute('href', href);
  };
  addLink('apple-touch-icon', '/Appsport/icon.png');

  // Auto-update: detect new version via version.json, then unregister SW and reload
  const VERSION_URL = '/Appsport/version.json';
  const checkUpdate = async () => {
    try {
      const r = await fetch(VERSION_URL + '?_=' + Date.now(), { cache: 'no-store' });
      const { v } = await r.json() as { v: string };
      const stored = localStorage.getItem('_appVer');
      if (!stored) {
        localStorage.setItem('_appVer', v);
      } else if (stored !== v) {
        // Unregister all service workers so the reload fetches fresh files from network
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
        }
        localStorage.setItem('_appVer', v);
        window.location.reload();
      }
    } catch { /* offline or version file not yet deployed */ }
  };
  checkUpdate();
  // Re-check each time user returns to the tab/app
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
}
import { initDB } from './src/database/database';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/theme';

function LoadingView() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    </SafeAreaProvider>
  );
}

function AppReady() {
  const { loading } = useAuth();
  if (loading) return <LoadingView />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDB().then(() => setDbReady(true)).catch(console.error);
  }, []);

  if (!dbReady) return <LoadingView />;

  return (
    <AuthProvider>
      <AppReady />
    </AuthProvider>
  );
}
