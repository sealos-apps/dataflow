import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "build/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
