/**
 * ============================================================================
 * HTTP BACKEND — TAG ROUTES TESTS
 * ============================================================================
 *
 * Tests for: GET /tag, POST /tag, PUT /tag/:tagId, DELETE /tag/:tagId,
 * POST /canvas/:roomId/tags, DELETE /canvas/:roomId/tags/:tagId
 *
 * NOTE: services/tag.ts caches `createServiceClient()` at module level,
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

// Mock the service layer directly
vi.mock("../services/tag.js", () => ({
	getTagsService: vi.fn(),
	createTagService: vi.fn(),
	updateTagService: vi.fn(),
	deleteTagService: vi.fn(),
	assignTagService: vi.fn(),
	unassignTagService: vi.fn(),
	getCanvasTagsService: vi.fn(),
}));

import { globalErrorHandler } from "../error/error";
import { canvasRouter } from "../routes/canvas";
import { tagRouter } from "../routes/tag";
import {
	assignTagService,
	createTagService,
	deleteTagService,
	getCanvasTagsService,
	getTagsService,
	unassignTagService,
	updateTagService,
} from "../services/tag.js";
import { createServiceClient } from "../supabase.server";

const createServiceClientMock = createServiceClient as Mock;
const getTagsServiceMock = getTagsService as Mock;
const createTagServiceMock = createTagService as Mock;
const updateTagServiceMock = updateTagService as Mock;
const deleteTagServiceMock = deleteTagService as Mock;
const assignTagServiceMock = assignTagService as Mock;
const unassignTagServiceMock = unassignTagService as Mock;
const getCanvasTagsServiceMock = getCanvasTagsService as Mock;

const createTestApp = () => {
	const app = express();
	app.use(express.json());
	app.use("/api/v1/tag", tagRouter);
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
// GET /api/v1/tag — List tags
// ============================================================================

describe("GET /api/v1/tag", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth header", async () => {
		const res = await request(app).get("/api/v1/tag");
		expect(res.status).toBe(401);
	});

	it("returns tags list when authenticated", async () => {
		mockAuthSuccess();
		getTagsServiceMock.mockResolvedValue([
			{ id: "t1", name: "Urgent", color: "#FF0000" },
			{ id: "t2", name: "Draft", color: "#6D28D9" },
		]);

		const res = await request(app)
			.get("/api/v1/tag")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.data.tags).toHaveLength(2);
		expect(res.body.data.tags[0].name).toBe("Urgent");
	});

	it("returns empty array when no tags exist", async () => {
		mockAuthSuccess();
		getTagsServiceMock.mockResolvedValue([]);

		const res = await request(app)
			.get("/api/v1/tag")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.data.tags).toEqual([]);
	});
});

// ============================================================================
// POST /api/v1/tag — Create tag
// ============================================================================

describe("POST /api/v1/tag", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).post("/api/v1/tag").send({ name: "Urgent" });
		expect(res.status).toBe(401);
	});

	it("returns 400 if name is missing", async () => {
		mockAuthSuccess();

		const res = await request(app)
			.post("/api/v1/tag")
			.set("Authorization", "Bearer valid-token")
			.send({ color: "#FF0000" });

		expect(res.status).toBe(400);
		expect(res.body.message).toContain("Validation Failed");
	});

	it("returns 201 on valid tag creation", async () => {
		mockAuthSuccess();
		createTagServiceMock.mockResolvedValue({
			id: "t1",
			name: "Urgent",
			color: "#FF0000",
		});

		const res = await request(app)
			.post("/api/v1/tag")
			.set("Authorization", "Bearer valid-token")
			.send({ name: "Urgent", color: "#FF0000" });

		expect(res.status).toBe(201);
		expect(res.body.data.tag.name).toBe("Urgent");
		expect(res.body.data.tag.color).toBe("#FF0000");
	});

	it("defaults color when not provided", async () => {
		mockAuthSuccess();
		createTagServiceMock.mockResolvedValue({
			id: "t1",
			name: "Draft",
			color: "#6D28D9",
		});

		const res = await request(app)
			.post("/api/v1/tag")
			.set("Authorization", "Bearer valid-token")
			.send({ name: "Draft" });

		expect(res.status).toBe(201);
		expect(createTagServiceMock).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Draft" }),
		);
	});
});

// ============================================================================
// PUT /api/v1/tag/:tagId — Update tag
// ============================================================================

describe("PUT /api/v1/tag/:tagId", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app)
			.put("/api/v1/tag/t1")
			.send({ name: "Updated" });
		expect(res.status).toBe(401);
	});

	it("returns 200 on valid update", async () => {
		mockAuthSuccess();
		updateTagServiceMock.mockResolvedValue({
			id: "t1",
			name: "Updated",
			color: "#00FF00",
		});

		const res = await request(app)
			.put("/api/v1/tag/t1")
			.set("Authorization", "Bearer valid-token")
			.send({ name: "Updated", color: "#00FF00" });

		expect(res.status).toBe(200);
		expect(res.body.data.tag.name).toBe("Updated");
	});

	it("calls updateTagService with correct args", async () => {
		mockAuthSuccess();
		updateTagServiceMock.mockResolvedValue({
			id: "t1",
			name: "New Name",
			color: "#111111",
		});

		await request(app)
			.put("/api/v1/tag/t1")
			.set("Authorization", "Bearer valid-token")
			.send({ name: "New Name", color: "#111111" });

		expect(updateTagServiceMock).toHaveBeenCalledWith(
			"t1",
			expect.objectContaining({ name: "New Name", color: "#111111" }),
		);
	});
});

// ============================================================================
// DELETE /api/v1/tag/:tagId — Delete tag
// ============================================================================

describe("DELETE /api/v1/tag/:tagId", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).delete("/api/v1/tag/t1");
		expect(res.status).toBe(401);
	});

	it("returns 200 on successful delete", async () => {
		mockAuthSuccess();
		deleteTagServiceMock.mockResolvedValue(undefined);

		const res = await request(app)
			.delete("/api/v1/tag/t1")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.message).toContain("deleted");
	});

	it("calls deleteTagService with correct tagId", async () => {
		mockAuthSuccess();
		deleteTagServiceMock.mockResolvedValue(undefined);

		await request(app)
			.delete("/api/v1/tag/tag-xyz")
			.set("Authorization", "Bearer valid-token");

		expect(deleteTagServiceMock).toHaveBeenCalledWith("tag-xyz");
	});
});

// ============================================================================
// POST /api/v1/canvas/:roomId/tags — Assign tag
// ============================================================================

describe("POST /api/v1/canvas/:roomId/tags", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app)
			.post("/api/v1/canvas/room-1/tags")
			.send({ tagId: "t1" });
		expect(res.status).toBe(401);
	});

	it("returns 400 when tagId is missing", async () => {
		mockAuthSuccess();

		const res = await request(app)
			.post("/api/v1/canvas/room-1/tags")
			.set("Authorization", "Bearer valid-token")
			.send({});

		expect(res.status).toBe(400);
	});

	it("returns 201 on successful assignment", async () => {
		mockAuthSuccess();
		assignTagServiceMock.mockResolvedValue(undefined);

		const res = await request(app)
			.post("/api/v1/canvas/room-1/tags")
			.set("Authorization", "Bearer valid-token")
			.send({ tagId: "t1" });

		expect(res.status).toBe(201);
		expect(assignTagServiceMock).toHaveBeenCalledWith("room-1", "t1");
	});
});

// ============================================================================
// DELETE /api/v1/canvas/:roomId/tags/:tagId — Unassign tag
// ============================================================================

describe("DELETE /api/v1/canvas/:roomId/tags/:tagId", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).delete("/api/v1/canvas/room-1/tags/t1");
		expect(res.status).toBe(401);
	});

	it("returns 200 on successful unassignment", async () => {
		mockAuthSuccess();
		unassignTagServiceMock.mockResolvedValue(undefined);

		const res = await request(app)
			.delete("/api/v1/canvas/room-1/tags/t1")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(unassignTagServiceMock).toHaveBeenCalledWith("room-1", "t1");
	});
});

// ============================================================================
// GET /api/v1/canvas/:roomId/tags — Get canvas tags
// ============================================================================

describe("GET /api/v1/canvas/:roomId/tags", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).get("/api/v1/canvas/room-1/tags");
		expect(res.status).toBe(401);
	});

	it("returns tags for a canvas", async () => {
		mockAuthSuccess();
		getCanvasTagsServiceMock.mockResolvedValue([
			{ id: "t1", name: "Urgent", color: "#FF0000" },
		]);

		const res = await request(app)
			.get("/api/v1/canvas/room-1/tags")
			.set("Authorization", "Bearer valid-token");

		expect(res.status).toBe(200);
		expect(res.body.data.tags).toHaveLength(1);
		expect(res.body.data.tags[0].name).toBe("Urgent");
	});
});
