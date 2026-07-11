import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the "@/..." path alias (matches tsconfig paths) so tests can import
// modules that reference sibling code via "@/lib/...".
export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
