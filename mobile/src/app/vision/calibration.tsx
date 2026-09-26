// Écran du module de vision (Lionel) hébergé dans Expo Router : voir src/vision/EcranVision.tsx.
import CalibrationScreen from '../../../vision/screens/CalibrationScreen';
import { EcranVision } from '../../vision/EcranVision';

export default function EcranCalibration() {
  return <EcranVision ecran="CalibrationScreen" Composant={CalibrationScreen} />;
}
