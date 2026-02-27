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
});

export type SignupType = z.infer<typeof SignupSchema>;
export type SigninType = z.infer<typeof SigninSchema>;
export type CreateCanvasType = z.infer<typeof CreateCanvasSchema>;

export const UpdateCanvasSchema = z.object({
	name: z.string().min(1).max(50).optional(),
	data: z.string().optional(),
	thumbnail_url: z.string().optional(),
});

export type UpdateCanvasType = z.infer<typeof UpdateCanvasSchema>;

export const SaveVersionSchema = z.object({
	name: z.string().min(1, "Version name is required").max(100),
	snapshot: z.string().min(1, "Snapshot is required"),
});

export type SaveVersionType = z.infer<typeof SaveVersionSchema>;
