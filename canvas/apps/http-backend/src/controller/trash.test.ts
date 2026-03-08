/**
 * ============================================================================
 * HTTP BACKEND — TRASH ROUTES TESTS
 * ============================================================================
 *
 * Tests for: GET /trash, PATCH /trash/restore/:id, DELETE /trash/purge/:id
 *
 * Uses the same vi.mock pattern as canvas-extended.test.ts — mocking the
 * service layer directly.
 */

import type { User } from "@supabase/supabase-js";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// Mock supabase (used by auth middleware)
vi.mock("../supabase.server", () => ({
	createServiceClient: vi.fn(),
}));

// Mock the trash service layer directly
vi.mock("../services/trash.js", () => ({
	getTrashService: vi.fn(),
	restoreCanvasService: vi.fn(),
	purgeCanvasService: vi.fn(),
}));

import { globalErrorHandler } from "../error/error";
import { trashRouter } from "../routes/trash";
import {
	getTrashService,
	purgeCanvasService,
	restoreCanvasService,
} from "../services/trash.js";
import { createServiceClient } from "../supabase.server";

const createServiceClientMock = createServiceClient as Mock;
const getTrashServiceMock = getTrashService as Mock;
const restoreCanvasServiceMock = restoreCanvasService as Mock;
const purgeCanvasServiceMock = purgeCanvasService as Mock;

const createTestApp = () => {
	const app = express();
	app.use(express.json());
	app.use("/api/v1/trash", trashRouter);
	app.use(globalErrorHandler);
	return app;
};

/** Mock successful auth middleware (sets req.user) */
const mockAuthSuccess = (userId = "user-123") => {
	const mockUser: Partial<User> = { id: userId, email: "test@example.com" };
	createServiceClientMock.mockReturnValue({
		auth: {
			getUser: vi.fn().mockResolvedValue({
				data: { user: mockUser },
				error: null,
			}),
		},
	});
};

// ============================================================================
// GET /api/v1/trash — List trashed items
// ============================================================================

describe("GET /api/v1/trash", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth header", async () => {
		const res = await request(app).get("/api/v1/trash");
		expect(res.status).toBe(401);
	});

	it("returns empty array when trash is empty", async () => {
		mockAuthSuccess();
		getTrashServiceMock.mockResolvedValue([]);

		const res = await request(app)
			.get("/api/v1/trash")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.data.items).toEqual([]);
	});

	it("returns deleted items when trash has items", async () => {
		mockAuthSuccess();
		getTrashServiceMock.mockResolvedValue([
			{
				id: "c1",
				name: "Deleted Canvas",
				is_deleted: true,
				deleted_at: "2026-03-05T12:00:00Z",
			},
			{
				id: "c2",
				name: "Another Deleted",
				is_deleted: true,
				deleted_at: "2026-03-04T12:00:00Z",
			},
		]);

		const res = await request(app)
			.get("/api/v1/trash")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.data.items).toHaveLength(2);
		expect(res.body.data.items[0].name).toBe("Deleted Canvas");
	});

	it("passes authenticated userId to service", async () => {
		mockAuthSuccess("user-abc");
		getTrashServiceMock.mockResolvedValue([]);

		await request(app)
			.get("/api/v1/trash")
			.set("Authorization", "Bearer valid-token");

		expect(getTrashServiceMock).toHaveBeenCalledWith("user-abc");
	});
});

// ============================================================================
// PATCH /api/v1/trash/restore/:id — Restore item from trash
// ============================================================================

describe("PATCH /api/v1/trash/restore/:id", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).patch("/api/v1/trash/restore/some-id");
		expect(res.status).toBe(401);
	});

	it("returns 200 on successful restore", async () => {
		mockAuthSuccess();
		restoreCanvasServiceMock.mockResolvedValue(undefined);

		const res = await request(app)
			.patch("/api/v1/trash/restore/canvas-abc")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.message).toContain("restored");
	});

	it("calls restoreCanvasService with correct args", async () => {
		mockAuthSuccess("user-xyz");
		restoreCanvasServiceMock.mockResolvedValue(undefined);

		await request(app)
			.patch("/api/v1/trash/restore/canvas-abc")
			.set("Authorization", "Bearer valid-token");

		expect(restoreCanvasServiceMock).toHaveBeenCalledWith(
			"canvas-abc",
			"user-xyz",
		);
	});
});

// ============================================================================
// DELETE /api/v1/trash/purge/:id — Permanently delete item
// ============================================================================

describe("DELETE /api/v1/trash/purge/:id", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).delete("/api/v1/trash/purge/some-id");
		expect(res.status).toBe(401);
	});

	it("returns 200 on successful purge", async () => {
		mockAuthSuccess();
		purgeCanvasServiceMock.mockResolvedValue(undefined);

		const res = await request(app)
			.delete("/api/v1/trash/purge/canvas-abc")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.message).toContain("permanently deleted");
	});

	it("calls purgeCanvasService with correct args", async () => {
		mockAuthSuccess("user-xyz");
		purgeCanvasServiceMock.mockResolvedValue(undefined);

		await request(app)
			.delete("/api/v1/trash/purge/canvas-abc")
			.set("Authorization", "Bearer valid-token");

		expect(purgeCanvasServiceMock).toHaveBeenCalledWith(
			"canvas-abc",
			"user-xyz",
		);
	});
});
