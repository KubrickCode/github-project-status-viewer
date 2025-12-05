import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      exclude: ["src/**/*.d.ts", "src/**/*.spec.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
    },
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.spec.ts"],
    restoreMocks: true,
    typecheck: {
      tsconfig: "./tsconfig.spec.json",
    },
  },
});
