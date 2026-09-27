import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { resoudreAlias } from '../../metro-aliases';
import { creerNavigation, creerRoute, ROUTE_RETOUR_FORMULAIRE, ROUTES_VISION } from '../vision/navigation';
import { champsVision, MODE_SAISIE_VISION, PB_SOURCE_VISION, visionActive } from '../vision/mesureAssistee';
import {
  consommerResultat,
  definirParametres,
  enregistrerCapture,
  enregistrerDecision,
  lireParametres,
  reinitialiserSession,
} from '../vision/session';

const racine = path.resolve('/projet/mobile');
const depuisVision = path.join(racine, 'vision', 'screens', 'PBCaptureScreen.js');
const depuisApp = path.join(racine, 'src', 'app', 'enfant.tsx');

describe('resoudreAlias (substitutions Metro réservées au module de vision)', () => {
  it("remplace expo-camera par la couche de compatibilité, uniquement pour mobile/vision", () => {
    expect(resoudreAlias('expo-camera', depuisVision, racine)).toBe(path.join(racine, 'src', 'vision', 'compat', 'expoCamera.tsx'));
    expect(resoudreAlias('expo-camera', depuisApp, racine)).toBeNull();
  });
  it('remplace le client réseau de la confirmation par la version locale', () => {
    const cible = path.join(racine, 'src', 'vision', 'compat', 'captureVisionApiLocale.ts');
    expect(resoudreAlias('../api/captureVisionApi', depuisVision, racine)).toBe(cible);
    expect(resoudreAlias('../api/captureVisionApi.js', depuisVision, racine)).toBe(cible);
  });
  it("ne touche à aucun autre module ni à un fichier extérieur au module de vision", () => {
    expect(resoudreAlias('react-native', depuisVision, racine)).toBeNull();
    expect(resoudreAlias('../hooks/useCalibration', depuisVision, racine)).toBeNull();
    expect(resoudreAlias('../api/captureVisionApi', depuisApp, racine)).toBeNull();
    expect(resoudreAlias('expo-camera', undefined, racine)).toBeNull();
  });
  it('ignore la casse du chemin (Windows)', () => {
    expect(resoudreAlias('expo-camera', depuisVision.toUpperCase(), racine)).not.toBeNull();
  });
});

describe('session de capture', () => {
  beforeEach(() => reinitialiserSession());

  it('une confirmation produit une valeur exploitable, avec la traçabilité estimée / validée', () => {
    const id = enregistrerCapture({ valeur_estimee: 112.4, score_confiance: 0.62, methode_mesure: 'heuristique_calibration' });
    enregistrerDecision(id, { statut: 'confirmee', valeur_validee: 112.4, date_validation: '2026-09-26T10:00:00.000Z' });
    expect(consommerResultat()).toEqual({
      valeur_mm: 112.4,
      valeur_estimee_mm: 112.4,
      score_confiance: 0.62,
      statut: 'confirmee',
      methode: 'heuristique_calibration',
      date_validation: '2026-09-26T10:00:00.000Z',
    });
  });

  it("une correction garde l'estimation d'origine à côté de la valeur retenue", () => {
    const id = enregistrerCapture({ valeur_estimee: 140, score_confiance: 0.45, methode_mesure: 'saisie_manuelle' });
    enregistrerDecision(id, { statut: 'corrigee', valeur_validee: 118 });
    const r = consommerResultat();
    expect(r?.valeur_mm).toBe(118);
    expect(r?.valeur_estimee_mm).toBe(140);
    expect(r?.statut).toBe('corrigee');
  });

  it('une capture rejetée ne produit aucune valeur (aucune estimation sans confirmation)', () => {
    const id = enregistrerCapture({ valeur_estimee: 130 });
    enregistrerDecision(id, { statut: 'rejetee', valeur_validee: null });
    expect(consommerResultat()).toBeNull();
  });

  it("le résultat n'est lu qu'une fois, pour ne pas être réappliqué à chaque retour sur le formulaire", () => {
    const id = enregistrerCapture({ valeur_estimee: 120 });
    enregistrerDecision(id, { statut: 'confirmee', valeur_validee: 120 });
    expect(consommerResultat()).not.toBeNull();
    expect(consommerResultat()).toBeNull();
  });

  it('saisie directe sans estimation : ni valeur estimée ni confiance (Lionel envoie 0 par défaut)', () => {
    const id = enregistrerCapture({ valeur_estimee: null, score_confiance: 0, methode_mesure: 'saisie_manuelle' });
    enregistrerDecision(id, { statut: 'corrigee', valeur_validee: 111 });
    const r = consommerResultat();
    expect(r?.valeur_estimee_mm).toBeNull();
    expect(r?.score_confiance).toBeNull();
  });

  it('refuse une décision sur une capture inconnue et une valeur non numérique', () => {
    expect(() => enregistrerDecision('inconnue', { statut: 'confirmee', valeur_validee: 100 })).toThrow('Capture inconnue');
    const id = enregistrerCapture({ valeur_estimee: 100 });
    enregistrerDecision(id, { statut: 'confirmee', valeur_validee: Number.NaN });
    expect(consommerResultat()).toBeNull();
  });

  it('une nouvelle session efface la précédente', () => {
    definirParametres('PBCaptureScreen', { agent_id: 'a' });
    const id = enregistrerCapture({ valeur_estimee: 120 });
    enregistrerDecision(id, { statut: 'confirmee', valeur_validee: 120 });
    reinitialiserSession();
    expect(lireParametres('PBCaptureScreen')).toEqual({});
    expect(consommerResultat()).toBeNull();
  });
});

describe('navigation compatible React Navigation -> Expo Router', () => {
  beforeEach(() => reinitialiserSession());

  function faux() {
    const appels: string[] = [];
    const routeur = {
      navigate: (chemin: string) => appels.push(`navigate ${chemin}`),
      back: () => appels.push('back'),
      canGoBack: () => true,
      dismiss: (n?: number) => appels.push(`dismiss ${n}`),
      dismissTo: (chemin: string) => appels.push(`dismissTo ${chemin}`),
    };
    return { appels, navigation: creerNavigation(routeur) };
  }

  it("traduit navigate('NomEcran', params) en route Expo Router et transmet les paramètres via route.params", () => {
    const { appels, navigation } = faux();
    navigation.navigate('CalibrationScreen', { imageUri: 'file://photo.jpg', imageWidth: 1080 });
    expect(appels).toEqual(['navigate /vision/calibration']);
    expect(creerRoute('CalibrationScreen').params).toEqual({ imageUri: 'file://photo.jpg', imageWidth: 1080 });
  });

  it('couvre les quatre écrans du module', () => {
    expect(Object.keys(ROUTES_VISION).sort()).toEqual(['CalibrationScreen', 'CaptureFailScreen', 'ConfirmationScreen', 'PBCaptureScreen']);
  });

  it('un écran inconnu est une erreur explicite', () => {
    expect(() => faux().navigation.navigate('EcranInexistant')).toThrow('Écran de vision inconnu');
  });

  it('pop(2) (Reprendre la capture) remonte de deux écrans ; popToTop revient au formulaire', () => {
    const { appels, navigation } = faux();
    navigation.pop(2);
    navigation.popToTop();
    navigation.goBack();
    // Régression : popToTop doit REVENIR au formulaire existant (dismissTo), pas en ouvrir un second (navigate),
    // sinon ce que l'agent a déjà saisi serait perdu.
    expect(appels).toEqual(['dismiss 2', `dismissTo ${ROUTE_RETOUR_FORMULAIRE}`, 'back']);
    expect(navigation.canGoBack()).toBe(true);
  });
});

describe('mesure assistée par la caméra', () => {
  const resultat = {
    valeur_mm: 112.4,
    valeur_estimee_mm: 118,
    score_confiance: 0.62,
    statut: 'corrigee' as const,
    methode: 'saisie_manuelle',
    date_validation: '2026-09-26T10:00:00.000Z',
  };

  it("utilise les valeurs de traçabilité attendues par Alya et par Rasmata", () => {
    expect(PB_SOURCE_VISION).toBe('vision_ai');
    expect(MODE_SAISIE_VISION).toBe('vision');
  });

  it("le PB reste assisté tant que l'agent ne le modifie pas", () => {
    expect(visionActive('112.4', resultat)).toBe(resultat);
    expect(visionActive('112,4', resultat)).toBe(resultat);
  });

  it("une valeur tapée à la main sur l'écran de confirmation (sans estimation) n'est PAS une mesure assistée", () => {
    const sansEstimation = { ...resultat, valeur_estimee_mm: null, score_confiance: null };
    expect(visionActive('112.4', sansEstimation)).toBeNull();
  });

  it("une valeur retapée à la main redevient une saisie manuelle", () => {
    expect(visionActive('113', resultat)).toBeNull();
    expect(visionActive('', resultat)).toBeNull();
    expect(visionActive('abc', resultat)).toBeNull();
    expect(visionActive('112.4', null)).toBeNull();
  });

  it("envoie l'estimation de l'IA distincte de la valeur validée par l'ASC", () => {
    expect(champsVision(resultat)).toEqual({
      pb_estime_vision: 118,
      pb_score_confiance: 0.62,
      pb_statut_validation: 'corrigee',
      pb_methode_mesure: 'saisie_manuelle',
    });
  });
});
