/**
 * ============================================================================
 * LEKHAFLOW - BEAUTIFY BUTTON
 * ============================================================================
 *
 * Floating action button that appears when freedraw (pencil) elements are
 * selected. Clicking it replaces the rough hand-drawn strokes with clean
 * geometric shapes detected via heuristics.
 */

"use client";

import { Sparkles } from "lucide-react";

interface BeautifyButtonProps {
	/** Whether any beautifiable (freedraw) elements are selected */
	visible: boolean;
	/** Callback when the user clicks the beautify button */
	onBeautify: () => void;
}

export function BeautifyButton({ visible, onBeautify }: BeautifyButtonProps) {
	if (!visible) return null;

	return (
		<div
			className="fixed z-[var(--z-toolbar)]"
			style={{
				bottom: "16px",
				left: "16px",
				animation: "fade-in 0.2s ease-out, slide-in-bottom 0.25s ease-out",
			}}
		>
			<button
				type="button"
				onClick={onBeautify}
				title="Beautify selected sketches — convert rough strokes into clean shapes (B)"
				className="
					flex items-center gap-2 px-4 py-2.5
					bg-gradient-to-r from-violet-500 to-purple-600
					text-white text-sm font-semibold
					rounded-full shadow-lg
					border-none cursor-pointer
					hover:from-violet-600 hover:to-purple-700
					hover:shadow-xl hover:scale-105
					active:scale-95
					transition-all duration-150
				"
			>
				<Sparkles size={16} />
				Beautify
			</button>
		</div>
	);
}
