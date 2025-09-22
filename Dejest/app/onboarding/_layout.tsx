import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="create-account" options={{ headerShown: false }} />
      <Stack.Screen name="import-wallet" options={{ headerShown: false }} />
      <Stack.Screen name="seed-phrase" options={{ headerShown: false }} />
      <Stack.Screen name="verify-seed-phrase" options={{ headerShown: false }} />
    </Stack>
  );
}

