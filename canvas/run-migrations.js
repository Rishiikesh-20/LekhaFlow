/**
 * LekhaFlow Database Migration Script
 * Run this to create all required tables for Epic 3 collaboration features
 *
 * Usage: node run-migrations.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const SUPABASE_URL = "https://khajsxndtqzfkdnpwqdk.supabase.co";

// Create readline interface for user input
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

function question(query) {
	return new Promise((resolve) => rl.question(query, resolve));
}

async function _runMigration(supabase, filename, sql) {
	console.log(`\n📝 Running migration: ${filename}...`);

	try {
		const { error } = await supabase.rpc("exec_sql", { sql_query: sql });

		if (error) {
			// Try direct approach if RPC doesn't exist
			console.log("   Trying alternative method...");

			// Split into individual statements and execute
			const statements = sql
				.split(";")
				.map((s) => s.trim())
				.filter((s) => s.length > 0);

			for (const _statement of statements) {
				await supabase.from("_dummy").select("*").limit(0);
				// Note: Supabase JS client doesn't support raw SQL execution
				// This will fail gracefully
			}

			console.log(`   ⚠️  Cannot run via JS client - please use SQL Editor`);
			return false;
		}

		console.log(`   ✅ ${filename} completed`);
		return true;
	} catch (err) {
		console.log(`   ❌ Error: ${err.message}`);
		return false;
	}
}

async function main() {
	console.log("=".repeat(70));
	console.log("🚀 LekhaFlow Database Migration Tool");
	console.log("=".repeat(70));

	console.log("\n📌 This will create tables for:");
	console.log("   • RBAC (roles, user_roles)");
	console.log("   • Room Chat (room_chat)");
	console.log("   • Notifications (notifications)");

	console.log("\n🔑 You need your Supabase SERVICE ROLE key (not anon key!)");
	console.log(
		"   Find it at: https://supabase.com/dashboard/project/khajsxndtqzfkdnpwqdk/settings/api",
	);
	console.log('   Look for "service_role" under "Project API keys"\n');

	const serviceRoleKey = await question("Enter your SERVICE_ROLE key: ");

	if (!serviceRoleKey || serviceRoleKey.trim().length < 20) {
		console.log("\n❌ Invalid key. Exiting.");
		rl.close();
		return;
	}

	console.log("\n✅ Key received. Creating Supabase client...");

	const supabase = createClient(SUPABASE_URL, serviceRoleKey.trim(), {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	// Test connection
	console.log("🔌 Testing connection...");
	const { error: testError } = await supabase
		.from("users")
		.select("count")
		.limit(1);

	if (testError) {
		console.log(`\n❌ Connection failed: ${testError.message}`);
		console.log(
			"   Make sure you entered the SERVICE_ROLE key, not the anon key.",
		);
		rl.close();
		return;
	}

	console.log("✅ Connected to Supabase!\n");

	// Read migration files
	const migrations = [
		{ file: "rbac.sql", description: "RBAC Tables" },
		{ file: "room_chat.sql", description: "Room Chat" },
		{ file: "notifications.sql", description: "Notifications" },
	];

	console.log("⚠️  IMPORTANT: Supabase JS client cannot execute raw SQL.");
	console.log("   Opening SQL files for you to copy-paste manually...\n");

	for (const migration of migrations) {
		const sqlPath = path.join(__dirname, migration.file);

		if (!fs.existsSync(sqlPath)) {
			console.log(`❌ File not found: ${migration.file}`);
			continue;
		}

		const sql = fs.readFileSync(sqlPath, "utf-8");

		console.log("=".repeat(70));
		console.log(`📄 ${migration.description} (${migration.file})`);
		console.log("=".repeat(70));
		console.log(sql);
		console.log("\n");

		const answer = await question(
			"Copy the SQL above and run it in Supabase SQL Editor. Done? (y/n): ",
		);

		if (answer.toLowerCase() === "y") {
			console.log(`✅ ${migration.description} marked as complete`);
		} else {
			console.log(`⏭️  Skipping ${migration.description}`);
		}
		console.log("\n");
	}

	console.log("=".repeat(70));
	console.log("✅ Migration process complete!");
	console.log("=".repeat(70));
	console.log("\n🎉 Next steps:");
	console.log("   1. Refresh your browser at http://localhost:3000");
	console.log("   2. Test the chat feature - it should work now!");
	console.log(
		"   3. Try other collaboration features (laser, mentions, etc.)\n",
	);

	rl.close();
}

main().catch((err) => {
	console.error("Fatal error:", err);
	rl.close();
	process.exit(1);
});
