// Écran du module de vision (Lionel) hébergé dans Expo Router : voir src/vision/EcranVision.tsx.
import PBCaptureScreen from '../../../vision/screens/PBCaptureScreen';
import { EcranVision } from '../../vision/EcranVision';

export default function EcranCapture() {
  return <EcranVision ecran="PBCaptureScreen" Composant={PBCaptureScreen} />;
}
