/**
 * Supabase Database Types
 * This file provides minimal type definitions for the database tables.
 * To regenerate from the live database schema, run: pnpm --filter @repo/supabase run update-types
 */

export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export interface Database {
	public: {
		Tables: {
			canvases: {
				Row: {
					id: string;
					slug: string;
					name: string;
					owner_id: string;
					data: string | null;
					thumbnail_url: string | null;
					is_public: boolean;
					folder_id: string | null;
					is_deleted: boolean;
					is_archived: boolean;
					is_starred: boolean;
					last_accessed_at: string | null;
					created_at: string;
					updated_at: string;
					deleted_at: string | null;
				};
				Insert: {
					id?: string;
					slug: string;
					name: string;
					owner_id: string;
					data?: string | null;
					thumbnail_url?: string | null;
					is_public?: boolean;
					folder_id?: string | null;
					is_deleted?: boolean;
					is_archived?: boolean;
					is_starred?: boolean;
					last_accessed_at?: string | null;
					created_at?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Update: {
					id?: string;
					slug?: string;
					name?: string;
					owner_id?: string;
					data?: string | null;
					thumbnail_url?: string | null;
					is_public?: boolean;
					folder_id?: string | null;
					is_deleted?: boolean;
					is_archived?: boolean;
					is_starred?: boolean;
					last_accessed_at?: string | null;
					created_at?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
			};
			tags: {
				Row: {
					id: string;
					name: string;
					color: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					color?: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					color?: string;
					created_at?: string;
				};
			};
			tags_on_canvases: {
				Row: {
					canvas_id: string;
					tag_id: string;
					created_at: string;
				};
				Insert: {
					canvas_id: string;
					tag_id: string;
					created_at?: string;
				};
				Update: {
					canvas_id?: string;
					tag_id?: string;
					created_at?: string;
				};
			};
			folders: {
				Row: {
					id: string;
					name: string;
					owner_id: string;
					parent_id: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					owner_id: string;
					parent_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					owner_id?: string;
					parent_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			canvas_versions: {
				Row: {
					id: string;
					canvas_id: string;
					name: string;
					snapshot: string;
					creator_id: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					canvas_id: string;
					name: string;
					snapshot: string;
					creator_id: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					canvas_id?: string;
					name?: string;
					snapshot?: string;
					creator_id?: string;
					created_at?: string;
				};
			};
			activity_logs: {
				Row: {
					id: string;
					user_id: string;
					canvas_id: string;
					action: string;
					created_at: string;
					is_deleted: boolean | null;
					is_public: boolean | null;
					is_starred: boolean;
					last_accessed_at: string | null;
					name: string;
					owner_id: string;
					slug: string | null;
					thumbnail_url: string | null;
					updated_at: string | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					canvas_id: string;
					action: string;
					created_at?: string;
					is_deleted?: boolean | null;
					is_public?: boolean | null;
					is_starred?: boolean;
					last_accessed_at?: string | null;
					name: string;
					owner_id: string;
					slug?: string | null;
					thumbnail_url?: string | null;
					updated_at?: string | null;
				};
				Update: {
					id?: string;
					user_id?: string;
					canvas_id?: string;
					action?: string;
					created_at?: string;
					is_deleted?: boolean | null;
					is_public?: boolean | null;
					is_starred?: boolean;
					last_accessed_at?: string | null;
					name?: string;
					owner_id?: string;
					slug?: string | null;
					thumbnail_url?: string | null;
					updated_at?: string | null;
				};
			};
			users: {
				Row: {
					id: string;
					email: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					email: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					email?: string;
					created_at?: string;
					updated_at?: string;
				};
			};
			roles: {
				Row: {
					id: string;
					name: string;
					description: string | null;
					level: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					description?: string | null;
					level?: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					description?: string | null;
					level?: number;
					created_at?: string;
				};
			};
			user_roles: {
				Row: {
					user_id: string;
					role_id: string;
					assigned_at: string;
					assigned_by: string | null;
				};
				Insert: {
					user_id: string;
					role_id: string;
					assigned_at?: string;
					assigned_by?: string | null;
				};
				Update: {
					user_id?: string;
					role_id?: string;
					assigned_at?: string;
					assigned_by?: string | null;
				};
			};
			room_chat: {
				Row: {
					id: string;
					canvas_id: string;
					user_id: string;
					content: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					canvas_id: string;
					user_id: string;
					content: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					canvas_id?: string;
					user_id?: string;
					content?: string;
					created_at?: string;
					updated_at?: string;
				};
			};
			notifications: {
				Row: {
					id: string;
					user_id: string;
					canvas_id: string;
					type: string;
					message: string;
					is_read: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					canvas_id: string;
					type: string;
					message: string;
					is_read?: boolean;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					canvas_id?: string;
					type?: string;
					message?: string;
					is_read?: boolean;
					created_at?: string;
				};
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
	};
}

// Helper type to extract table row types
export type Tables<T extends keyof Database["public"]["Tables"]> =
	Database["public"]["Tables"][T]["Row"];

// Helper type to extract table insert types
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
	Database["public"]["Tables"][T]["Insert"];

// Helper type to extract table update types
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
	Database["public"]["Tables"][T]["Update"];
