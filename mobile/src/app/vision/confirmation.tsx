// Écran du module de vision (Lionel) hébergé dans Expo Router : voir src/vision/EcranVision.tsx.
import ConfirmationScreen from '../../../vision/screens/ConfirmationScreen';
import { EcranVision } from '../../vision/EcranVision';

export default function EcranConfirmation() {
  return <EcranVision ecran="ConfirmationScreen" Composant={ConfirmationScreen} />;
}
