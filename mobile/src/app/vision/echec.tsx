// Écran du module de vision (Lionel) hébergé dans Expo Router : voir src/vision/EcranVision.tsx.
import CaptureFailScreen from '../../../vision/screens/CaptureFailScreen';
import { EcranVision } from '../../vision/EcranVision';

export default function EcranEchec() {
  return <EcranVision ecran="CaptureFailScreen" Composant={CaptureFailScreen} />;
}
