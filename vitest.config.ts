import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Unit and component tests.
 *
 * Two projects so that pure logic tests stay fast (node environment, no DOM)
 * while component tests get jsdom. Neither touches a database: anything needing
 * real persistence belongs in the Playwright suite.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    passWithNoTests: false,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          setupFiles: ["./tests/setup/component.ts"],
          include: ["tests/component/**/*.test.tsx"],
        },
      },
    ],
  },
});
