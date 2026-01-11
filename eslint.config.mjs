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
    }
  }
];

export default eslintConfig;
