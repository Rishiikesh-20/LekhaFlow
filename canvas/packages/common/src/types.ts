import { z } from "zod";

export const SignupSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
	name: z.string().min(1),
});

export const SigninSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
});

export const CreateCanvasSchema = z.object({
	name: z.string().min(1).max(50),
	isPublic: z.boolean().optional().default(false),
	folderId: z.string().nullable().optional(),
});

export type SignupType = z.infer<typeof SignupSchema>;
export type SigninType = z.infer<typeof SigninSchema>;
export type CreateCanvasType = z.infer<typeof CreateCanvasSchema>;

export const UpdateCanvasSchema = z.object({
	name: z.string().min(1).max(50).optional(),
	data: z.string().optional(),
	thumbnail_url: z.string().optional(),
	isStarred: z.boolean().optional(),
});

export type UpdateCanvasType = z.infer<typeof UpdateCanvasSchema>;

export const ToggleStarSchema = z.object({
	isStarred: z.boolean(),
});

export type ToggleStarType = z.infer<typeof ToggleStarSchema>;

export const SaveVersionSchema = z.object({
	name: z.string().min(1, "Version name is required").max(100),
	snapshot: z.string().min(1, "Snapshot is required"),
});

export type SaveVersionType = z.infer<typeof SaveVersionSchema>;

// Folder schemas
export const CreateFolderSchema = z.object({
	name: z.string().min(1, "Folder name is required").max(100),
	parentId: z.string().nullable().optional(),
});

export const MoveFolderSchema = z.object({
	parentId: z.string().nullable(),
});

export const MoveCanvasSchema = z.object({
	folderId: z.string().nullable(),
});

export type CreateFolderType = z.infer<typeof CreateFolderSchema>;
export type MoveFolderType = z.infer<typeof MoveFolderSchema>;
export type MoveCanvasType = z.infer<typeof MoveCanvasSchema>;

// Collaboration/Invite Schemas
export const CreateInviteSchema = z.object({
	role: z.enum(["editor", "viewer"]),
});

export const JoinCanvasSchema = z.object({
	token: z.string().min(1, "Invite token is required"),
});

export type CreateInviteType = z.infer<typeof CreateInviteSchema>;
export type JoinCanvasType = z.infer<typeof JoinCanvasSchema>;
// Tag schemas
export const CreateTagSchema = z.object({
	name: z.string().min(1, "Tag name is required").max(30),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code (e.g. #FF0000)")
		.optional()
		.default("#6D28D9"),
});

export const UpdateTagSchema = z.object({
	name: z.string().min(1).max(30).optional(),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code")
		.optional(),
});

export const AssignTagSchema = z.object({
	tagId: z.string().min(1, "Tag ID is required"),
});

export type CreateTagType = z.infer<typeof CreateTagSchema>;
export type UpdateTagType = z.infer<typeof UpdateTagSchema>;
export type AssignTagType = z.infer<typeof AssignTagSchema>;
