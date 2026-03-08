/**
 * ============================================================================
 * LEKHAFLOW - TEXT FORMATTING TOOLBAR
 * ============================================================================
 *
 * Contextual floating toolbar shown during text editing.
 * Provides font family, font size, bold, italic, underline controls.
 *
 * Phase 1 Foundation: toggles update activeTextStyle in store.
 * Inline range formatting is deferred to Phase 2+.
 */

"use client";

import { Bold, ChevronDown, Italic, Underline } from "lucide-react";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { useCanvasStore } from "../../store/canvas-store";

// ============================================================================
// CONSTANTS
// ============================================================================

const FONT_FAMILIES = [
	"Arial",
	"Helvetica",
	"Georgia",
	"Times New Roman",
	"Courier New",
	"Verdana",
	"Trebuchet MS",
	"Comic Sans MS",
] as const;

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];

// ============================================================================
// COMPONENT
// ============================================================================

export function TextFormattingToolbar() {
	const activeTextStyle = useCanvasStore((s) => s.activeTextStyle);
	const dispatchFormatCommand = useCanvasStore((s) => s.dispatchFormatCommand);

	const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
	const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
	const fontDropdownRef = useRef<HTMLDivElement>(null);
	const sizeDropdownRef = useRef<HTMLDivElement>(null);
	const sizeInputRef = useRef<HTMLInputElement>(null);

	// Close dropdowns on outside click
	const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
		// Check if the new focus target is still inside our toolbar
		if (!e.currentTarget.contains(e.relatedTarget as Node)) {
			setFontDropdownOpen(false);
			setSizeDropdownOpen(false);
		}
	}, []);

	const handleFontSelect = useCallback(
		(font: string) => {
			dispatchFormatCommand({ fontFamily: font });
			setFontDropdownOpen(false);
		},
		[dispatchFormatCommand],
	);

	const handleSizeSelect = useCallback(
		(size: number) => {
			dispatchFormatCommand({ fontSize: size });
			setSizeDropdownOpen(false);
		},
		[dispatchFormatCommand],
	);

	const handleSizeInputCommit = useCallback(() => {
		const input = sizeInputRef.current;
		if (!input) return;
		const val = Number.parseInt(input.value, 10);
		if (val >= 1 && val <= 200) {
			dispatchFormatCommand({ fontSize: val });
		} else {
			// Reset to current value if invalid
			input.value = String(activeTextStyle.fontSize);
		}
	}, [dispatchFormatCommand, activeTextStyle.fontSize]);

	const toggleBold = useCallback(() => {
		dispatchFormatCommand({ bold: !activeTextStyle.bold || undefined });
	}, [dispatchFormatCommand, activeTextStyle.bold]);

	const toggleItalic = useCallback(() => {
		dispatchFormatCommand({ italic: !activeTextStyle.italic || undefined });
	}, [dispatchFormatCommand, activeTextStyle.italic]);

	const toggleUnderline = useCallback(() => {
		dispatchFormatCommand({
			underline: !activeTextStyle.underline || undefined,
		});
	}, [dispatchFormatCommand, activeTextStyle.underline]);

	return (
		<div
			role="toolbar"
			className="absolute left-1/2 -translate-x-1/2 z-[var(--z-toolbar)]"
			style={{ top: "76px" }}
			onBlur={handleBlur}
			onMouseDown={(e) => e.preventDefault()}
		>
			<div
				className="glass-card-elevated flex items-center gap-1 px-2 py-1.5"
				style={{
					borderRadius: "12px",
					height: "44px",
					boxShadow: "var(--shadow-lg)",
					animation: "fade-in 0.2s ease-out",
				}}
			>
				{/* ── Font Family Dropdown ── */}
				<div className="relative" ref={fontDropdownRef}>
					<button
						type="button"
						onClick={() => {
							setFontDropdownOpen((v) => !v);
							setSizeDropdownOpen(false);
						}}
						className="flex items-center gap-1 px-2 h-8 rounded-md text-sm
							text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer
							border border-gray-200 min-w-[120px] justify-between"
						title="Font family"
					>
						<span
							className="truncate"
							style={{ fontFamily: activeTextStyle.fontFamily }}
						>
							{activeTextStyle.fontFamily}
						</span>
						<ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
					</button>

					{fontDropdownOpen && (
						<div
							className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg border border-gray-200 py-1 max-h-60 overflow-y-auto"
							style={{ boxShadow: "var(--shadow-lg)", zIndex: 100 }}
						>
							{FONT_FAMILIES.map((font) => (
								<button
									type="button"
									key={font}
									onClick={() => handleFontSelect(font)}
									className={`w-full text-left px-3 py-1.5 text-sm hover:bg-violet-50 cursor-pointer transition-colors ${
										activeTextStyle.fontFamily === font
											? "bg-violet-50 text-violet-600 font-medium"
											: "text-gray-700"
									}`}
									style={{ fontFamily: font }}
								>
									{font}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Separator */}
				<div className="h-5 w-px bg-gray-200 mx-0.5" />

				{/* ── Font Size ── */}
				<div className="relative" ref={sizeDropdownRef}>
					<div className="flex items-center">
						<input
							ref={sizeInputRef}
							type="text"
							inputMode="numeric"
							defaultValue={activeTextStyle.fontSize}
							key={activeTextStyle.fontSize}
							className="w-10 h-8 text-center text-sm rounded-md border border-gray-200
								text-gray-700 focus:outline-none focus:border-violet-400"
							title="Font size"
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									handleSizeInputCommit();
									(e.target as HTMLInputElement).blur();
								}
							}}
							onBlur={handleSizeInputCommit}
						/>
						<button
							type="button"
							onClick={() => {
								setSizeDropdownOpen((v) => !v);
								setFontDropdownOpen(false);
							}}
							className="flex items-center justify-center w-5 h-8 rounded-r-md
								text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer -ml-px"
							title="Font size presets"
						>
							<ChevronDown size={12} />
						</button>
					</div>

					{sizeDropdownOpen && (
						<div
							className="absolute top-full left-0 mt-1 w-20 bg-white rounded-lg border border-gray-200 py-1 max-h-48 overflow-y-auto"
							style={{ boxShadow: "var(--shadow-lg)", zIndex: 100 }}
						>
							{FONT_SIZES.map((size) => (
								<button
									type="button"
									key={size}
									onClick={() => handleSizeSelect(size)}
									className={`w-full text-center px-2 py-1 text-sm hover:bg-violet-50 cursor-pointer transition-colors ${
										activeTextStyle.fontSize === size
											? "bg-violet-50 text-violet-600 font-medium"
											: "text-gray-700"
									}`}
								>
									{size}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Separator */}
				<div className="h-5 w-px bg-gray-200 mx-0.5" />

				{/* ── Bold ── */}
				<button
					type="button"
					onClick={toggleBold}
					title="Bold"
					className={`w-8 h-8 rounded-md flex items-center justify-center
						transition-colors cursor-pointer border-none
						${
							activeTextStyle.bold
								? "bg-violet-100 text-violet-600"
								: "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
						}`}
				>
					<Bold size={16} />
				</button>

				{/* ── Italic ── */}
				<button
					type="button"
					onClick={toggleItalic}
					title="Italic"
					className={`w-8 h-8 rounded-md flex items-center justify-center
						transition-colors cursor-pointer border-none
						${
							activeTextStyle.italic
								? "bg-violet-100 text-violet-600"
								: "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
						}`}
				>
					<Italic size={16} />
				</button>

				{/* ── Underline ── */}
				<button
					type="button"
					onClick={toggleUnderline}
					title="Underline"
					className={`w-8 h-8 rounded-md flex items-center justify-center
						transition-colors cursor-pointer border-none
						${
							activeTextStyle.underline
								? "bg-violet-100 text-violet-600"
								: "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
						}`}
				>
					<Underline size={16} />
				</button>
			</div>
		</div>
	);
}
