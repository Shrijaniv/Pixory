import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/schibsted-grotesk';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { Colors } from '../lib/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="new-story" />
        <Stack.Screen name="processing" options={{ gestureEnabled: false }} />
        <Stack.Screen name="review" options={{ gestureEnabled: false }} />
        <Stack.Screen name="caption" />
        <Stack.Screen name="publish" />
        <Stack.Screen name="instagram-connect" />
        <Stack.Screen name="success" options={{ gestureEnabled: false }} />
        <Stack.Screen name="profile" />
        <Stack.Screen name="story-detail" />
        <Stack.Screen name="taste" />
        <Stack.Screen name="face-setup" />
      </Stack>
    </View>
  );
}
