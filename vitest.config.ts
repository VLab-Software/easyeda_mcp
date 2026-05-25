import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "extension/src/**/*.test.ts", "scripts/**/*.test.ts"]
  }
});
