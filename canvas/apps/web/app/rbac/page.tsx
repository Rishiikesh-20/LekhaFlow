"use client";

import { ArrowLeft, Shield, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.client";

const HTTP_URL = process.env.NEXT_PUBLIC_HTTP_URL || "http://localhost:8000";

interface Role {
	id: string;
	name: string;
	description: string;
	level: number;
}

interface UserRole {
	user_id: string;
	role_id: string;
	users: { name: string; email: string };
	roles: Role;
}

export default function RBACDashboard() {
	const [roles, setRoles] = useState<Role[]>([]);
	const [userRoles, setUserRoles] = useState<UserRole[]>([]);
	const [loading, setLoading] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);
	const [error, setError] = useState("");
	const [changingRole, setChangingRole] = useState<string | null>(null);
	const [selectedNewRole, setSelectedNewRole] = useState<string>("");

	useEffect(() => {
		async function fetchRbacData() {
			try {
				const { data: sessionData } = await supabase.auth.getSession();
				if (!sessionData.session) {
					setError("You must be logged in to view roles.");
					setLoading(false);
					return;
				}

				// Check if current user is admin
				const { data: myRoleData, error: myRoleError } = await supabase
					.from("user_roles")
					.select("roles(name, level)")
					.eq("user_id", sessionData.session.user.id)
					.single();

				// If table doesn't exist, provide helpful error
				if (myRoleError && myRoleError.code === "42P01") {
					throw new Error(
						"RBAC tables not found. Please run the rbac.sql migration in Supabase.",
					);
				}

				const roleData = myRoleData?.roles as
					| { name: string; level: number }
					| { name: string; level: number }[]
					| undefined;
				const isCurrentUserAdmin =
					(Array.isArray(roleData) ? roleData[0]?.name : roleData?.name) ===
					"admin";
				setIsAdmin(isCurrentUserAdmin);

				// Fetch roles
				const { data: rolesData, error: rolesError } = await supabase
					.from("roles")
					.select("*")
					.order("level", { ascending: false });

				if (rolesError) {
					console.error("Roles query error:", rolesError);
					throw new Error(rolesError.message || "Failed to fetch roles");
				}
				setRoles(rolesData || []);

				// Fetch user roles
				const { data: urData, error: urError } = await supabase
					.from("user_roles")
					.select("user_id, role_id, users(name, email), roles(*)");

				if (urError) {
					console.error("User roles query error:", urError);
					// Don't throw - just show empty user roles
				}

				if (urData) {
					// Normalize Supabase join data (arrays to single objects)
					const normalized = urData
						.map(
							(item: {
								user_id: string;
								role_id: string;
								users:
									| { name: string; email: string }
									| { name: string; email: string }[];
								roles: Role | Role[];
							}) => ({
								user_id: item.user_id,
								role_id: item.role_id,
								users: Array.isArray(item.users) ? item.users[0] : item.users,
								roles: Array.isArray(item.roles) ? item.roles[0] : item.roles,
							}),
						)
						.filter((item): item is UserRole => item.users !== undefined);
					setUserRoles(normalized);
				}
			} catch (err: unknown) {
				console.error("RBAC fetch error:", err);
				setError(
					err instanceof Error
						? err.message
						: "Failed to load RBAC data. Have you run the SQL migrations?",
				);
			} finally {
				setLoading(false);
			}
		}

		fetchRbacData();
	}, []);

	const handleChangeRole = async (userId: string, newRoleId: string) => {
		try {
			const { data: sessionData } = await supabase.auth.getSession();
			if (!sessionData.session) {
				alert("You must be logged in");
				return;
			}

			const res = await fetch(`${HTTP_URL}/api/v1/rbac/assign`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${sessionData.session.access_token}`,
				},
				body: JSON.stringify({
					targetUserId: userId,
					roleId: newRoleId,
				}),
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.message || "Failed to change role");
			}

			// Refresh user roles
			const { data: urData } = await supabase
				.from("user_roles")
				.select("user_id, role_id, users(name, email), roles(*)");

			if (urData) {
				// Normalize Supabase join data (arrays to single objects)
				const normalized = urData
					.map(
						(item: {
							user_id: string;
							role_id: string;
							users:
								| { name: string; email: string }
								| { name: string; email: string }[];
							roles: Role | Role[];
						}) => ({
							user_id: item.user_id,
							role_id: item.role_id,
							users: Array.isArray(item.users) ? item.users[0] : item.users,
							roles: Array.isArray(item.roles) ? item.roles[0] : item.roles,
						}),
					)
					.filter((item): item is UserRole => item.users !== undefined);
				setUserRoles(normalized);
			}

			setChangingRole(null);
			setSelectedNewRole("");
		} catch (err: unknown) {
			console.error("Error changing role:", err);
			alert(err instanceof Error ? err.message : "Failed to change role");
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-[#f8f7f4]">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen p-8 bg-[#f8f7f4] flex flex-col items-center justify-center">
				<ShieldAlert size={48} className="text-red-500 mb-4" />
				<h2 className="text-xl font-bold mb-2">RBAC Setup Required</h2>
				<p className="text-gray-600 mb-4 text-center max-w-md">{error}</p>

				{error.includes("migration") && (
					<div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 max-w-2xl">
						<h3 className="font-semibold text-amber-900 mb-2">
							📋 Setup Instructions:
						</h3>
						<ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
							<li>Open your Supabase dashboard SQL Editor</li>
							<li>
								Navigate to:{" "}
								<code className="bg-amber-100 px-1 rounded">
									canvas/rbac.sql
								</code>
							</li>
							<li>Copy and run the entire SQL script</li>
							<li>Refresh this page</li>
						</ol>
					</div>
				)}

				<Link href="/">
					<button
						type="button"
						className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
					>
						Return Home
					</button>
				</Link>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f8f7f4] p-8">
			<div className="max-w-4xl mx-auto space-y-8">
				<div className="flex items-center gap-4">
					<Link
						href="/"
						className="p-2 bg-white rounded-lg ring-1 ring-gray-200 hover:bg-gray-50"
					>
						<ArrowLeft size={16} />
					</Link>
					<h1 className="text-2xl font-bold font-heading flex items-center gap-2">
						<Shield className="text-violet-600" />
						RBAC Dashboard
					</h1>
				</div>

				{/* Available Roles */}
				<div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-gray-200">
					<h2 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">
						System Roles
					</h2>
					<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
						{roles.map((r) => (
							<div
								key={r.id}
								className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col gap-1"
							>
								<div className="font-semibold text-gray-800 capitalize flex items-center justify-between">
									{r.name}
									<span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
										Level: {r.level}
									</span>
								</div>
								<div className="text-sm text-gray-500">{r.description}</div>
							</div>
						))}
					</div>
				</div>

				{/* User Permissions Table */}
				<div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl overflow-hidden">
					<div className="p-6 border-b border-gray-100 bg-white flex justify-between items-center">
						<h2 className="text-lg font-semibold text-gray-800">
							User Permissions
						</h2>
						{!isAdmin && (
							<span className="text-xs flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
								<ShieldAlert size={14} /> Read-only view
							</span>
						)}
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm text-gray-600">
							<thead className="bg-gray-50/50 text-gray-500 uppercase text-xs">
								<tr>
									<th className="px-6 py-4 font-medium">User</th>
									<th className="px-6 py-4 font-medium">Role</th>
									<th className="px-6 py-4 font-medium text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{userRoles.length === 0 ? (
									<tr>
										<td
											colSpan={3}
											className="px-6 py-8 text-center text-gray-400"
										>
											No user roles found. Make sure you run the RBAC sql
											migration!
										</td>
									</tr>
								) : (
									userRoles.map((ur) => (
										<tr
											key={`${ur.user_id}-${ur.role_id}`}
											className="hover:bg-gray-50/50 transition-colors"
										>
											<td className="px-6 py-4">
												<div className="font-medium text-gray-900">
													{ur.users?.name || ur.users?.email || "Unknown User"}
												</div>
												<div className="text-xs text-gray-500">
													{ur.users?.email}
												</div>
											</td>
											<td className="px-6 py-4">
												{changingRole === ur.user_id && isAdmin ? (
													<select
														value={selectedNewRole || ur.role_id}
														onChange={(e) => setSelectedNewRole(e.target.value)}
														className="text-xs border border-violet-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
													>
														{roles.map((r) => (
															<option key={r.id} value={r.id}>
																{r.name}
															</option>
														))}
													</select>
												) : (
													<span
														className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
															ur.roles.name === "admin"
																? "bg-red-100 text-red-700"
																: ur.roles.name === "editor"
																	? "bg-blue-100 text-blue-700"
																	: "bg-gray-100 text-gray-700"
														}`}
													>
														{ur.roles.name}
													</span>
												)}
											</td>
											<td className="px-6 py-4 text-right">
												{isAdmin ? (
													changingRole === ur.user_id ? (
														<div className="flex gap-2 justify-end">
															<button
																type="button"
																onClick={() =>
																	handleChangeRole(
																		ur.user_id,
																		selectedNewRole || ur.role_id,
																	)
																}
																className="text-green-600 hover:text-green-800 text-xs font-medium px-3 py-1 rounded border border-green-200 hover:bg-green-50 transition-colors"
															>
																Save
															</button>
															<button
																type="button"
																onClick={() => {
																	setChangingRole(null);
																	setSelectedNewRole("");
																}}
																className="text-gray-600 hover:text-gray-800 text-xs font-medium px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
															>
																Cancel
															</button>
														</div>
													) : (
														<button
															type="button"
															onClick={() => {
																setChangingRole(ur.user_id);
																setSelectedNewRole(ur.role_id);
															}}
															className="text-violet-600 hover:text-violet-800 text-xs font-medium px-3 py-1 rounded border border-violet-200 hover:bg-violet-50 transition-colors"
														>
															Change Role
														</button>
													)
												) : (
													<span className="text-gray-400 text-xs">
														Restricted
													</span>
												)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
