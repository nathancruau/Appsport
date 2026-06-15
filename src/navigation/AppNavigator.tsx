import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { RootStackParamList, MainTabParamList } from '../types';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ExercisesScreen from '../screens/ExercisesScreen';
import StatsScreen from '../screens/StatsScreen';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import ExerciseDetailScreen from '../screens/ExerciseDetailScreen';
import CustomTabBar from './CustomTabBar';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Exercises" component={ExercisesScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.primary,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="ActiveWorkout"
          component={ActiveWorkoutScreen}
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="WorkoutDetail"
          component={WorkoutDetailScreen}
          options={{ headerShown: true, title: 'Séance', headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.text }}
        />
        <Stack.Screen
          name="ExerciseDetail"
          component={ExerciseDetailScreen}
          options={({ route }) => ({
            headerShown: true,
            title: route.params.exerciseName,
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTintColor: theme.colors.text,
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
