export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: "14.1";
	};
	public: {
		Tables: {
			activity_logs: {
				Row: {
					action: string;
					canvas_id: string;
					created_at: string | null;
					details: string | null;
					id: string;
					user_id: string;
				};
				Insert: {
					action: string;
					canvas_id: string;
					created_at?: string | null;
					details?: string | null;
					id?: string;
					user_id: string;
				};
				Update: {
					action?: string;
					canvas_id?: string;
					created_at?: string | null;
					details?: string | null;
					id?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "activity_logs_canvas_id_fkey";
						columns: ["canvas_id"];
						isOneToOne: false;
						referencedRelation: "canvases";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "activity_logs_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			canvas_versions: {
				Row: {
					canvas_id: string;
					created_at: string | null;
					creator_id: string | null;
					id: string;
					name: string;
					snapshot: string;
				};
				Insert: {
					canvas_id: string;
					created_at?: string | null;
					creator_id?: string | null;
					id?: string;
					name: string;
					snapshot: string;
				};
				Update: {
					canvas_id?: string;
					created_at?: string | null;
					creator_id?: string | null;
					id?: string;
					name?: string;
					snapshot?: string;
				};
				Relationships: [
					{
						foreignKeyName: "canvas_versions_canvas_id_fkey";
						columns: ["canvas_id"];
						isOneToOne: false;
						referencedRelation: "canvases";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "canvas_versions_creator_id_fkey";
						columns: ["creator_id"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			canvases: {
				Row: {
					created_at: string | null;
					data: string | null;
					deleted_at: string | null;
					folder_id: string | null;
					id: string;
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
					created_at?: string | null;
					data?: string | null;
					deleted_at?: string | null;
					folder_id?: string | null;
					id?: string;
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
					created_at?: string | null;
					data?: string | null;
					deleted_at?: string | null;
					folder_id?: string | null;
					id?: string;
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
				Relationships: [
					{
						foreignKeyName: "canvases_folder_id_fkey";
						columns: ["folder_id"];
						isOneToOne: false;
						referencedRelation: "folders";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "canvases_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			folders: {
				Row: {
					created_at: string | null;
					id: string;
					name: string;
					owner_id: string;
					parent_id: string | null;
					updated_at: string | null;
				};
				Insert: {
					created_at?: string | null;
					id?: string;
					name: string;
					owner_id: string;
					parent_id?: string | null;
					updated_at?: string | null;
				};
				Update: {
					created_at?: string | null;
					id?: string;
					name?: string;
					owner_id?: string;
					parent_id?: string | null;
					updated_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "folders_owner_id_fkey";
						columns: ["owner_id"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "folders_parent_id_fkey";
						columns: ["parent_id"];
						isOneToOne: false;
						referencedRelation: "folders";
						referencedColumns: ["id"];
					},
				];
			};
			tags: {
				Row: {
					color: string | null;
					id: string;
					name: string;
				};
				Insert: {
					color?: string | null;
					id?: string;
					name: string;
				};
				Update: {
					color?: string | null;
					id?: string;
					name?: string;
				};
				Relationships: [];
			};
			tags_on_canvases: {
				Row: {
					canvas_id: string;
					tag_id: string;
				};
				Insert: {
					canvas_id: string;
					tag_id: string;
				};
				Update: {
					canvas_id?: string;
					tag_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "tags_on_canvases_canvas_id_fkey";
						columns: ["canvas_id"];
						isOneToOne: false;
						referencedRelation: "canvases";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "tags_on_canvases_tag_id_fkey";
						columns: ["tag_id"];
						isOneToOne: false;
						referencedRelation: "tags";
						referencedColumns: ["id"];
					},
				];
			};
			users: {
				Row: {
					avatar_url: string | null;
					created_at: string | null;
					email: string;
					id: string;
					name: string | null;
					updated_at: string | null;
				};
				Insert: {
					avatar_url?: string | null;
					created_at?: string | null;
					email: string;
					id: string;
					name?: string | null;
					updated_at?: string | null;
				};
				Update: {
					avatar_url?: string | null;
					created_at?: string | null;
					email?: string;
					id?: string;
					name?: string | null;
					updated_at?: string | null;
				};
				Relationships: [];
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
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
	keyof Database,
	"public"
>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
				DefaultSchema["Views"])
		? (DefaultSchema["Tables"] &
				DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema["Enums"]
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {},
	},
} as const;
