// Configuration Metro : configuration Expo par défaut + substitutions pour le module de vision (voir metro-aliases.js).
const { getDefaultConfig } = require('expo/metro-config');
const { resoudreAlias } = require('./metro-aliases');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, nomModule, plateforme) => {
  const cible = resoudreAlias(nomModule, context.originModulePath, __dirname);
  if (cible) return { type: 'sourceFile', filePath: cible };
  return context.resolveRequest(context, nomModule, plateforme);
};

module.exports = config;
