/*
 * @Author: tonyYo
 * @Date: 1985-10-26 16:15:00
 * @LastEditors: tonyYo
 * @LastEditTime: 2025-05-14 10:03:09
 * @FilePath: /expo-webrtc-demo/app/_layout.tsx
 */
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'route-link/index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="route-link/index" options={{ headerShown: false,  orientation:'portrait_up' }}/>
        <Stack.Screen 
          name="viewer/index" 
          options={{ 
            headerShown: false, 
            orientation: 'landscape'  // 添加这行来强制横屏
          }}
        />
        <Stack.Screen 
          name="master/index" 
          options={{ 
            headerShown: false, 
            orientation: 'landscape'  // 添加这行来强制横屏
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
