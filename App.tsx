import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { initializeDatabase } from './src/database/database';
import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/theme';

function LoadingView() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
    </View>
  );
}

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <SQLiteProvider
        databaseName="appsport.db"
        onInit={initializeDatabase}
        useSuspense={false}
      >
        <AppNavigator />
      </SQLiteProvider>
    </>
  );
}
