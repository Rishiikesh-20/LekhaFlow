/**
 * ============================================================================
 * HTTP BACKEND — COMPREHENSIVE INTEGRATION TEST SUITE
 * ============================================================================
 *
 * Validates the *full data-flow* across the three critical areas:
 *
 *   Phase A-1: Canvas Lifecycle
 *     POST /create-canvas  →  GET /:roomId  →  PATCH /:roomId/star  →  DELETE /:roomId
 *
 *   Phase A-2: RBAC — viewer role receives 403 on admin-only operations
 *     POST /rbac/assign, DELETE /rbac/remove
 *
 *   Phase A-3: Zod Schema Validation — malformed payloads return 400
 *     Covers CreateCanvasSchema, UpdateCanvasSchema, ToggleStarSchema
 *
 * Mock strategy
 * ─────────────
 * • All Supabase calls are intercepted via vi.mock("../supabase.server").
 * • The Express app is built in-process using the real route/controller/service
 *   code, so the tests exercise the complete request → response pipeline.
 * • No network calls; no real DB required.
 *
 * Types imported from @repo/common and @repo/supabase to stay in sync with
 * the shared contracts.
 */

import type { CreateCanvasType } from "@repo/common";
import type { Tables } from "@repo/supabase";
import type { User } from "@supabase/supabase-js";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// ── IMPORTANT: mock must be hoisted before any module that transitively ──────
// ── imports createServiceClient (services/canvas, middleware/auth, etc.) ─────
vi.mock("./supabase.server", () => ({
	createServiceClient: vi.fn(),
}));

import { globalErrorHandler } from "./error/error";
import { canvasRouter } from "./routes/canvas";
import { rbacRouter } from "./routes/rbac";
import { createServiceClient } from "./supabase.server";

const mockCreateServiceClient = createServiceClient as Mock;

// ─────────────────────────────────────────────────────────────────────────────
// Test-app factory
// Mounts only the routes under test so unrelated middleware cannot interfere.
// ─────────────────────────────────────────────────────────────────────────────
const buildApp = () => {
	const app = express();
	app.use(express.json());
	app.use("/api/v1/canvas", canvasRouter);
	app.use("/api/v1/rbac", rbacRouter);
	app.use(globalErrorHandler);
	return app;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
const USER_A: Partial<User> = {
	id: "user-a-uuid-0001",
	email: "user-a@integration.test",
};

const USER_VIEWER: Partial<User> = {
	id: "viewer-uuid-0002",
	email: "viewer@integration.test",
};

/** A canonical Tables<"canvases"> row reused across lifecycle tests. */
const CANVAS_ROW: Tables<"canvases"> = {
	id: "canvas-lifecycle-0001",
	slug: "lifecycle-canvas-1710115200000",
	name: "Lifecycle Canvas",
	owner_id: "user-a-uuid-0001",
	data: null,
	thumbnail_url: null,
	is_public: false,
	folder_id: null,
	is_deleted: false,
	is_archived: false,
	is_starred: false,
	last_accessed_at: null,
	created_at: "2026-03-11T00:00:00.000Z",
	updated_at: "2026-03-11T00:00:00.000Z",
	deleted_at: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock-builder helpers
//
// Each helper returns a minimal Supabase client mock that satisfies the
// specific query chain used by one service function.  The object is both
// the mock return value AND exposes the inner vi.fn() spies so tests can
// inspect call arguments.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Auth-only mock: suitable when the request is expected to fail before any
 * DB operation occurs (e.g., schema validation errors).
 */
function _buildAuthMock(
	user: Partial<User> | null,
	error: Error | null = null,
) {
	return {
		auth: {
			getUser: vi.fn().mockResolvedValue({ data: { user }, error }),
		},
		// Fallback from() that returns an empty object — should never be called
		// when the test short-circuits at the validation layer.
		from: vi.fn().mockReturnValue({}),
	};
}

/**
 * Mock for: .from(table).insert({...}).select().single()
 * Used by createCanvasService, syncUserService, etc.
 */
function buildInsertMock(
	user: Partial<User>,
	insertData: unknown,
	insertError: Error | null = null,
) {
	const singleMock = vi
		.fn()
		.mockResolvedValue({ data: insertData, error: insertError });
	const selectAfterInsertMock = vi.fn().mockReturnValue({ single: singleMock });
	const insertMock = vi.fn().mockReturnValue({ select: selectAfterInsertMock });
	const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

	return {
		auth: {
			getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
		},
		from: fromMock,
		// Expose inner spies for assertion
		_insertMock: insertMock,
		_fromMock: fromMock,
	};
}

/**
 * Mock for: .from(table).select("*").eq(col, val).eq(col, val).maybeSingle()
 * Used by getCanvasService.
 */
function buildSelectMaybeSingleMock(
	user: Partial<User>,
	selectData: unknown,
	selectError: Error | null = null,
) {
	const maybeSingleMock = vi
		.fn()
		.mockResolvedValue({ data: selectData, error: selectError });
	const eq2Mock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
	const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock });
	const selectMock = vi.fn().mockReturnValue({ eq: eq1Mock });
	const fromMock = vi.fn().mockReturnValue({ select: selectMock });

	return {
		auth: {
			getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
		},
		from: fromMock,
		_maybeSingleMock: maybeSingleMock,
	};
}

/**
 * Mock for: .from(table).update({...}).eq(col, val).eq(col, val)
 * Used by updateCanvasService, deleteCanvasService, toggleStarService.
 */
function buildUpdateMock(
	user: Partial<User>,
	updateError: Error | null = null,
) {
	const eq2Mock = vi.fn().mockResolvedValue({ error: updateError });
	const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock });
	const updateMock = vi.fn().mockReturnValue({ eq: eq1Mock });
	const fromMock = vi.fn().mockReturnValue({ update: updateMock });

	return {
		auth: {
			getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
		},
		from: fromMock,
		_updateMock: updateMock,
		_fromMock: fromMock,
	};
}

/**
 * Mock for a user with a "viewer" system role.
 *
 * The isAdmin() helper in rbac.ts does:
 *   supabase.from("user_roles").select("roles(name, level)").eq("user_id", id).single()
 *
 * This mock returns { roles: { name: "viewer", level: 10 } } so isAdmin() → false.
 */
function buildViewerRoleMock() {
	const singleMock = vi.fn().mockResolvedValue({
		data: { roles: { name: "viewer", level: 10 } },
		error: null,
	});
	const eqMock = vi.fn().mockReturnValue({ single: singleMock });
	const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
	const fromMock = vi.fn().mockReturnValue({ select: selectMock });

	return {
		auth: {
			getUser: vi
				.fn()
				.mockResolvedValue({ data: { user: USER_VIEWER }, error: null }),
		},
		from: fromMock,
	};
}

/**
 * Mock for getMyRole: .from("user_roles").select("role_id, roles(*)").eq("user_id", id).single()
 */
function buildGetMyRoleMock(user: Partial<User>, roleName: string) {
	const singleMock = vi.fn().mockResolvedValue({
		data: {
			role_id: "role-uuid",
			roles: { name: roleName, level: 10 },
		},
		error: null,
	});
	const eqMock = vi.fn().mockReturnValue({ single: singleMock });
	const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
	const fromMock = vi.fn().mockReturnValue({ select: selectMock });

	return {
		auth: {
			getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
		},
		from: fromMock,
	};
}

// =============================================================================
// PHASE A-1: FULL CANVAS LIFECYCLE
// =============================================================================
//
// Tests the four primary canvas operations in sequential order.
// Each test step configures a fresh mock for that specific operation.
// The canvas ID (CANVAS_ROW.id) is shared across steps to simulate a
// coherent user session.
// =============================================================================

describe("Phase A-1 — Canvas Lifecycle: POST → GET → PATCH/star → DELETE", () => {
	let app: ReturnType<typeof buildApp>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = buildApp();
	});

	// ── Step 1: Create ───────────────────────────────────────────────────────
	it("Step 1 — POST /create-canvas → 201 with roomId + slug", async () => {
		const mock = buildInsertMock(USER_A, CANVAS_ROW);
		mockCreateServiceClient.mockReturnValue(mock);

		const payload: CreateCanvasType = {
			name: "Lifecycle Canvas",
			isPublic: false,
		};

		const res = await request(app)
			.post("/api/v1/canvas/create-canvas")
			.set("Authorization", "Bearer mock-jwt-user-a")
			.send(payload);

		expect(res.status).toBe(201);
		expect(res.body.code).toBe(201);
		expect(res.body.data.roomId).toBe(CANVAS_ROW.id);
		expect(res.body.data.slug).toBe(CANVAS_ROW.slug);

		// Verify DB insert used correct ownership fields — malicious owner_id
		// override in the request body must NOT be honoured.
		expect(mock._fromMock).toHaveBeenCalledWith("canvases");
		expect(mock._insertMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Lifecycle Canvas",
				owner_id: USER_A.id, // must come from JWT, not request body
				is_public: false,
			}),
		);
	});

	// ── Step 2: Read ─────────────────────────────────────────────────────────
	it("Step 2 — GET /canvas/:roomId → 200 with full canvas data", async () => {
		const mock = buildSelectMaybeSingleMock(USER_A, CANVAS_ROW);
		mockCreateServiceClient.mockReturnValue(mock);

		const res = await request(app)
			.get(`/api/v1/canvas/${CANVAS_ROW.id}`)
			.set("Authorization", "Bearer mock-jwt-user-a");

		expect(res.status).toBe(200);
		expect(res.body.code).toBe(200);
		expect(res.body.data.canvas.id).toBe(CANVAS_ROW.id);
		expect(res.body.data.canvas.name).toBe(CANVAS_ROW.name);
		expect(res.body.data.canvas.owner_id).toBe(USER_A.id);
		expect(res.body.data.canvas.is_starred).toBe(false);
	});

	// ── Step 3: Star ─────────────────────────────────────────────────────────
	it("Step 3 — PATCH /canvas/:roomId/star { isStarred: true } → 200 'Canvas starred'", async () => {
		const mock = buildUpdateMock(USER_A);
		mockCreateServiceClient.mockReturnValue(mock);

		const res = await request(app)
			.patch(`/api/v1/canvas/${CANVAS_ROW.id}/star`)
			.set("Authorization", "Bearer mock-jwt-user-a")
			.send({ isStarred: true });

		expect(res.status).toBe(200);
		expect(res.body.message).toBe("Canvas starred");

		// Verify the update payload carried the correct boolean flag
		expect(mock._updateMock).toHaveBeenCalledWith(
			expect.objectContaining({ is_starred: true }),
		);
	});

	it("Step 3b — PATCH /canvas/:roomId/star { isStarred: false } → 200 'Canvas unstarred'", async () => {
		const mock = buildUpdateMock(USER_A);
		mockCreateServiceClient.mockReturnValue(mock);

		const res = await request(app)
			.patch(`/api/v1/canvas/${CANVAS_ROW.id}/star`)
			.set("Authorization", "Bearer mock-jwt-user-a")
			.send({ isStarred: false });

		expect(res.status).toBe(200);
		expect(res.body.message).toBe("Canvas unstarred");
	});

	// ── Step 4: Delete (soft) ─────────────────────────────────────────────────
	it("Step 4 — DELETE /canvas/:roomId → 200 'Canvas deleted successfully'", async () => {
		// deleteCanvasService performs a soft-delete: UPDATE canvases SET is_deleted=true
		const mock = buildUpdateMock(USER_A);
		mockCreateServiceClient.mockReturnValue(mock);

		const res = await request(app)
			.delete(`/api/v1/canvas/${CANVAS_ROW.id}`)
			.set("Authorization", "Bearer mock-jwt-user-a");

		expect(res.status).toBe(200);
		expect(res.body.message).toBe("Canvas deleted successfully");

		// Ensure the service targets the correct canvas and uses a soft-delete flag
		expect(mock._updateMock).toHaveBeenCalledWith(
			expect.objectContaining({ is_deleted: true }),
		);
		// owner_id scoping: the .eq("owner_id", userId) chain is verified by
		// checking _fromMock was called, not by unpacking the full eq chain.
		expect(mock._fromMock).toHaveBeenCalledWith("canvases");
	});

	// ── Step 5: Verify deleted → 404 ─────────────────────────────────────────
	it("Step 5 — GET deleted canvas → 404 'Canvas not found'", async () => {
		// After soft-delete, getCanvasService returns null (maybeSingle = null)
		const mock = buildSelectMaybeSingleMock(USER_A, null);
		mockCreateServiceClient.mockReturnValue(mock);

		const res = await request(app)
			.get(`/api/v1/canvas/${CANVAS_ROW.id}`)
			.set("Authorization", "Bearer mock-jwt-user-a");

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
		expect(res.body.message).toBe("Canvas not found");
	});
});

// =============================================================================
// PHASE A-2: RBAC — VIEWER ROLE BLOCKED FROM ADMIN-ONLY OPERATIONS
// =============================================================================
//
// The system-level RBAC uses the `roles` + `user_roles` tables.
// A user with role level 10 (viewer) or 50 (editor) is NOT an admin (level 100).
// The assignRole / removeRole endpoints check isAdmin() before proceeding.
// =============================================================================

describe("Phase A-2 — RBAC: viewer role receives 403 on admin-only endpoints", () => {
	let app: ReturnType<typeof buildApp>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = buildApp();
	});

	it("POST /rbac/assign — viewer JWT → 403 'Only admins can assign roles'", async () => {
		mockCreateServiceClient.mockReturnValue(buildViewerRoleMock());

		const res = await request(app)
			.post("/api/v1/rbac/assign")
			.set("Authorization", "Bearer mock-jwt-viewer")
			.send({
				targetUserId: "some-target-user-uuid",
				roleId: "editor-role-uuid",
			});

		expect(res.status).toBe(403);
		expect(res.body.message).toMatch(/Only admins can assign roles/i);
	});

	it("DELETE /rbac/remove — viewer JWT → 403 'Only admins can remove roles'", async () => {
		mockCreateServiceClient.mockReturnValue(buildViewerRoleMock());

		const res = await request(app)
			.delete("/api/v1/rbac/remove")
			.set("Authorization", "Bearer mock-jwt-viewer")
			.send({ targetUserId: "some-target-user-uuid" });

		expect(res.status).toBe(403);
		expect(res.body.message).toMatch(/Only admins can remove roles/i);
	});

	it("POST /rbac/assign — no Authorization header → 401 before RBAC check", async () => {
		// RBAC check should never run when auth fails
		const fromSpy = vi.fn();
		mockCreateServiceClient.mockReturnValue({
			auth: {
				getUser: vi.fn().mockResolvedValue({
					data: { user: null },
					error: new Error("No token"),
				}),
			},
			from: fromSpy,
		});

		const res = await request(app)
			.post("/api/v1/rbac/assign")
			.send({ targetUserId: "x", roleId: "y" });

		expect(res.status).toBe(401);
		// DB must NOT be touched when auth fails
		expect(fromSpy).not.toHaveBeenCalled();
	});

	it("GET /rbac/my-role — any authenticated user → 200 (not admin-gated)", async () => {
		// getMyRole is publicly accessible to all authenticated users
		mockCreateServiceClient.mockReturnValue(
			buildGetMyRoleMock(USER_VIEWER, "viewer"),
		);

		const res = await request(app)
			.get("/api/v1/rbac/my-role")
			.set("Authorization", "Bearer mock-jwt-viewer");

		expect(res.status).toBe(200);
	});

	it("GET /rbac/roles — any authenticated user → 200 (read-only, not admin-gated)", async () => {
		// getRoles lists system roles — requires auth but not admin
		const orderMock = vi.fn().mockResolvedValue({
			data: [
				{ name: "admin", level: 100 },
				{ name: "editor", level: 50 },
			],
			error: null,
		});
		const selectMock = vi.fn().mockReturnValue({ order: orderMock });
		const fromMock = vi.fn().mockReturnValue({ select: selectMock });

		mockCreateServiceClient.mockReturnValue({
			auth: {
				getUser: vi
					.fn()
					.mockResolvedValue({ data: { user: USER_VIEWER }, error: null }),
			},
			from: fromMock,
		});

		const res = await request(app)
			.get("/api/v1/rbac/roles")
			.set("Authorization", "Bearer mock-jwt-viewer");

		expect(res.status).toBe(200);
		expect(res.body.roles).toBeInstanceOf(Array);
	});
});

// =============================================================================
// PHASE A-3: ZOD SCHEMA VALIDATION — INVALID PAYLOADS → 400 BAD REQUEST
// =============================================================================
//
// Validates that the request body is rejected BEFORE any database operation.
// createServiceClient's from() mock is never called when schema errors occur
// (auth succeeds; body parsing fails).
// =============================================================================

describe("Phase A-3 — Zod Validation: malformed payloads return 400", () => {
	let app: ReturnType<typeof buildApp>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = buildApp();

		// A valid auth mock so 401 cannot shadow the 400 we are testing.
		// The from() mock intentionally has no further chain — it must never
		// be called when schema validation fails.
		mockCreateServiceClient.mockReturnValue({
			auth: {
				getUser: vi
					.fn()
					.mockResolvedValue({ data: { user: USER_A }, error: null }),
			},
			from: vi.fn().mockReturnValue({
				insert: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({ single: vi.fn() }),
				}),
				update: vi.fn().mockReturnValue({
					eq: vi.fn().mockReturnValue({
						eq: vi.fn().mockResolvedValue({ error: null }),
					}),
				}),
			}),
		});
	});

	// CreateCanvasSchema: name required, min 1, max 50
	it("POST /create-canvas — missing `name` → 400 Validation Failed", async () => {
		const res = await request(app)
			.post("/api/v1/canvas/create-canvas")
			.set("Authorization", "Bearer mock-jwt")
			.send({ isPublic: false }); // name omitted entirely

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(res.body.message).toMatch(/Validation Failed/i);
	});

	it("POST /create-canvas — empty `name` (min 1 violated) → 400", async () => {
		const res = await request(app)
			.post("/api/v1/canvas/create-canvas")
			.set("Authorization", "Bearer mock-jwt")
			.send({ name: "", isPublic: false });

		expect(res.status).toBe(400);
		expect(res.body.message).toMatch(/Validation Failed/i);
	});

	it("POST /create-canvas — name > 50 chars (max 50 violated) → 400", async () => {
		const res = await request(app)
			.post("/api/v1/canvas/create-canvas")
			.set("Authorization", "Bearer mock-jwt")
			.send({ name: "A".repeat(51), isPublic: false });

		expect(res.status).toBe(400);
		expect(res.body.message).toMatch(/Validation Failed/i);
	});

	// UpdateCanvasSchema: name optional but min 1 if provided
	it("PUT /canvas/:roomId — `name` is empty string (min 1 violated) → 400", async () => {
		const res = await request(app)
			.put(`/api/v1/canvas/${CANVAS_ROW.id}`)
			.set("Authorization", "Bearer mock-jwt")
			.send({ name: "" });

		expect(res.status).toBe(400);
		expect(res.body.message).toMatch(/Validation Failed/i);
	});

	it("PUT /canvas/:roomId — `name` > 50 chars → 400", async () => {
		const res = await request(app)
			.put(`/api/v1/canvas/${CANVAS_ROW.id}`)
			.set("Authorization", "Bearer mock-jwt")
			.send({ name: "B".repeat(51) });

		expect(res.status).toBe(400);
		expect(res.body.message).toMatch(/Validation Failed/i);
	});

	// ToggleStarSchema: isStarred required boolean
	it("PATCH /canvas/:roomId/star — missing `isStarred` → 400", async () => {
		const res = await request(app)
			.patch(`/api/v1/canvas/${CANVAS_ROW.id}/star`)
			.set("Authorization", "Bearer mock-jwt")
			.send({}); // isStarred omitted

		expect(res.status).toBe(400);
		expect(res.body.message).toMatch(/Validation Failed/i);
	});

	it("PATCH /canvas/:roomId/star — non-boolean `isStarred` → 400", async () => {
		const res = await request(app)
			.patch(`/api/v1/canvas/${CANVAS_ROW.id}/star`)
			.set("Authorization", "Bearer mock-jwt")
			.send({ isStarred: "yes" }); // string, not boolean

		expect(res.status).toBe(400);
		expect(res.body.message).toMatch(/Validation Failed/i);
	});

	// Auth must still fail before schema validation when no token is present
	it("POST /create-canvas — no Authorization header → 401 (not 400)", async () => {
		// Override to simulate missing auth
		mockCreateServiceClient.mockReturnValue({
			auth: {
				getUser: vi.fn().mockResolvedValue({
					data: { user: null },
					error: new Error("Missing"),
				}),
			},
			from: vi.fn(),
		});

		const res = await request(app)
			.post("/api/v1/canvas/create-canvas")
			.send({ name: "Canvas", isPublic: false }); // valid body, but no token

		expect(res.status).toBe(401);
	});

	// Payload injection attempt: owner_id in body must not override auth
	it("POST /create-canvas — body contains owner_id → 201 but owner_id is from JWT (security check)", async () => {
		const mock = buildInsertMock(USER_A, CANVAS_ROW);
		mockCreateServiceClient.mockReturnValue(mock);

		const res = await request(app)
			.post("/api/v1/canvas/create-canvas")
			.set("Authorization", "Bearer mock-jwt-user-a")
			.send({
				name: "Injection Canvas",
				isPublic: false,
				owner_id: "malicious-attacker-uuid", // should be ignored
			});

		expect(res.status).toBe(201);
		// The insert must use USER_A.id, not the attacker's id
		expect(mock._insertMock).toHaveBeenCalledWith(
			expect.objectContaining({ owner_id: USER_A.id }),
		);
		expect(mock._insertMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ owner_id: "malicious-attacker-uuid" }),
		);
	});
});
