/**
 * PoseWebView.js
 * Fait tourner MoveNet (détection de pose) dans une WebView cachée, en
 * JavaScript web pur — PAS via @tensorflow/tfjs-react-native, abandonnée et
 * incompatible avec les versions récentes de React Native (peer dependency
 * bloquée sur async-storage v1, conflits confirmés en testant l'installation
 * sur ce projet). react-native-webview, lui, est activement maintenu et
 * fonctionne dans Expo Go.
 *
 * Compromis assumé : la première utilisation sur un téléphone doit pouvoir
 * charger TF.js + MoveNet depuis un CDN (quelques Mo). La WebView les met
 * ensuite en cache et les réutilise hors connexion. Sans réseau au tout
 * premier essai, ou si l'appareil est trop ancien/lent, la détection échoue
 * proprement et CalibrationScreen retombe sur la zone de guidage fixe
 * (comportement déjà testé, jamais de blocage pour l'agent).
 *
 * Usage :
 *   const poseRef = useRef(null);
 *   <PoseWebView ref={poseRef} />
 *   const resultat = await poseRef.current.detecterPose(base64Photo); // ou null
 */

import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// Généreux : le tout premier appel peut inclure le téléchargement du modèle.
const DELAI_PRET_MS = 15000;
const DELAI_ANALYSE_MS = 6000;

// Fichier chargé tel quel par la WebView — voir ce fichier pour la logique
// de détection elle-même (le "require" fonctionne avec react-native-webview
// pour un asset HTML local, sur Android comme iOS).
// eslint-disable-next-line import/no-unresolved
const PAGE_HTML = require('./poseWebView.html');

const PoseWebView = forwardRef(function PoseWebView(_props, ref) {
  const webviewRef = useRef(null);
  const [modeleEstPret, setModeleEstPret] = useState(false);
  const [modeleIndisponible, setModeleIndisponible] = useState(false);

  // Une seule requête à la fois : une Map de callbacks en attente n'est pas
  // nécessaire ici, le flux de l'app ne lance jamais deux analyses en
  // parallèle sur cette WebView.
  const enAttente = useRef(null);

  const surMessage = useCallback((event) => {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (data.type === 'pret') {
      console.log('[PoseWebView] Modèle de pose prêt, backend :', data.backend);
      setModeleEstPret(true);
      return;
    }

    if (data.type === 'erreur') {
      console.log('[PoseWebView] Échec (' + data.etape + ') :', data.message);
      if (!modeleEstPret) setModeleIndisponible(true);
      if (enAttente.current) {
        enAttente.current.resolve(null);
        enAttente.current = null;
      }
      return;
    }

    if (data.type === 'resultat' && enAttente.current) {
      enAttente.current.resolve(data.trouve ? data : null);
      enAttente.current = null;
    }
  }, [modeleEstPret]);

  const detecterPose = useCallback((base64) => {
    if (modeleIndisponible || !webviewRef.current) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      let etablie = false;
      const conclure = (valeur) => {
        if (etablie) return;
        etablie = true;
        resolve(valeur);
      };

      const attendrePret = Date.now();
      const attendre = () => {
        if (modeleEstPret) {
          lancerAnalyse();
          return;
        }
        if (Date.now() - attendrePret > DELAI_PRET_MS) {
          conclure(null); // modèle jamais prêt (pas de réseau, échec CDN…)
          return;
        }
        setTimeout(attendre, 150);
      };

      const lancerAnalyse = () => {
        enAttente.current = { resolve: conclure };
        webviewRef.current.postMessage(JSON.stringify({ type: 'analyser', base64 }));
        setTimeout(() => conclure(null), DELAI_ANALYSE_MS); // filet de sécurité
      };

      attendre();
    });
  }, [modeleEstPret, modeleIndisponible]);

  useImperativeHandle(ref, () => ({
    detecterPose,
    estDisponible: () => modeleEstPret && !modeleIndisponible,
  }), [detecterPose, modeleEstPret, modeleIndisponible]);

  return (
    <View style={styles.cachee} pointerEvents="none">
      <WebView
        ref={webviewRef}
        source={PAGE_HTML}
        originWhitelist={['*']}
        onMessage={surMessage}
        onError={() => setModeleIndisponible(true)}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
});

export default PoseWebView;

const styles = StyleSheet.create({
  // Ni display:none ni width/height:0 : certains moteurs WebView suspendent
  // le rendu (et donc l'exécution JS) d'une vue à taille nulle. 1x1 hors
  // écran garde la WebView active sans être visible pour l'agent.
  cachee: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
