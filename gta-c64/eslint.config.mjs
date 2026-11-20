import globals from 'globals';

export default [
  { ignores: ['usbsid-player/**', 'node_modules/**', 'desktop/dist/**', 'desktop/node_modules/**', 'desktop/src-tauri/**'] },
  {
    // The desktop app's build and test scripts, run with Node.
    files: ['desktop/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    rules: { 'no-undef': 'error' },
  },
  {
    files: ['desktop/*.cjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
    rules: { 'no-undef': 'error' },
  },
  {
    files: ['js/**/*.js', 'sidplayer.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.browser },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { caughtErrors: 'none', argsIgnorePattern: '^_' }] },
  },
  {
    // The bridge's helper window: a classic script in its own page.
    files: ['tools/presence-bridge/relay/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: globals.browser },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { caughtErrors: 'none' }] },
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
