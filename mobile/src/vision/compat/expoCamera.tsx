// Couche de compatibilité `expo-camera` pour le module de Lionel (substitution Metro, voir metro-aliases.js).
// Son code écrit `<Camera ref={...} type={CameraType.back} ratio="16:9" />` et appelle `Camera.requestCameraPermissionsAsync()`.
// Dans le SDK 57, `Camera` n'est plus un composant : on l'expose ici comme un composant qui délègue à <CameraView>.
import { Camera as PermissionsCamera, CameraView } from 'expo-camera';
import { type ComponentProps, forwardRef } from 'react';

export const CameraType = { back: 'back', front: 'front' } as const;

type PropsCamera = Omit<ComponentProps<typeof CameraView>, 'facing'> & {
  type?: 'back' | 'front';
};

const CameraCompatible = forwardRef<CameraView, PropsCamera>(function CameraCompatible({ type = 'back', ...reste }, ref) {
  return <CameraView ref={ref} facing={type} {...reste} />;
});

// `ref.takePictureAsync({ quality, base64, skipProcessing })` est fourni tel quel par CameraView.
export const Camera = Object.assign(CameraCompatible, {
  requestCameraPermissionsAsync: PermissionsCamera.requestCameraPermissionsAsync,
  getCameraPermissionsAsync: PermissionsCamera.getCameraPermissionsAsync,
});

export { CameraView };
