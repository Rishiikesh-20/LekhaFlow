"use client";

import { AlertCircle, CheckCircle, ExternalLink, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.client";

interface TableStatus {
	name: string;
	exists: boolean;
	description: string;
	sqlFile: string;
}

export function SetupStatus() {
	const [isOpen, setIsOpen] = useState(false);
	const [checking, setChecking] = useState(false);
	const [tables, setTables] = useState<TableStatus[]>([]);
	const [allTablesExist, setAllTablesExist] = useState(true);

	const checkTables = useCallback(async () => {
		setChecking(true);
		const tablesToCheck = [
			{ name: "roles", description: "RBAC system roles", sqlFile: "rbac.sql" },
			{
				name: "user_roles",
				description: "User role assignments",
				sqlFile: "rbac.sql",
			},
			{
				name: "room_chat",
				description: "Chat messages",
				sqlFile: "room_chat.sql",
			},
			{
				name: "notifications",
				description: "User notifications",
				sqlFile: "notifications.sql",
			},
		];

		const results: TableStatus[] = [];
		let allExist = true;

		for (const table of tablesToCheck) {
			// Try a simple select to check if table exists
			const { error } = await supabase.from(table.name).select("*").limit(1);

			const exists = !error || error.code !== "42P01"; // 42P01 = table doesn't exist
			if (!exists) allExist = false;

			results.push({
				...table,
				exists,
			});
		}

		setTables(results);
		setAllTablesExist(allExist);
		setChecking(false);

		// Auto-open if tables are missing
		if (!allExist) {
			setIsOpen(true);
		}
	}, []);

	useEffect(() => {
		checkTables();
	}, [checkTables]);

	if (allTablesExist && !isOpen) {
		return null; // Don't show if everything is set up
	}

	return (
		<>
			{!allTablesExist && !isOpen && (
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="fixed bottom-4 left-4 z-50 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-amber-600 transition-colors flex items-center gap-2 animate-pulse"
				>
					<AlertCircle size={20} />
					<span className="font-semibold">Setup Required</span>
				</button>
			)}

			{isOpen && (
				<div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
					<div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
						{/* Header */}
						<div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50">
							<div>
								<h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
									<AlertCircle className="text-amber-500" />
									Database Setup Status
								</h2>
								<p className="text-sm text-gray-600 mt-1">
									Some features require database migrations
								</p>
							</div>
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								className="p-2 hover:bg-white/50 rounded-lg transition-colors"
							>
								<X size={20} />
							</button>
						</div>

						{/* Table Status */}
						<div className="p-6">
							<div className="space-y-3 mb-6">
								{tables.map((table) => (
									<div
										key={table.name}
										className={`p-4 rounded-lg border-2 ${
											table.exists
												? "border-green-200 bg-green-50"
												: "border-amber-200 bg-amber-50"
										}`}
									>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-2">
													{table.exists ? (
														<CheckCircle size={20} className="text-green-600" />
													) : (
														<AlertCircle size={20} className="text-amber-600" />
													)}
													<code className="font-mono text-sm font-semibold">
														{table.name}
													</code>
												</div>
												<p className="text-sm text-gray-600 mt-1 ml-7">
													{table.description}
												</p>
											</div>
											<div className="text-right">
												{table.exists ? (
													<span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">
														Ready
													</span>
												) : (
													<span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
														Missing
													</span>
												)}
											</div>
										</div>
										{!table.exists && (
											<div className="mt-2 ml-7 text-xs text-amber-700">
												Run:{" "}
												<code className="bg-amber-100 px-1 rounded">
													canvas/{table.sqlFile}
												</code>
											</div>
										)}
									</div>
								))}
							</div>

							{/* Setup Instructions */}
							{!allTablesExist && (
								<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
									<h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
										📋 Setup Instructions
									</h3>
									<ol className="space-y-2 text-sm text-blue-800">
										<li className="flex gap-2">
											<span className="font-semibold">1.</span>
											<div>
												Open your{" "}
												<a
													href="https://supabase.com/dashboard"
													target="_blank"
													rel="noopener noreferrer"
													className="underline hover:text-blue-600 inline-flex items-center gap-1"
												>
													Supabase Dashboard
													<ExternalLink size={12} />
												</a>
											</div>
										</li>
										<li className="flex gap-2">
											<span className="font-semibold">2.</span>
											<span>Navigate to: SQL Editor → New Query</span>
										</li>
										<li className="flex gap-2">
											<span className="font-semibold">3.</span>
											<span>
												Run the missing SQL migration files from the{" "}
												<code className="bg-blue-100 px-1 rounded">
													canvas/
												</code>{" "}
												directory
											</span>
										</li>
										<li className="flex gap-2">
											<span className="font-semibold">4.</span>
											<span>Click "Check Again" below to verify</span>
										</li>
									</ol>
								</div>
							)}

							{/* Actions */}
							<div className="flex gap-3 mt-6">
								<button
									type="button"
									onClick={checkTables}
									disabled={checking}
									className="flex-1 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{checking ? "Checking..." : "Check Again"}
								</button>
								{allTablesExist && (
									<button
										type="button"
										onClick={() => setIsOpen(false)}
										className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
									>
										Close
									</button>
								)}
							</div>

							{/* Success Message */}
							{allTablesExist && (
								<div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
									<p className="text-sm text-green-800 font-semibold text-center">
										✅ All required tables are set up! You're ready to use all
										features.
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}
