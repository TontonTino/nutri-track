// Adaptateur de navigation : les écrans de Lionel sont écrits pour React Navigation (`navigation.navigate('NomEcran', params)`,
// `route.params`), l'app utilise Expo Router. Cette couche traduit l'un dans l'autre, sans modifier ses écrans.
import { definirParametres, lireParametres } from './session';

export const ROUTES_VISION: Record<string, string> = {
  PBCaptureScreen: '/vision/capture',
  CalibrationScreen: '/vision/calibration',
  ConfirmationScreen: '/vision/confirmation',
  CaptureFailScreen: '/vision/echec',
};

// Écran vers lequel « Retour au dépistage » (popToTop) ramène : le formulaire qui a lancé la capture.
export const ROUTE_RETOUR_FORMULAIRE = '/enfant';

export interface RouteurMinimal {
  navigate(chemin: string): void;
  back(): void;
  canGoBack(): boolean;
  dismiss(nombre?: number): void;
  dismissTo(chemin: string): void;
}

export interface NavigationCompatible {
  navigate(nom: string, params?: Record<string, unknown>): void;
  goBack(): void;
  canGoBack(): boolean;
  pop(nombre?: number): void;
  popToTop(): void;
}

export function creerNavigation(routeur: RouteurMinimal): NavigationCompatible {
  return {
    navigate(nom, params = {}) {
      const chemin = ROUTES_VISION[nom];
      if (!chemin) throw new Error(`Écran de vision inconnu : ${nom}`);
      definirParametres(nom, params);
      routeur.navigate(chemin);
    },
    goBack: () => routeur.back(),
    canGoBack: () => routeur.canGoBack(),
    pop: (nombre = 1) => routeur.dismiss(nombre),
    // dismissTo remonte jusqu'au formulaire déjà ouvert (et conserve ce qui y a été saisi) ; navigate en aurait ouvert un second.
    popToTop: () => routeur.dismissTo(ROUTE_RETOUR_FORMULAIRE),
  };
}

export function creerRoute(nom: string): { params: Record<string, unknown> } {
  return { params: lireParametres(nom) };
}
