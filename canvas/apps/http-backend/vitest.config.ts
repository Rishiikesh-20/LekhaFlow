import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.test.ts"],
		clearMocks: true,
	},
	resolve: {
		alias: {
			"@repo/http-core": path.resolve(
				__dirname,
				"../../packages/http-core/src/index.ts",
			),
			"@repo/common": path.resolve(
				__dirname,
				"../../packages/common/src/index.ts",
			),
			"@repo/supabase": path.resolve(
				__dirname,
				"../../packages/supabase/src/index.ts",
			),
		},
	},
});
