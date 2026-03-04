/**
 * ============================================================================
 * HTTP BACKEND — CANVAS ROUTES EXTENDED EDGE-CASE TESTS
 * ============================================================================
 *
 * Tests for: GET /canvas, GET /canvas/:roomId, PUT /canvas/:roomId,
 * DELETE /canvas/:roomId — validation, auth, and error paths.
 *
 * NOTE: services/canvas.ts caches `createServiceClient()` at module level,
 * so we mock the service functions directly instead of mocking supabase.
 */

import type { User } from "@supabase/supabase-js";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// Mock supabase (used by auth middleware)
vi.mock("../supabase.server", () => ({
	createServiceClient: vi.fn(),
}));

// Mock the service layer directly (avoids module-level client issue)
vi.mock("../services/canvas.js", () => ({
	createCanvasService: vi.fn(),
	getCanvasesService: vi.fn(),
	getCanvasService: vi.fn(),
	updateCanvasService: vi.fn(),
	deleteCanvasService: vi.fn(),
	searchCanvasesService: vi.fn(),
}));

import { globalErrorHandler } from "../error/error";
import { canvasRouter } from "../routes/canvas";
import {
	createCanvasService,
	deleteCanvasService,
	getCanvasesService,
	getCanvasService,
	searchCanvasesService,
	updateCanvasService,
} from "../services/canvas.js";
import { createServiceClient } from "../supabase.server";

const createServiceClientMock = createServiceClient as Mock;
const getCanvasesServiceMock = getCanvasesService as Mock;
const getCanvasServiceMock = getCanvasService as Mock;
const updateCanvasServiceMock = updateCanvasService as Mock;
const deleteCanvasServiceMock = deleteCanvasService as Mock;
const createCanvasServiceMock = createCanvasService as Mock;
const searchCanvasesServiceMock = searchCanvasesService as Mock;

const createTestApp = () => {
	const app = express();
	app.use(express.json());
	app.use("/api/v1/canvas", canvasRouter);
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
// GET /api/v1/canvas — List canvases
// ============================================================================

describe("GET /api/v1/canvas", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth header", async () => {
		const res = await request(app).get("/api/v1/canvas");
		expect(res.status).toBe(401);
	});

	it("returns empty array when user has no canvases", async () => {
		mockAuthSuccess();
		getCanvasesServiceMock.mockResolvedValue([]);

		const res = await request(app)
			.get("/api/v1/canvas")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.data.canvases).toEqual([]);
	});

	it("returns canvases list when user has canvases", async () => {
		mockAuthSuccess();
		getCanvasesServiceMock.mockResolvedValue([
			{ id: "c1", name: "Canvas 1" },
			{ id: "c2", name: "Canvas 2" },
		]);

		const res = await request(app)
			.get("/api/v1/canvas")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.data.canvases).toHaveLength(2);
	});

	it("passes authenticated userId to service", async () => {
		mockAuthSuccess("user-abc");
		getCanvasesServiceMock.mockResolvedValue([]);

		await request(app)
			.get("/api/v1/canvas")
			.set("Authorization", "Bearer valid-token");

		expect(getCanvasesServiceMock).toHaveBeenCalledWith("user-abc");
	});
});

// ============================================================================
// GET /api/v1/canvas/:roomId — Get single canvas
// ============================================================================

describe("GET /api/v1/canvas/:roomId", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).get("/api/v1/canvas/some-room");
		expect(res.status).toBe(401);
	});

	it("returns 404 when canvas does not exist", async () => {
		mockAuthSuccess();
		getCanvasServiceMock.mockResolvedValue(null);

		const res = await request(app)
			.get("/api/v1/canvas/nonexistent-id")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(404);
		expect(res.body.message).toContain("not found");
	});

	it("returns canvas data when found", async () => {
		mockAuthSuccess();
		getCanvasServiceMock.mockResolvedValue({
			id: "room-abc",
			name: "Test Canvas",
			owner_id: "user-123",
			is_public: false,
		});

		const res = await request(app)
			.get("/api/v1/canvas/room-abc")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.data.canvas.id).toBe("room-abc");
		expect(res.body.data.canvas.name).toBe("Test Canvas");
	});

	it("passes roomId param to service", async () => {
		mockAuthSuccess();
		getCanvasServiceMock.mockResolvedValue({ id: "my-room" });

		await request(app)
			.get("/api/v1/canvas/my-room")
			.set("Authorization", "Bearer valid-token");

		expect(getCanvasServiceMock).toHaveBeenCalledWith("my-room");
	});
});

// ============================================================================
// PUT /api/v1/canvas/:roomId — Update canvas
// ============================================================================

describe("PUT /api/v1/canvas/:roomId", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app)
			.put("/api/v1/canvas/some-room")
			.send({ name: "Updated" });
		expect(res.status).toBe(401);
	});

	it("returns 400 if name exceeds max length (50)", async () => {
		mockAuthSuccess();

		const res = await request(app)
			.put("/api/v1/canvas/room-abc")
			.set("Authorization", "Bearer valid-token")
			.send({ name: "A".repeat(51) });

		expect(res.status).toBe(400);
		expect(res.body.message).toContain("Validation Failed");
	});

	it("returns 400 if name is empty string", async () => {
		mockAuthSuccess();

		const res = await request(app)
			.put("/api/v1/canvas/room-abc")
			.set("Authorization", "Bearer valid-token")
			.send({ name: "" });

		expect(res.status).toBe(400);
	});

	it("returns 200 on valid name update", async () => {
		mockAuthSuccess();
		updateCanvasServiceMock.mockResolvedValue(undefined);

		const res = await request(app)
			.put("/api/v1/canvas/room-abc")
			.set("Authorization", "Bearer valid-token")
			.send({ name: "New Name" });

		expect(res.status).toBe(200);
		expect(res.body.message).toContain("updated");
	});

	it("calls updateCanvasService with correct args", async () => {
		mockAuthSuccess("user-xyz");
		updateCanvasServiceMock.mockResolvedValue(undefined);

		await request(app)
			.put("/api/v1/canvas/room-abc")
			.set("Authorization", "Bearer valid-token")
			.send({ name: "Updated" });

		expect(updateCanvasServiceMock).toHaveBeenCalledWith(
			"room-abc",
			expect.objectContaining({ name: "Updated" }),
			"user-xyz",
		);
	});

	it("accepts optional fields: data, thumbnail_url", async () => {
		mockAuthSuccess();
		updateCanvasServiceMock.mockResolvedValue(undefined);

		const res = await request(app)
			.put("/api/v1/canvas/room-abc")
			.set("Authorization", "Bearer valid-token")
			.send({
				data: "hex-data-string",
				thumbnail_url: "https://img.com/t.png",
			});

		expect(res.status).toBe(200);
	});
});

// ============================================================================
// DELETE /api/v1/canvas/:roomId — Soft delete
// ============================================================================

describe("DELETE /api/v1/canvas/:roomId", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).delete("/api/v1/canvas/some-room");
		expect(res.status).toBe(401);
	});

	it("returns 200 on successful soft delete", async () => {
		mockAuthSuccess();
		deleteCanvasServiceMock.mockResolvedValue(undefined);

		const res = await request(app)
			.delete("/api/v1/canvas/room-abc")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.message).toContain("deleted");
	});

	it("calls deleteCanvasService with userId for ownership check", async () => {
		mockAuthSuccess("user-xyz");
		deleteCanvasServiceMock.mockResolvedValue(undefined);

		await request(app)
			.delete("/api/v1/canvas/room-abc")
			.set("Authorization", "Bearer valid-token");

		expect(deleteCanvasServiceMock).toHaveBeenCalledWith(
			"room-abc",
			"user-xyz",
		);
	});
});

// ============================================================================
// POST /api/v1/canvas/create-canvas — Extra validation
// ============================================================================

describe("POST /api/v1/canvas/create-canvas — Validation", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 400 if name is missing", async () => {
		mockAuthSuccess();

		const res = await request(app)
			.post("/api/v1/canvas/create-canvas")
			.set("Authorization", "Bearer valid-token")
			.send({ isPublic: false });

		expect(res.status).toBe(400);
	});

	it("returns 400 if name exceeds 50 characters", async () => {
		mockAuthSuccess();

		const res = await request(app)
			.post("/api/v1/canvas/create-canvas")
			.set("Authorization", "Bearer valid-token")
			.send({ name: "X".repeat(51), isPublic: false });

		expect(res.status).toBe(400);
	});

	it("defaults isPublic to false when not provided", async () => {
		mockAuthSuccess();
		createCanvasServiceMock.mockResolvedValue({
			id: "c1",
			slug: "test-123",
			name: "Test",
			is_public: false,
		});

		const res = await request(app)
			.post("/api/v1/canvas/create-canvas")
			.set("Authorization", "Bearer valid-token")
			.send({ name: "Test" });

		expect(res.status).toBe(201);
	});
});

// ============================================================================
// GET /api/v1/canvas/search — Search canvases
// ============================================================================

describe("GET /api/v1/canvas/search", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth header", async () => {
		const res = await request(app).get("/api/v1/canvas/search");
		expect(res.status).toBe(401);
	});

	it("returns search results for a given query", async () => {
		mockAuthSuccess("user-123");
		searchCanvasesServiceMock.mockResolvedValue({
			canvases: [
				{ id: "c1", name: "Architecture 2024", owner_id: "user-123" },
			],
			total: 1,
			page: 1,
			limit: 20,
		});

		const res = await request(app)
			.get("/api/v1/canvas/search?q=Arch")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.data.canvases).toHaveLength(1);
		expect(res.body.data.canvases[0].name).toBe("Architecture 2024");
		expect(res.body.data.total).toBe(1);
		expect(searchCanvasesServiceMock).toHaveBeenCalledWith("user-123", {
			q: "Arch",
			sortBy: "createdAt",
			order: "desc",
			page: 1,
			limit: 20,
		});
	});

	it("passes sort and order params correctly", async () => {
		mockAuthSuccess();
		searchCanvasesServiceMock.mockResolvedValue({
			canvases: [],
			total: 0,
			page: 1,
			limit: 20,
		});

		await request(app)
			.get("/api/v1/canvas/search?q=test&sortBy=title&order=asc")
			.set("Authorization", "Bearer valid-token");

		expect(searchCanvasesServiceMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				q: "test",
				sortBy: "title",
				order: "asc",
			}),
		);
	});

	it("returns empty results when no matches found", async () => {
		mockAuthSuccess();
		searchCanvasesServiceMock.mockResolvedValue({
			canvases: [],
			total: 0,
			page: 1,
			limit: 20,
		});

		const res = await request(app)
			.get("/api/v1/canvas/search?q=nonexistent")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.data.canvases).toEqual([]);
		expect(res.body.data.total).toBe(0);
	});
});
