const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Corrige un bug connu où Metro résout le mauvais fichier du package
// "firebase", ce qui empêche le module d'authentification de s'enregistrer
// correctement ("Component auth has not been registered yet").
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
