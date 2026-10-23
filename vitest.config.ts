import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: [...configDefaults.exclude, "**/dist/**", "**/test/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Start-up, Nest modules, environment and TypeORM persistence are
      // checked by the e2e tests (test:e2e, Docker), not by these
      exclude: [
        "**/*.d.ts",
        "**/*.spec.ts",
        "src/main.ts",
        "**/*.module.ts",
        "src/Infrastructure/Config/**",
        "src/Infrastructure/Persistence/**",
      ],
      // Just under the measure of 2026-10-23 (96.87 / 91.19 / 95.29 / 96.78).
      // Raise them, never lower them (T-17).
      thresholds: {
        statements: 95,
        branches: 89,
        functions: 93,
        lines: 95,
      },
    },
  },
});
