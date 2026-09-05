import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const NO_PROCESS_ENV = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message:
    "Read environment variables only in platform/integrations/config.ts or platform/auth/config.ts.",
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  // Conventions from README section "Conventions", enforced instead of reviewed.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "platform/integrations/config.ts",
      "platform/auth/config.ts",
      "*.config.ts",
      "*.config.mjs",
    ],
    rules: { "no-restricted-syntax": ["error", NO_PROCESS_ENV] },
  },
  {
    files: ["apps/**/*.ts", "apps/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@apps/*"], message: "An app must not import another app." },
            { group: ["@/*", "**/src/*"], message: "An app must not import from src/app." },
            {
              group: ["@platform/db/raw", "**/db/raw"],
              message: "Write through `db` from @platform/db/client so writes are audited.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
