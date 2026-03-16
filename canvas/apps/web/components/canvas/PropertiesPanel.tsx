/**
 * ============================================================================
 * LEKHAFLOW - PROPERTIES PANEL
 * ============================================================================
 *
 * Right sidebar for element styling properties.
 */

"use client";

import type { TextElement, TextRun } from "@repo/common";
import {
	Bold,
	ChevronDown,
	ChevronRight,
	Italic,
	Lock,
	Palette,
	Plus,
	Underline,
	Unlock,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { layoutRuns, mergeAdjacentRuns } from "../../lib/text-runs";
import { useCanvasStore, useSelectedElements } from "../../store/canvas-store";

type StrokeStyle = "solid" | "dashed" | "dotted";
type FillStyle = "solid" | "hachure" | "cross-hatch" | "none";

const STROKE_COLORS = [
	{ color: "#1e1e1e", name: "Black" },
	{ color: "#e03131", name: "Red" },
	{ color: "#2f9e44", name: "Green" },
	{ color: "#1971c2", name: "Blue" },
	{ color: "#f08c00", name: "Orange" },
	{ color: "#9c36b5", name: "Purple" },
	{ color: "#868e96", name: "Gray" },
	{ color: "#099268", name: "Teal" },
];

const BACKGROUND_COLORS = [
	{ color: "transparent", name: "None" },
	{ color: "#ffffff", name: "White" },
	{ color: "#ffc9c9", name: "Light Red" },
	{ color: "#b2f2bb", name: "Light Green" },
	{ color: "#a5d8ff", name: "Light Blue" },
	{ color: "#ffec99", name: "Light Yellow" },
	{ color: "#eebefa", name: "Light Purple" },
	{ color: "#ced4da", name: "Light Gray" },
];

const STROKE_WIDTHS = [1, 2, 4, 6];

const BRUSH_OPTIONS = [
	{
		type: "pencil" as const,
		label: "Pencil",
		icon: "✏",
		desc: "Thin & precise",
	},
	{
		type: "spray" as const,
		label: "Spray",
		icon: "💨",
		desc: "Scattered dots",
	},
	{
		type: "watercolour" as const,
		label: "Watercolour",
		icon: "💧",
		desc: "Soft & blended",
	},
];

const TEXT_FONT_FAMILIES = [
	"Arial",
	"Helvetica",
	"Georgia",
	"Times New Roman",
	"Courier New",
	"Verdana",
	"Trebuchet MS",
	"Comic Sans MS",
] as const;

const TEXT_FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];

interface PropertiesPanelProps {
	onUpdateSettings?: (updates: Record<string, unknown>) => void;
}

export function PropertiesPanel({ onUpdateSettings }: PropertiesPanelProps) {
	const [isCollapsed, setIsCollapsed] = useState(true);
	const [isBrushDropdownOpen, setIsBrushDropdownOpen] = useState(false);
	const [isFontFamilyOpen, setIsFontFamilyOpen] = useState(false);
	const [isFontSizeOpen, setIsFontSizeOpen] = useState(false);
	const brushDropdownRef = useRef<HTMLDivElement>(null);
	const fontFamilyDropdownRef = useRef<HTMLDivElement>(null);
	const fontSizeDropdownRef = useRef<HTMLDivElement>(null);
	const fontSizeInputRef = useRef<HTMLInputElement>(null);
	const customColorInputRef = useRef<HTMLInputElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);

	// Attach a native wheel listener that stops propagation so the canvas
	// window-level wheel handler (which pans/zooms) never fires when scrolling
	// inside this panel.
	useEffect(() => {
		const el = panelRef.current;
		if (!el) return;
		const stop = (e: WheelEvent) => {
			e.stopPropagation();
		};
		el.addEventListener("wheel", stop, { passive: false });
		return () => el.removeEventListener("wheel", stop);
	});
	const {
		currentStrokeColor,
		currentBackgroundColor,
		currentStrokeWidth,
		currentStrokeStyle,
		currentOpacity,
		setStrokeColor,
		setBackgroundColor,
		setStrokeWidth,
		setStrokeStyle,
		setOpacity,
		activeTool,
		currentBrushType,
		setBrushType,
		currentRoughEnabled,
		currentSloppiness,
		setRoughEnabled,
		setSloppiness,
		isReadOnly,
		currentFillStyle,
		setFillStyle,
		batchUpdateElements,
		canvasBackgroundColor,
		activeGridMode,
		setCanvasBackgroundColor,
		setGridMode,
	} = useCanvasStore();

	// Detect if any selected element is a freedraw so brush controls stay
	// visible even when the active tool has switched to "selection".
	const selectedElements = useSelectedElements();
	const hasSelectedFreedraw = selectedElements.some(
		(el) => el.type === "freedraw" || (el.type as string) === "freehand",
	);
	const showBrushControls = activeTool === "freedraw" || hasSelectedFreedraw;

	// Detect selected text elements for text formatting controls
	const selectedTextElements = selectedElements.filter(
		(el): el is TextElement => el.type === "text",
	);
	const hasSelectedText = selectedTextElements.length > 0;

	// Derive current text style from first selected text element
	const firstText = selectedTextElements[0] as TextElement | undefined;
	const currentFontFamily = firstText?.runs?.[0]?.fontFamily ?? "Arial";
	const currentFontSize =
		firstText?.runs?.[0]?.fontSize ?? firstText?.fontSize ?? 20;
	const currentBold = firstText?.runs?.[0]?.bold ?? false;
	const currentItalic = firstText?.runs?.[0]?.italic ?? false;
	const currentUnderline = firstText?.runs?.[0]?.underline ?? false;

	const allLocked =
		selectedElements.length > 0 && selectedElements.every((el) => el.locked);

	// ── Text formatting handlers ──────────────────────────────────
	const updateTextElements = useCallback(
		(stylePatch: Partial<Omit<TextRun, "text">>) => {
			if (selectedTextElements.length === 0) return;
			const updates = selectedTextElements.map((el) => {
				const textEl = el as TextElement;
				// Update all runs with the new style
				const existingRuns: TextRun[] =
					textEl.runs && textEl.runs.length > 0
						? textEl.runs
						: [
								{
									text: textEl.text,
									fontFamily: "Arial",
									fontSize: textEl.fontSize ?? 20,
								},
							];
				const newRuns = mergeAdjacentRuns(
					existingRuns.map((r) => ({ ...r, ...stylePatch })),
				);
				const layout = layoutRuns(newRuns);
				const partial: Record<string, unknown> = {
					runs: newRuns,
					width: layout.width,
					height: layout.height,
				};
				// Keep element-level fontSize in sync when changed
				if (stylePatch.fontSize !== undefined) {
					partial.fontSize = stylePatch.fontSize;
				}
				return { id: el.id, updates: partial };
			});
			batchUpdateElements(updates);
		},
		[selectedTextElements, batchUpdateElements],
	);

	const handleFontFamilyChange = useCallback(
		(font: string) => {
			updateTextElements({ fontFamily: font });
			setIsFontFamilyOpen(false);
		},
		[updateTextElements],
	);

	const handleFontSizeChange = useCallback(
		(size: number) => {
			updateTextElements({ fontSize: size });
			setIsFontSizeOpen(false);
		},
		[updateTextElements],
	);

	const handleFontSizeInputCommit = useCallback(() => {
		const input = fontSizeInputRef.current;
		if (!input) return;
		const val = Number.parseInt(input.value, 10);
		if (val >= 1 && val <= 200) {
			updateTextElements({ fontSize: val });
		} else {
			input.value = String(currentFontSize);
		}
	}, [updateTextElements, currentFontSize]);

	const toggleTextBold = useCallback(() => {
		updateTextElements({ bold: !currentBold || undefined });
	}, [updateTextElements, currentBold]);

	const toggleTextItalic = useCallback(() => {
		updateTextElements({ italic: !currentItalic || undefined });
	}, [updateTextElements, currentItalic]);

	const toggleTextUnderline = useCallback(() => {
		updateTextElements({ underline: !currentUnderline || undefined });
	}, [updateTextElements, currentUnderline]);

	const handleToggleLock = () => {
		const newLockedState = !allLocked;
		batchUpdateElements(
			selectedElements.map((el) => ({
				id: el.id,
				updates: { locked: newLockedState },
			})),
		);
	};

	// Close dropdowns on outside click
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (
				brushDropdownRef.current &&
				!brushDropdownRef.current.contains(e.target as Node)
			) {
				setIsBrushDropdownOpen(false);
			}
			if (
				fontFamilyDropdownRef.current &&
				!fontFamilyDropdownRef.current.contains(e.target as Node)
			) {
				setIsFontFamilyOpen(false);
			}
			if (
				fontSizeDropdownRef.current &&
				!fontSizeDropdownRef.current.contains(e.target as Node)
			) {
				setIsFontSizeOpen(false);
			}
		}
		if (isBrushDropdownOpen || isFontFamilyOpen || isFontSizeOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isBrushDropdownOpen, isFontFamilyOpen, isFontSizeOpen]);

	// In read-only mode, show a locked badge instead of the panel
	if (isReadOnly) {
		return (
			<div className="absolute top-[136px] sm:top-20 right-2 sm:right-4 z-50">
				<div className="glass-card-elevated rounded-2xl px-4 py-3 flex items-center gap-2.5 opacity-60 cursor-not-allowed">
					<Lock size={16} className="text-red-400" />
					<span className="text-[13px] font-semibold text-gray-400">
						Locked
					</span>
				</div>
			</div>
		);
	}

	if (isCollapsed) {
		return (
			<div className="absolute top-[136px] sm:top-20 right-2 sm:right-4 z-50">
				<button
					type="button"
					onClick={() => setIsCollapsed(false)}
					title="Style Panel"
					className="glass-card-elevated rounded-2xl px-4 py-3 cursor-pointer flex items-center gap-2.5 transition-all duration-200 hover:bg-gray-50 hover:border-violet-300 hover:-translate-x-0.5 border-none"
				>
					<Palette size={18} className="text-violet-500" />
					<span className="text-[13px] font-semibold text-gray-600">Style</span>
					<ChevronRight size={14} className="text-gray-400" />
				</button>
			</div>
		);
	}

	return (
		<div
			className="absolute top-[136px] sm:top-20 right-2 sm:right-4 z-50"
			data-ui-panel
		>
			<div
				ref={panelRef}
				className="glass-card-elevated rounded-2xl w-[200px] sm:w-[232px] p-3 sm:p-4 animate-scale-in max-h-[calc(100vh-160px)] overflow-y-auto"
			>
				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
							<Palette size={16} className="text-violet-500" />
						</div>
						<span className="text-sm font-bold text-gray-800">Style</span>
					</div>
					<div className="flex items-center gap-1">
						{selectedElements.length > 0 && (
							<button
								type="button"
								onClick={handleToggleLock}
								title={allLocked ? "Unlock Elements" : "Lock Elements"}
								className={`p-1.5 rounded-lg border-none cursor-pointer transition-colors flex items-center justify-center ${
									allLocked
										? "bg-red-50 text-red-500 hover:bg-red-100"
										: "bg-transparent text-gray-400 hover:bg-gray-100"
								}`}
							>
								{allLocked ? <Lock size={16} /> : <Unlock size={16} />}
							</button>
						)}
						<button
							type="button"
							onClick={() => setIsCollapsed(true)}
							className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-center"
						>
							<X size={16} className="text-gray-400" />
						</button>
					</div>
				</div>

				{/* Stroke Color */}
				<SectionLabel>Stroke</SectionLabel>
				<div className="grid grid-cols-4 gap-2 mb-4">
					{STROKE_COLORS.map(({ color, name }) => (
						<button
							type="button"
							key={color}
							onClick={() => setStrokeColor(color)}
							title={name}
							className={`w-full aspect-square rounded-lg cursor-pointer transition-all border-none ${
								currentStrokeColor === color
									? "ring-2 ring-violet-500 ring-offset-2 scale-95"
									: "ring-1 ring-gray-200 hover:ring-gray-300 hover:scale-95"
							}`}
							style={{ backgroundColor: color }}
						/>
					))}
				</div>

				{/* Background Color */}
				<SectionLabel>Fill</SectionLabel>
				<div className="grid grid-cols-4 gap-2 mb-4">
					{BACKGROUND_COLORS.map(({ color, name }) => (
						<button
							type="button"
							key={color}
							onClick={() => setBackgroundColor(color)}
							title={name}
							className={`w-full aspect-square rounded-lg cursor-pointer transition-all border-none ${
								currentBackgroundColor === color
									? "ring-2 ring-violet-500 ring-offset-2 scale-95"
									: "ring-1 ring-gray-200 hover:ring-gray-300 hover:scale-95"
							}`}
							style={{
								backgroundColor: color === "transparent" ? "white" : color,
								backgroundImage:
									color === "transparent"
										? "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)"
										: "none",
								backgroundSize: color === "transparent" ? "8px 8px" : "auto",
								backgroundPosition:
									color === "transparent"
										? "0 0, 0 4px, 4px -4px, -4px 0px"
										: "0 0",
							}}
						/>
					))}
				</div>

				{/* Fill Style (solid / hachure / cross-hatch / none) */}
				{currentRoughEnabled && (
					<>
						<SectionLabel>Fill Style</SectionLabel>
						<div className="flex gap-2 mb-4">
							{(["solid", "hachure", "cross-hatch", "none"] as FillStyle[]).map(
								(style) => (
									<button
										type="button"
										key={style}
										onClick={() => setFillStyle(style)}
										title={style.charAt(0).toUpperCase() + style.slice(1)}
										className={`flex-1 h-9 rounded-lg cursor-pointer flex items-center justify-center text-xs font-medium transition-all border-none ${
											currentFillStyle === style
												? "bg-violet-50 ring-2 ring-violet-500 text-violet-700"
												: "bg-white ring-1 ring-gray-200 hover:ring-gray-300 text-gray-600"
										}`}
									>
										{style === "cross-hatch"
											? "X-Hatch"
											: style.charAt(0).toUpperCase() + style.slice(1)}
									</button>
								),
							)}
						</div>
					</>
				)}

				{/* Stroke Width */}
				<SectionLabel>Stroke Width</SectionLabel>
				<div className="flex gap-2 mb-4">
					{STROKE_WIDTHS.map((width) => (
						<button
							type="button"
							key={width}
							onClick={() => setStrokeWidth(width)}
							title={`${width}px`}
							className={`flex-1 h-9 rounded-lg cursor-pointer flex items-center justify-center transition-all border-none ${
								currentStrokeWidth === width
									? "bg-violet-50 ring-2 ring-violet-500"
									: "bg-white ring-1 ring-gray-200 hover:ring-gray-300"
							}`}
						>
							<div
								className="rounded-full"
								style={{
									width: Math.max(4, width * 2),
									height: Math.max(4, width * 2),
									backgroundColor:
										currentStrokeWidth === width ? "#8b5cf6" : "#94a3b8",
								}}
							/>
						</button>
					))}
				</div>

				{/* Stroke Style */}
				<SectionLabel>Line Style</SectionLabel>
				<div className="flex gap-2 mb-4">
					{(["solid", "dashed", "dotted"] as StrokeStyle[]).map((style) => (
						<button
							type="button"
							key={style}
							onClick={() => setStrokeStyle(style)}
							title={style.charAt(0).toUpperCase() + style.slice(1)}
							className={`flex-1 h-9 rounded-lg cursor-pointer flex items-center justify-center transition-all border-none ${
								currentStrokeStyle === style
									? "bg-violet-50 ring-2 ring-violet-500"
									: "bg-white ring-1 ring-gray-200 hover:ring-gray-300"
							}`}
						>
							<svg width="28" height="3" viewBox="0 0 28 3" role="img">
								<title>{style} line</title>
								<line
									x1="0"
									y1="1.5"
									x2="28"
									y2="1.5"
									stroke={currentStrokeStyle === style ? "#8b5cf6" : "#94a3b8"}
									strokeWidth="2"
									strokeDasharray={
										style === "dashed"
											? "6 4"
											: style === "dotted"
												? "2 3"
												: "none"
									}
								/>
							</svg>
						</button>
					))}
				</div>

				{/* Opacity */}
				<div className="flex items-center justify-between mb-2">
					<SectionLabel className="mb-0">Opacity</SectionLabel>
					<span className="text-xs font-bold text-violet-500 tabular-nums">
						{currentOpacity}%
					</span>
				</div>
				<input
					type="range"
					min="10"
					max="100"
					value={currentOpacity}
					onChange={(e) => setOpacity(Number(e.target.value))}
					className="w-full cursor-pointer"
				/>

				{/* ── Text Formatting (text elements only) ──────────── */}
				{hasSelectedText && (
					<>
						<div className="h-px bg-gray-100 my-4" />

						{/* Font Family */}
						<SectionLabel>Font Family</SectionLabel>
						<div className="relative mb-4" ref={fontFamilyDropdownRef}>
							<button
								type="button"
								onClick={() => {
									setIsFontFamilyOpen((v) => !v);
									setIsFontSizeOpen(false);
								}}
								className="w-full h-9 rounded-lg cursor-pointer flex items-center gap-2 px-3 transition-all border-none bg-white ring-1 ring-gray-200 hover:ring-violet-300"
							>
								<span
									className="text-[13px] font-medium text-gray-700 flex-1 text-left truncate"
									style={{ fontFamily: currentFontFamily }}
								>
									{currentFontFamily}
								</span>
								<ChevronDown
									size={14}
									className={`text-gray-400 transition-transform duration-150 flex-shrink-0 ${
										isFontFamilyOpen ? "rotate-180" : ""
									}`}
								/>
							</button>

							{isFontFamilyOpen && (
								<div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[60] rounded-xl bg-white shadow-lg ring-1 ring-gray-200 py-1 max-h-48 overflow-y-auto animate-scale-in">
									{TEXT_FONT_FAMILIES.map((font) => (
										<button
											type="button"
											key={font}
											onClick={() => handleFontFamilyChange(font)}
											className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer transition-colors border-none ${
												currentFontFamily === font
													? "bg-violet-50 text-violet-600 font-medium"
													: "bg-transparent text-gray-700 hover:bg-gray-50"
											}`}
											style={{ fontFamily: font }}
										>
											{font}
										</button>
									))}
								</div>
							)}
						</div>

						{/* Font Size */}
						<SectionLabel>Font Size</SectionLabel>
						<div className="flex gap-2 mb-4" ref={fontSizeDropdownRef}>
							<div className="relative flex-1">
								<div className="flex items-center">
									<input
										ref={fontSizeInputRef}
										type="text"
										inputMode="numeric"
										defaultValue={currentFontSize}
										key={currentFontSize}
										className="w-full h-9 text-center text-sm rounded-lg border border-gray-200
                      text-gray-700 focus:outline-none focus:border-violet-400"
										title="Font size"
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												handleFontSizeInputCommit();
												(e.target as HTMLInputElement).blur();
											}
										}}
										onBlur={handleFontSizeInputCommit}
									/>
								</div>
							</div>
							<div className="relative">
								<button
									type="button"
									onClick={() => {
										setIsFontSizeOpen((v) => !v);
										setIsFontFamilyOpen(false);
									}}
									className="h-9 px-2 rounded-lg cursor-pointer flex items-center justify-center transition-all border-none bg-white ring-1 ring-gray-200 hover:ring-violet-300"
									title="Font size presets"
								>
									<ChevronDown
										size={14}
										className={`text-gray-400 transition-transform duration-150 ${
											isFontSizeOpen ? "rotate-180" : ""
										}`}
									/>
								</button>

								{isFontSizeOpen && (
									<div className="absolute right-0 top-[calc(100%+4px)] z-[60] w-20 rounded-xl bg-white shadow-lg ring-1 ring-gray-200 py-1 max-h-48 overflow-y-auto animate-scale-in">
										{TEXT_FONT_SIZES.map((size) => (
											<button
												type="button"
												key={size}
												onClick={() => handleFontSizeChange(size)}
												className={`w-full text-center px-2 py-1 text-sm cursor-pointer transition-colors border-none ${
													currentFontSize === size
														? "bg-violet-50 text-violet-600 font-medium"
														: "bg-transparent text-gray-700 hover:bg-gray-50"
												}`}
											>
												{size}
											</button>
										))}
									</div>
								)}
							</div>
						</div>

						{/* Bold / Italic / Underline */}
						<SectionLabel>Text Style</SectionLabel>
						<div className="flex gap-2 mb-4">
							<button
								type="button"
								onClick={toggleTextBold}
								title="Bold"
								className={`flex-1 h-9 rounded-lg cursor-pointer flex items-center justify-center transition-all border-none ${
									currentBold
										? "bg-violet-50 ring-2 ring-violet-500 text-violet-700"
										: "bg-white ring-1 ring-gray-200 hover:ring-gray-300 text-gray-600"
								}`}
							>
								<Bold size={16} />
							</button>
							<button
								type="button"
								onClick={toggleTextItalic}
								title="Italic"
								className={`flex-1 h-9 rounded-lg cursor-pointer flex items-center justify-center transition-all border-none ${
									currentItalic
										? "bg-violet-50 ring-2 ring-violet-500 text-violet-700"
										: "bg-white ring-1 ring-gray-200 hover:ring-gray-300 text-gray-600"
								}`}
							>
								<Italic size={16} />
							</button>
							<button
								type="button"
								onClick={toggleTextUnderline}
								title="Underline"
								className={`flex-1 h-9 rounded-lg cursor-pointer flex items-center justify-center transition-all border-none ${
									currentUnderline
										? "bg-violet-50 ring-2 ring-violet-500 text-violet-700"
										: "bg-white ring-1 ring-gray-200 hover:ring-gray-300 text-gray-600"
								}`}
							>
								<Underline size={16} />
							</button>
						</div>
					</>
				)}

				{/* ── Brush Tools (freedraw only) ─────────────────── */}
				{showBrushControls && (
					<>
						{/* Brush Style Dropdown */}
						<SectionLabel>Brush</SectionLabel>
						<div className="relative mb-4" ref={brushDropdownRef}>
							{/* Trigger */}
							<button
								type="button"
								onClick={() => setIsBrushDropdownOpen(!isBrushDropdownOpen)}
								className="w-full h-10 rounded-lg cursor-pointer flex items-center gap-2 px-3 transition-all border-none bg-white ring-1 ring-gray-200 hover:ring-violet-300"
							>
								<span className="text-base leading-none">
									{BRUSH_OPTIONS.find((b) => b.type === currentBrushType)?.icon}
								</span>
								<span className="text-[13px] font-semibold text-gray-700 flex-1 text-left">
									{
										BRUSH_OPTIONS.find((b) => b.type === currentBrushType)
											?.label
									}
								</span>
								<ChevronDown
									size={14}
									className={`text-gray-400 transition-transform duration-150 ${
										isBrushDropdownOpen ? "rotate-180" : ""
									}`}
								/>
							</button>

							{/* Dropdown menu */}
							{isBrushDropdownOpen && (
								<div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[60] rounded-xl bg-white shadow-lg ring-1 ring-gray-200 py-1 animate-scale-in">
									{BRUSH_OPTIONS.map(({ type, label, icon, desc }) => (
										<button
											type="button"
											key={type}
											onClick={() => {
												setBrushType(type);
												setIsBrushDropdownOpen(false);
											}}
											className={`w-full flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors border-none text-left ${
												currentBrushType === type
													? "bg-violet-50 text-violet-700"
													: "bg-transparent text-gray-700 hover:bg-gray-50"
											}`}
										>
											<span className="text-base leading-none w-5 text-center">
												{icon}
											</span>
											<div className="flex-1 min-w-0">
												<span className="text-[13px] font-semibold block">
													{label}
												</span>
												<span className="text-[11px] text-gray-400 block">
													{desc}
												</span>
											</div>
											{currentBrushType === type && (
												<span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
											)}
										</button>
									))}
								</div>
							)}
						</div>

						{/* Brush Size slider */}
						<div className="flex items-center justify-between mb-2">
							<SectionLabel className="mb-0">Size</SectionLabel>
							<span className="text-xs font-bold text-violet-500 tabular-nums">
								{currentStrokeWidth}px
							</span>
						</div>
						<input
							type="range"
							min="1"
							max="40"
							value={currentStrokeWidth}
							onChange={(e) => setStrokeWidth(Number(e.target.value))}
							className="w-full cursor-pointer mb-4"
						/>

						{/* Brush Opacity slider */}
						<div className="flex items-center justify-between mb-2">
							<SectionLabel className="mb-0">Opacity</SectionLabel>
							<span className="text-xs font-bold text-violet-500 tabular-nums">
								{currentOpacity}%
							</span>
						</div>
						<input
							type="range"
							min="10"
							max="100"
							value={currentOpacity}
							onChange={(e) => setOpacity(Number(e.target.value))}
							className="w-full cursor-pointer mb-2"
						/>
					</>
				)}

				{/* Sketch Style — visible for shape tools (not freedraw/text/select) */}
				{(activeTool === "rectangle" ||
					activeTool === "ellipse" ||
					activeTool === "diamond" ||
					activeTool === "line" ||
					activeTool === "arrow") && (
					<>
						<SectionLabel>Sketch Style</SectionLabel>
						<div className="mb-3">
							<button
								type="button"
								onClick={() => setRoughEnabled(!currentRoughEnabled)}
								className={`w-full h-9 rounded-lg cursor-pointer flex items-center justify-center gap-2 transition-all border-none text-[12px] font-medium ${
									currentRoughEnabled
										? "bg-violet-50 ring-2 ring-violet-500 text-violet-700"
										: "bg-white ring-1 ring-gray-200 hover:ring-gray-300 text-gray-600"
								}`}
							>
								<span>{currentRoughEnabled ? "✏️" : "📐"}</span>
								<span>{currentRoughEnabled ? "Hand-drawn" : "Clean"}</span>
							</button>
						</div>
						{currentRoughEnabled && (
							<>
								<div className="flex items-center justify-between mb-2">
									<SectionLabel className="mb-0">Sloppiness</SectionLabel>
									<span className="text-xs font-bold text-violet-500 tabular-nums">
										{currentSloppiness.toFixed(1)}
									</span>
								</div>
								<input
									type="range"
									min="0"
									max="3"
									step="0.1"
									value={currentSloppiness}
									onChange={(e) => setSloppiness(Number(e.target.value))}
									className="w-full cursor-pointer mb-2"
								/>
							</>
						)}
					</>
				)}

				<div className="h-px bg-gray-100 my-4" />

				{/* ── Canvas Settings (Story 1.3.4) ────────────────── */}
				<SectionLabel>Canvas Background</SectionLabel>
				<div className="grid grid-cols-4 gap-2 mb-4">
					{[
						{ color: "#ffffff", name: "Light" },
						{ color: "#f8f9fa", name: "Soft" },
						{ color: "#252525", name: "Dark" },
						{ color: "#121212", name: "Black" },
					].map(({ color, name }) => (
						<button
							type="button"
							key={color}
							onClick={() => {
								setCanvasBackgroundColor(color);
								onUpdateSettings?.({ backgroundColor: color });
							}}
							title={name}
							className={`w-full aspect-square rounded-lg cursor-pointer transition-all border-none ${
								canvasBackgroundColor === color
									? "ring-2 ring-violet-500 ring-offset-2 scale-95"
									: "ring-1 ring-gray-200 hover:ring-gray-300 hover:scale-95"
							}`}
							style={{ backgroundColor: color }}
						/>
					))}
					{/* Custom Color Button */}
					<button
						type="button"
						onClick={() => customColorInputRef.current?.click()}
						title="Custom Color"
						className={`w-full aspect-square rounded-lg cursor-pointer transition-all border-none flex items-center justify-center relative ${
							!["#ffffff", "#f8f9fa", "#252525", "#121212"].includes(
								canvasBackgroundColor,
							)
								? "ring-2 ring-violet-500 ring-offset-2 scale-95"
								: "ring-1 ring-gray-200 hover:ring-gray-300 hover:scale-95"
						}`}
						style={{
							backgroundColor: ![
								"#ffffff",
								"#f8f9fa",
								"#252525",
								"#121212",
							].includes(canvasBackgroundColor)
								? canvasBackgroundColor
								: "#ffffff",
						}}
					>
						<Plus
							size={16}
							className={
								!["#ffffff", "#f8f9fa", "#252525", "#121212"].includes(
									canvasBackgroundColor,
								)
									? "text-white mix-blend-difference"
									: "text-gray-400"
							}
						/>
						<input
							ref={customColorInputRef}
							type="color"
							className="sr-only"
							value={canvasBackgroundColor}
							onChange={(e) => {
								setCanvasBackgroundColor(e.target.value);
								onUpdateSettings?.({ backgroundColor: e.target.value });
							}}
						/>
					</button>
				</div>

				<div className="flex items-center gap-2 mb-4">
					<span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded uppercase flex-1 text-center border border-gray-100">
						{canvasBackgroundColor}
					</span>
				</div>

				<SectionLabel>Grid Mode</SectionLabel>
				<div className="flex gap-2 mb-2">
					{[
						{ mode: "none", label: "None" },
						{ mode: "dots", label: "Dots" },
						{ mode: "grid", label: "Grid" },
					].map(({ mode, label }) => (
						<button
							type="button"
							key={mode}
							onClick={() => {
								setGridMode(mode as typeof activeGridMode);
								onUpdateSettings?.({ gridMode: mode });
							}}
							className={`flex-1 h-9 rounded-lg cursor-pointer flex items-center justify-center text-[11px] font-bold transition-all border-none ${
								activeGridMode === mode
									? "bg-violet-50 ring-2 ring-violet-500 text-violet-700"
									: "bg-white ring-1 ring-gray-200 hover:ring-gray-300 text-gray-500"
							}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

function SectionLabel({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5 ${className}`}
		>
			{children}
		</div>
	);
}
