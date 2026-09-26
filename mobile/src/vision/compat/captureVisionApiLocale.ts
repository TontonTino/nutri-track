// Remplaçant de `mobile/vision/api/captureVisionApi.js` (substitution Metro, voir metro-aliases.js).
// Mêmes signatures que le module de Lionel, mais AUCUN appel réseau : la décision de l'agent (confirmer, corriger ou
// rejeter) est gardée sur le téléphone, ce qui permet la capture assistée hors ligne (cahier des charges §6.4, §10.3).
// Le dépistage lui-même est enregistré ensuite par le flux normal (API ou file hors ligne), une seule fois.
import { enregistrerCapture, enregistrerDecision, type StatutValidation } from '../session';

interface PayloadCapture {
  valeur_estimee?: number | null;
  score_confiance?: number | null;
  methode_mesure?: string;
  [autre: string]: unknown;
}

interface DecisionAgent {
  statut: StatutValidation;
  valeur_validee: number | null;
  date_validation?: string;
  [autre: string]: unknown;
}

export async function postCaptureVision(payload: PayloadCapture) {
  const id = enregistrerCapture(payload);
  return { id, ...payload };
}

export async function putCaptureValidation(captureId: string, decision: DecisionAgent) {
  if (!captureId) throw new Error('captureId requis');
  enregistrerDecision(captureId, decision);
  return { id: captureId, ...decision };
}
