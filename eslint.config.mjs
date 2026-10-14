// Kidify's ESLint configuration uses only explicitly declared tooling packages.
import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';

export default [
 { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'uploads/**'] },
 {
  files: ['apps/**/*.ts', 'scripts/**/*.ts'],
  languageOptions: { parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
  plugins: { '@typescript-eslint': plugin },
  rules: {
   // Unused decorator parameters are retained for Nest's injection/GraphQL contracts.
   '@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
   'no-unreachable': 'error',
  },
 },
];
