import globals from 'globals';

export default [
  { ignores: ['usbsid-player/**', 'node_modules/**'] },
  {
    files: ['js/**/*.js', 'sidplayer.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.browser },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { caughtErrors: 'none', argsIgnorePattern: '^_' }] },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    rules: { 'no-undef': 'error' },
  },
  {
    files: ['tests/**/*.cjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node, window: 'readonly', document: 'readonly' } },
    rules: { 'no-undef': 'error' },
  },
];
