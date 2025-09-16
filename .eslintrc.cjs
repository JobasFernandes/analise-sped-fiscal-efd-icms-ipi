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
    'import/resolver': {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
      },
    },
  },
  plugins: ["react", "react-hooks", "import"],
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "import/no-unresolved": ["error", { commonjs: true, caseSensitive: true }],
  },
  overrides: [
    {
      files: ["**/*.test.*", "tests/**/*.*"],
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        vi: "readonly",
      },
      rules: {
        "no-console": "off",
      },
    },
  ],
};
