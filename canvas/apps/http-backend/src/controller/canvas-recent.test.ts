import type { User } from "@supabase/supabase-js";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../supabase.server", () => ({
	createServiceClient: vi.fn(),
}));

import { globalErrorHandler } from "../error/error";
import { canvasRouter } from "../routes/canvas";
import { createServiceClient } from "../supabase.server";

const createServiceClientMock = createServiceClient as Mock;

const createTestApp = () => {
	const app = express();
	app.use(express.json());
	app.use("/api/v1/canvas", canvasRouter);
	app.use(globalErrorHandler);
	return app;
};

describe("GET /api/v1/canvas/recent", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	describe("Case 1: Unauthorized access", () => {
		it("should return 401 when no Authorization header is provided", async () => {
			const response = await request(app).get("/api/v1/canvas/recent");

			expect(response.status).toBe(401);
		});

		it("should return 401 when token is invalid", async () => {
			const getUserMock = vi.fn().mockResolvedValue({
				data: { user: null },
				error: new Error("Invalid token"),
			});

			createServiceClientMock.mockReturnValue({
				auth: { getUser: getUserMock },
			});

			const response = await request(app)
				.get("/api/v1/canvas/recent")
				.set("Authorization", "Bearer invalid_token");

			expect(response.status).toBe(401);
		});
	});

	describe("Case 2: Successful retrieval", () => {
		it("should return recent canvases with valid auth", async () => {
			const mockUser: Partial<User> = {
				id: "user_123",
				email: "test@example.com",
			};

			const getUserMock = vi.fn().mockResolvedValue({
				data: { user: mockUser },
				error: null,
			});

			const mockCanvases = [
				{
					id: "canvas_1",
					name: "Recent Canvas 1",
					last_accessed_at: "2026-03-07T10:00:00Z",
					is_deleted: false,
					owner_id: "user_123",
				},
				{
					id: "canvas_2",
					name: "Recent Canvas 2",
					last_accessed_at: "2026-03-06T10:00:00Z",
					is_deleted: false,
					owner_id: "user_123",
				},
			];

			const limitMock = vi.fn().mockResolvedValue({
				data: mockCanvases,
				error: null,
			});

			const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
			const notMock = vi.fn().mockReturnValue({
				order: orderMock,
			});
			const eqDeletedMock = vi.fn().mockReturnValue({ not: notMock });
			const eqOwnerMock = vi.fn().mockReturnValue({ eq: eqDeletedMock });
			const selectMock = vi.fn().mockReturnValue({ eq: eqOwnerMock });
			const fromMock = vi.fn().mockReturnValue({ select: selectMock });

			createServiceClientMock.mockReturnValue({
				from: fromMock,
				auth: { getUser: getUserMock },
			});

			const response = await request(app)
				.get("/api/v1/canvas/recent")
				.set("Authorization", "Bearer valid_token");

			expect(response.status).toBe(200);
			expect(response.body.data.canvases).toHaveLength(2);
			expect(response.body.data.canvases[0].id).toBe("canvas_1");
			expect(fromMock).toHaveBeenCalledWith("canvases");
		});
	});
});

describe("PATCH /api/v1/canvas/:roomId/touch", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	describe("Case 1: Unauthorized access", () => {
		it("should return 401 when no Authorization header is provided", async () => {
			const response = await request(app).patch(
				"/api/v1/canvas/canvas_123/touch",
			);

			expect(response.status).toBe(401);
		});
	});

	describe("Case 2: Successful touch", () => {
		it("should return 204 with valid auth", async () => {
			const mockUser: Partial<User> = {
				id: "user_123",
				email: "test@example.com",
			};

			const getUserMock = vi.fn().mockResolvedValue({
				data: { user: mockUser },
				error: null,
			});

			const eqOwnerMock = vi.fn().mockResolvedValue({
				data: null,
				error: null,
			});
			const eqIdMock = vi.fn().mockReturnValue({ eq: eqOwnerMock });
			const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock });
			const fromMock = vi.fn().mockReturnValue({ update: updateMock });

			createServiceClientMock.mockReturnValue({
				from: fromMock,
				auth: { getUser: getUserMock },
			});

			const response = await request(app)
				.patch("/api/v1/canvas/canvas_123/touch")
				.set("Authorization", "Bearer valid_token");

			expect(response.status).toBe(204);
		});
	});
});
