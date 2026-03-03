import type { User } from "@supabase/supabase-js";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../supabase.server", () => ({
	createServiceClient: vi.fn(),
}));

import { globalErrorHandler } from "../error/error";
import { folderRouter } from "../routes/folder";
import { createServiceClient } from "../supabase.server";

const createServiceClientMock = createServiceClient as Mock;

const createTestApp = () => {
	const app = express();
	app.use(express.json());
	app.use("/api/v1/folder", folderRouter);
	app.use(globalErrorHandler);
	return app;
};

const mockUser: Partial<User> = {
	id: "user_123",
	email: "test@example.com",
};

const setupAuthMock = () => {
	const getUserMock = vi.fn().mockResolvedValue({
		data: { user: mockUser },
		error: null,
	});
	return getUserMock;
};

describe("Folder API", () => {
	let app: express.Express;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createTestApp();
	});

	describe("POST /api/v1/folder - Create Folder", () => {
		it("should return 401 when no Authorization header is provided", async () => {
			const response = await request(app)
				.post("/api/v1/folder")
				.send({ name: "Test Folder" });

			expect(response.status).toBe(401);
		});

		it("should return 400 for invalid input (empty name)", async () => {
			const getUserMock = setupAuthMock();
			createServiceClientMock.mockReturnValue({
				auth: { getUser: getUserMock },
			});

			const response = await request(app)
				.post("/api/v1/folder")
				.set("Authorization", "Bearer valid_token")
				.send({ name: "" });

			expect(response.status).toBe(400);
		});

		it("should create folder at root and return 201", async () => {
			const getUserMock = setupAuthMock();

			const mockFolder = {
				id: "folder_abc",
				name: "Q1 Plans",
				parent_id: null,
				owner_id: "user_123",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const singleMock = vi.fn().mockResolvedValue({
				data: mockFolder,
				error: null,
			});
			const selectMock = vi.fn().mockReturnValue({ single: singleMock });
			const insertMock = vi.fn().mockReturnValue({ select: selectMock });
			const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

			createServiceClientMock.mockReturnValue({
				from: fromMock,
				auth: { getUser: getUserMock },
			});

			const response = await request(app)
				.post("/api/v1/folder")
				.set("Authorization", "Bearer valid_token")
				.send({ name: "Q1 Plans" });

			expect(response.status).toBe(201);
			expect(response.body.data.folder.name).toBe("Q1 Plans");
			expect(fromMock).toHaveBeenCalledWith("folders");
			expect(insertMock).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Q1 Plans",
					owner_id: "user_123",
					parent_id: null,
				}),
			);
		});
	});

	describe("GET /api/v1/folder/contents - Get Folder Contents", () => {
		it("should return 401 when unauthorized", async () => {
			const response = await request(app).get("/api/v1/folder/contents");

			expect(response.status).toBe(401);
		});

		it("should return root contents when no folderId provided", async () => {
			const getUserMock = setupAuthMock();

			const mockFolders = [
				{
					id: "folder_1",
					name: "Folder A",
					parent_id: null,
					owner_id: "user_123",
				},
			];

			const mockCanvases = [
				{
					id: "canvas_1",
					name: "Canvas 1",
					folder_id: null,
					owner_id: "user_123",
				},
			];

			// Build the chained query mocks for folders
			const folderOrderMock = vi.fn().mockResolvedValue({
				data: mockFolders,
				error: null,
			});
			const folderIsMock = vi.fn().mockReturnValue({ order: folderOrderMock });
			const folderEqOwnerMock = vi.fn().mockReturnValue({ is: folderIsMock });
			const folderSelectMock = vi
				.fn()
				.mockReturnValue({ eq: folderEqOwnerMock });

			// Build the chained query mocks for canvases
			const canvasOrderMock = vi.fn().mockResolvedValue({
				data: mockCanvases,
				error: null,
			});
			const canvasIsMock = vi.fn().mockReturnValue({ order: canvasOrderMock });
			const canvasEqDeletedMock = vi.fn().mockReturnValue({ is: canvasIsMock });
			const canvasEqOwnerMock = vi
				.fn()
				.mockReturnValue({ eq: canvasEqDeletedMock });
			const canvasSelectMock = vi
				.fn()
				.mockReturnValue({ eq: canvasEqOwnerMock });

			const fromMock = vi.fn().mockImplementation((table: string) => {
				if (table === "folders") return { select: folderSelectMock };
				if (table === "canvases") return { select: canvasSelectMock };
				return {};
			});

			createServiceClientMock.mockReturnValue({
				from: fromMock,
				auth: { getUser: getUserMock },
			});

			const response = await request(app)
				.get("/api/v1/folder/contents")
				.set("Authorization", "Bearer valid_token");

			expect(response.status).toBe(200);
			expect(response.body.data.folders).toHaveLength(1);
			expect(response.body.data.canvases).toHaveLength(1);
		});
	});

	describe("DELETE /api/v1/folder/:folderId - Delete Folder", () => {
		it("should return 401 when unauthorized", async () => {
			const response = await request(app).delete("/api/v1/folder/folder_123");

			expect(response.status).toBe(401);
		});

		it("should return 404 when folder not found", async () => {
			const getUserMock = setupAuthMock();

			const maybeSingleMock = vi.fn().mockResolvedValue({
				data: null,
				error: null,
			});
			const eqOwnerMock = vi
				.fn()
				.mockReturnValue({ maybeSingle: maybeSingleMock });
			const eqIdMock = vi.fn().mockReturnValue({ eq: eqOwnerMock });
			const selectMock = vi.fn().mockReturnValue({ eq: eqIdMock });
			const fromMock = vi.fn().mockReturnValue({ select: selectMock });

			createServiceClientMock.mockReturnValue({
				from: fromMock,
				auth: { getUser: getUserMock },
			});

			const response = await request(app)
				.delete("/api/v1/folder/folder_nonexistent")
				.set("Authorization", "Bearer valid_token");

			expect(response.status).toBe(404);
		});
	});

	describe("PUT /api/v1/folder/:folderId/move - Move Folder", () => {
		it("should return 401 when unauthorized", async () => {
			const response = await request(app)
				.put("/api/v1/folder/folder_123/move")
				.send({ parentId: null });

			expect(response.status).toBe(401);
		});

		it("should return 400 for invalid body", async () => {
			const getUserMock = setupAuthMock();
			createServiceClientMock.mockReturnValue({
				auth: { getUser: getUserMock },
			});

			const response = await request(app)
				.put("/api/v1/folder/folder_123/move")
				.set("Authorization", "Bearer valid_token")
				.send({});

			expect(response.status).toBe(400);
		});
	});

	describe("PUT /api/v1/folder/move-canvas/:canvasId - Move Canvas", () => {
		it("should return 401 when unauthorized", async () => {
			const response = await request(app)
				.put("/api/v1/folder/move-canvas/canvas_123")
				.send({ folderId: null });

			expect(response.status).toBe(401);
		});

		it("should return 400 for invalid body", async () => {
			const getUserMock = setupAuthMock();
			createServiceClientMock.mockReturnValue({
				auth: { getUser: getUserMock },
			});

			const response = await request(app)
				.put("/api/v1/folder/move-canvas/canvas_123")
				.set("Authorization", "Bearer valid_token")
				.send({});

			expect(response.status).toBe(400);
		});
	});
});
