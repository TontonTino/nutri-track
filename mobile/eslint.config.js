// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // sync/ (Rasmata) et vision/ (Lionel) sont des modules d'équipe avec leur propre style : non lintés ici.
    ignores: ["dist/*", "sync/**", "vision/**"],
  }
]);
