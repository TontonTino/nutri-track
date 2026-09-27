// Héberge un écran du module de Lionel dans Expo Router en lui fournissant les props `navigation` et `route`
// qu'il attend (React Navigation). Voir navigation.ts.
import { useRouter } from 'expo-router';
import { type ComponentType, useMemo } from 'react';
import { creerNavigation, creerRoute } from './navigation';

interface Props {
  ecran: string; // nom de l'écran dans le module de Lionel, ex. 'PBCaptureScreen'
  Composant: ComponentType<{ navigation: unknown; route: unknown }>;
}

export function EcranVision({ ecran, Composant }: Props) {
  const routeur = useRouter();
  const navigation = useMemo(() => creerNavigation(routeur), [routeur]);
  return <Composant navigation={navigation} route={creerRoute(ecran)} />;
}
