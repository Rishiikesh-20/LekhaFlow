/**
 * ============================================================================
 * LEKHAFLOW - ATTRIBUTION TOOLTIP (Story 7)
 * ============================================================================
 *
 * Hover tooltip that shows who created / last modified a canvas element.
 * Appears when the user hovers over an element while holding Alt, or
 * when they hover with the selection tool and no interaction is active.
 *
 * Design goals:
 * - Non-intrusive: fades in after a short delay so it doesn't flash
 *   while the user is just passing the cursor over elements
 * - Shows creator, last modifier (if different), and timestamps
 * - Styled consistently with the rest of the Excalidraw-like UI
 */

"use client";

import type { CanvasElement } from "@repo/common";
import { Clock, Pencil, User } from "lucide-react";
import { useEffect, useState } from "react";

// ────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────

export interface AttributionTooltipProps {
	/** The element being hovered (null hides the tooltip) */
	element: CanvasElement | null;
	/** Screen-x where the tooltip should appear */
	x: number;
	/** Screen-y where the tooltip should appear */
	y: number;
	/** Delay (ms) before tooltip appears. Default 400. Use 0 in tests. */
	delay?: number;
}

// ────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────

function formatTimestamp(ts: number | undefined): string {
	if (!ts) return "Unknown";
	const d = new Date(ts);
	const now = new Date();
	const diff = now.getTime() - d.getTime();

	// Less than 60 seconds
	if (diff < 60_000) return "Just now";
	// Less than 60 minutes
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	// Less than 24 hours
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	// Same year
	if (d.getFullYear() === now.getFullYear()) {
		return d.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}
	return d.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function capitalizeType(type: string): string {
	return type.charAt(0).toUpperCase() + type.slice(1);
}

// ────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────

export function AttributionTooltip({
	element,
	x,
	y,
	delay = 400,
}: AttributionTooltipProps) {
	const [visible, setVisible] = useState(false);

	// Fade in after a delay to avoid flashing during casual cursor movement
	useEffect(() => {
		if (!element) {
			setVisible(false);
			return;
		}

		if (delay === 0) {
			setVisible(true);
			return;
		}

		const timer = setTimeout(() => setVisible(true), delay);
		return () => clearTimeout(timer);
	}, [element, delay]);

	if (!element || !visible) return null;

	const { createdBy, lastModifiedBy, created, updated, type } = element;

	// Nothing meaningful to show
	if (!createdBy && !lastModifiedBy) return null;

	const showModifiedBy = lastModifiedBy && lastModifiedBy !== createdBy;

	return (
		<div
			className="fixed z-[997] pointer-events-none animate-fade-in"
			style={{ left: x + 12, top: y - 8 }}
		>
			<div
				className="rounded-xl px-3.5 py-2.5 shadow-lg border border-gray-200/80 backdrop-blur-xl"
				style={{
					background: "rgba(255,255,255,0.92)",
					maxWidth: 260,
				}}
			>
				{/* Element type badge */}
				<div className="flex items-center gap-1.5 mb-1.5">
					<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 text-[10px] font-semibold text-violet-600 uppercase tracking-wider">
						{capitalizeType(type)}
					</span>
				</div>

				{/* Created by */}
				{createdBy && (
					<div className="flex items-center gap-2 text-[12px] text-gray-700 leading-snug">
						<User size={12} className="text-gray-400 shrink-0" />
						<span className="text-gray-400">Created by</span>
						<span
							className="font-semibold truncate max-w-[120px]"
							title={createdBy}
						>
							{createdBy}
						</span>
					</div>
				)}

				{/* Created timestamp */}
				{created && (
					<div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5 ml-5">
						<Clock size={10} className="shrink-0" />
						{formatTimestamp(created)}
					</div>
				)}

				{/* Last modified by (only if different from creator) */}
				{showModifiedBy && (
					<div className="flex items-center gap-2 text-[12px] text-gray-700 mt-1.5 leading-snug">
						<Pencil size={12} className="text-gray-400 shrink-0" />
						<span className="text-gray-400">Modified by</span>
						<span
							className="font-semibold truncate max-w-[120px]"
							title={lastModifiedBy}
						>
							{lastModifiedBy}
						</span>
					</div>
				)}

				{/* Updated timestamp */}
				{showModifiedBy && updated && (
					<div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5 ml-5">
						<Clock size={10} className="shrink-0" />
						{formatTimestamp(updated)}
					</div>
				)}
			</div>
		</div>
	);
}
