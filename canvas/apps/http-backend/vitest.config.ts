import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.test.ts"],
		clearMocks: true,
		env: {
			SUPABASE_URL: "http://localhost:54321",
			SUPABASE_SERVICE_KEY: "test-service-key",
			SUPABASE_ANON_KEY: "test-anon-key",
			NODE_ENV: "test",
			WS_PORT: "8080",
		},
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
