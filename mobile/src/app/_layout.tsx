import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { BadgeSynchronisation } from '../components/BadgeSynchronisation';
import { BandeauDemo } from '../components/BandeauDemo';
import { couleurs } from '../constants/theme';
import { FournisseurSynchro } from '../data/SynchroContext';
import { useEchelle } from '../theme/useEchelle';

export default function RootLayout() {
  const t = useEchelle();
  return (
    <FournisseurSynchro>
      <StatusBar style="light" />
      <View style={styles.racine}>
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
          <Stack.Screen name="vision/capture" options={{ headerShown: false }} />
          <Stack.Screen name="vision/calibration" options={{ headerShown: false }} />
          <Stack.Screen name="vision/confirmation" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="vision/echec" options={{ headerShown: false }} />
        </Stack>
        <BadgeSynchronisation />
        <BandeauDemo />
      </View>
    </FournisseurSynchro>
  );
}

const styles = StyleSheet.create({ racine: { flex: 1 } });
