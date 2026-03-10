const fs = require("node:fs");
const path = require("node:path");

const rbacPath = path.join(__dirname, "apps/web/app/rbac/page.tsx");
const lines = fs.readFileSync(rbacPath, "utf8").split("\n");

// Find lines with })); after map((item: any) => ({
// Then insert .filter after them

for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes("\t\t\t\t\t}));") && i > 0) {
		// Check if previous lines have the map pattern
		const linesBefore = lines.slice(Math.max(0, i - 6), i).join("\n");
		if (
			linesBefore.includes("const normalized = urData.map((item: any) => ({")
		) {
			// Insert filter after }));
			const indent = "\t\t\t\t\t\t";
			lines[i] =
				lines[i].replace("}));", "}))") +
				"\n" +
				indent +
				".filter((item): item is UserRole => item.users !== undefined);";
			console.log(`Fixed occurrence at line ${i + 1} (useEffect)`);
		}
	} else if (lines[i].includes("\t\t\t\t}));") && i > 0) {
		// Check for the second occurrence with different indentation
		const linesBefore = lines.slice(Math.max(0, i - 6), i).join("\n");
		if (
			linesBefore.includes("const normalized = urData.map((item: any) => ({")
		) {
			// Insert filter after }));
			const indent = "\t\t\t\t\t";
			lines[i] =
				lines[i].replace("}));", "}))") +
				"\n" +
				indent +
				".filter((item): item is UserRole => item.users !== undefined);";
			console.log(`Fixed occurrence at line ${i + 1} (handleRoleChange)`);
		}
	}
}

fs.writeFileSync(rbacPath, lines.join("\n"), "utf8");
console.log("Fixed RBAC type issues");
