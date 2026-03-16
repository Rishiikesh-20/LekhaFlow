import { HttpError } from "@repo/http-core";
import { StatusCodes } from "http-status-codes";

type ServerEnv = {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_KEY: string;
	SUPABASE_ANON_KEY: string;
	NODE_ENV: string;
	WS_PORT: string;
};

function assertServerEnv(
	env: Record<keyof ServerEnv, string | undefined>,
): asserts env is ServerEnv {
	for (const [key, value] of Object.entries(env)) {
		if (!value) {
			throw new HttpError(
				`Server environment variable ${key} is not set`,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}
}

const _serverEnv = {
	SUPABASE_URL: process.env.SUPABASE_URL,
	SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
	SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
	NODE_ENV: process.env.NODE_ENV ?? "development",
	WS_PORT: process.env.WS_PORT,
};

assertServerEnv(_serverEnv);

export const serverEnv: ServerEnv = _serverEnv;
