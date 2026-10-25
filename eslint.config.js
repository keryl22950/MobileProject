// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Règle pensée pour le HTML : les apostrophes dans <Text> ne posent aucun problème en React Native.
      'react/no-unescaped-entities': 'off',
    },
  },
]);