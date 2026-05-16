import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#262626',
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          headerShadowVisible: false,
          headerBackTitle: '',
          contentStyle: { backgroundColor: '#FAFAFA' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'PhotoSort', headerShown: false }} />
        <Stack.Screen name="processing" options={{ title: 'Analyzing', headerShown: false }} />
        <Stack.Screen name="review" options={{ headerShown: false }} />
        <Stack.Screen name="caption" options={{ headerShown: false }} />
        <Stack.Screen name="publish" options={{ headerShown: false }} />
        <Stack.Screen name="face-setup" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
