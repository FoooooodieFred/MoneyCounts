import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "public/**",
      "vite.config.js",
      "build/**",
      "desktop/dist/**",
      "desktop/build/**",
      "desktop/wailsjs/**",
      "wailsjs/**",
      "src/lib/bloub/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Classic hooks rules only — React Compiler-style rules would error on
      // existing intentional patterns (setState-in-effect, etc.) without behavior change.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  eslintConfigPrettier,
);
