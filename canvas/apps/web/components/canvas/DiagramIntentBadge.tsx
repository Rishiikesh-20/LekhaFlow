/**
 * ============================================================================
 * LEKHAFLOW - DIAGRAM INTENT BADGE
 * ============================================================================
 *
 * Bottom-left floating badge that shows the detected diagram type.
 */

"use client";

import {
	AppWindow,
	Binary,
	Database,
	Network,
	Server,
	Sparkles,
	Tags,
} from "lucide-react";
import type { DiagramType } from "../../lib/diagram-classifier";

interface DiagramIntentBadgeProps {
	intent: DiagramType;
}

export function DiagramIntentBadge({ intent }: DiagramIntentBadgeProps) {
	if (intent === "Generic") {
		return null; // Hide badge if unrecognized/generic
	}

	const getIcon = () => {
		switch (intent) {
			case "Flowchart":
				return <Binary size={16} />;
			case "ER Diagram":
				return <Database size={16} />;
			case "Architecture Diagram":
				return <Server size={16} />;
			case "Mind Map":
				return <Network size={16} />;
			case "Wireframe":
				return <AppWindow size={16} />;
			default:
				return <Tags size={16} />;
		}
	};

	return (
		<div
			className="fixed z-[var(--z-controls)] pointer-events-none"
			style={{ bottom: "16px", left: "16px" }}
		>
			<div
				className="glass-card-elevated flex items-center gap-2 px-3 py-2 mb-3"
				style={{
					borderRadius: "24px",
					boxShadow: "var(--shadow-md)",
					animation: "fade-in 0.3s ease-out backwards",
				}}
			>
				<div className="text-violet-600 flex items-center justify-center relative">
					{/* Add a little sparkle to the icon to show it's "AI-determined" logic */}
					<div className="absolute -top-1 -right-1 text-yellow-400">
						<Sparkles size={8} />
					</div>
					{getIcon()}
				</div>
				<span className="text-sm font-medium text-gray-700">{intent}</span>
			</div>
		</div>
	);
}
