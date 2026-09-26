// Substitutions de modules pour le module de vision de Lionel (mobile/vision), SANS modifier ses fichiers.
// Deux incompatibilités sont corrigées ici, uniquement pour les fichiers situés dans mobile/vision :
//  1. `expo-camera` : son code utilise l'ancienne API (<Camera type={CameraType.back}>), retirée du SDK 57 où `Camera`
//     n'est plus un composant. Il reçoit une couche de compatibilité au-dessus de <CameraView>.
//  2. `../api/captureVisionApi` : elle appelle un serveur factice (hors mode développement) et, côté API d'Alya,
//     `PUT /capture-vision/{id}/validation` crée elle-même un dépistage : l'appeler puis envoyer POST /depistage
//     compterait chaque dépistage assisté deux fois. La version locale garde la décision de l'agent sur le téléphone
//     (la vision doit fonctionner sans réseau) ; c'est ensuite le flux normal qui enregistre le dépistage, une seule fois.
// Quand Lionel aura adapté son module, ce fichier pourra être supprimé.
const path = require('path');

const minuscules = (chemin) => chemin.split(path.sep).join('/').toLowerCase();

function resoudreAlias(nomModule, cheminOrigine, racine) {
  if (!cheminOrigine) return null;
  const dossierVision = `${minuscules(path.join(racine, 'vision'))}/`;
  if (!minuscules(cheminOrigine).startsWith(dossierVision)) return null;

  if (nomModule === 'expo-camera') {
    return path.join(racine, 'src', 'vision', 'compat', 'expoCamera.tsx');
  }
  if (/(^|\/)api\/captureVisionApi(\.js)?$/.test(nomModule)) {
    return path.join(racine, 'src', 'vision', 'compat', 'captureVisionApiLocale.ts');
  }
  return null;
}

module.exports = { resoudreAlias };
