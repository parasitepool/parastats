import nextPlugin from 'eslint-config-next';

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.mjs',
    ],
  },
  ...nextPlugin,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn"
    }
  }
];

export default eslintConfig;
