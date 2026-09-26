import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { couleurs } from '../constants/theme';
import { useEchelle } from '../theme/useEchelle';

export default function RootLayout() {
  const t = useEchelle();
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: couleurs.primaire },
          headerTintColor: '#FFFFFF',
          // Le titre de l'en-tête suit l'échelle de l'écran, comme le reste de l'interface.
          headerTitleStyle: { fontWeight: '700', fontSize: t.police.sousTitre },
          contentStyle: { backgroundColor: couleurs.fond },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'NUTRI-DÉPIST' }} />
        <Stack.Screen name="enfant" options={{ title: 'Dépistage — Enfant' }} />
        <Stack.Screen name="femme-enceinte" options={{ title: 'Dépistage — Femme enceinte' }} />
        <Stack.Screen name="personne-agee" options={{ title: 'Dépistage — Personne âgée' }} />
        <Stack.Screen name="resultat" options={{ title: 'Résultat', headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }} />
        <Stack.Screen name="historique" options={{ title: 'Historique' }} />
      </Stack>
    </>
  );
}
