/* ESLint config for React + Vite (JS/TS) with Vitest support */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  plugins: ["react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    // Keep noise low with --max-warnings 0
    "react/react-in-jsx-scope": "off", // Next.js/React 17+
    "react/prop-types": "off", // we are not using PropTypes
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  overrides: [
    {
      files: [
        "**/*.test.*",
        "tests/**/*.*",
      ],
      // Define Vitest globals without requiring a plugin/env
      globals: { describe: "readonly", it: "readonly", test: "readonly", expect: "readonly", beforeEach: "readonly", afterEach: "readonly", vi: "readonly" },
      rules: {
        "no-console": "off",
      },
    },
  ],
};
