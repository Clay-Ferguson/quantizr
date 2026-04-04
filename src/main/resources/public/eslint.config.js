import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import typescript from "@typescript-eslint/parser";

export default [
  eslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,jsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parser: typescript,
      parserOptions: {
        project: true,
        tsconfigRootDir: ".", 
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // "react-hooks/rules-of-hooks": "error",
      // "react-hooks/exhaustive-deps": "warn",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-debugger": "off",
      "no-undef": "off",
      "no-extra-semi": "error",
      "prefer-const": "error",
      "no-extra-boolean-cast": "error",
      "prefer-spread": "off",
      "prefer-rest-params": "off",
      "no-async-promise-executor": "error",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/unbound-method": "error"
    },
  },
  {
    ignores: ["dist/**", "**/*.js", "**/vite.config.ts"],
  },
];
