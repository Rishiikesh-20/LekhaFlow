/**
 * ============================================================================
 * LEKHAFLOW - PROPERTIES PANEL
 * ============================================================================
 *
 * Right sidebar for element styling properties.
 */

"use client";

import { ChevronDown, ChevronRight, Lock, Palette, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCanvasStore, useSelectedElements } from "../../store/canvas-store";

type StrokeStyle = "solid" | "dashed" | "dotted";

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
		type: "crayon" as const,
		label: "Crayon",
		icon: "🖍",
		desc: "Rough texture",
	},
	{ type: "marker" as const, label: "Marker", icon: "◆", desc: "Chisel tip" },
	{
		type: "watercolour" as const,
		label: "Watercolour",
		icon: "💧",
		desc: "Soft & blended",
	},
];

export function PropertiesPanel() {
	const [isCollapsed, setIsCollapsed] = useState(true);
	const [isBrushDropdownOpen, setIsBrushDropdownOpen] = useState(false);
	const brushDropdownRef = useRef<HTMLDivElement>(null);
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
	} = useCanvasStore();

	// Detect if any selected element is a freedraw so brush controls stay
	// visible even when the active tool has switched to "selection".
	const selectedElements = useSelectedElements();
	const hasSelectedFreedraw = selectedElements.some(
		(el) => el.type === "freedraw" || (el.type as string) === "freehand",
	);
	const showBrushControls = activeTool === "freedraw" || hasSelectedFreedraw;

	// Close brush dropdown on outside click
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (
				brushDropdownRef.current &&
				!brushDropdownRef.current.contains(e.target as Node)
			) {
				setIsBrushDropdownOpen(false);
			}
		}
		if (isBrushDropdownOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isBrushDropdownOpen]);

	// In read-only mode, show a locked badge instead of the panel
	if (isReadOnly) {
		return (
			<div className="absolute top-[136px] sm:top-20 right-4 z-50">
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
			<div className="absolute top-[136px] sm:top-20 right-4 z-50">
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
		<div className="absolute top-[136px] sm:top-20 right-4 z-50">
			<div className="glass-card-elevated rounded-2xl w-[232px] p-4 animate-scale-in max-h-[calc(100vh-160px)] overflow-y-auto">
				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
							<Palette size={16} className="text-violet-500" />
						</div>
						<span className="text-sm font-bold text-gray-800">Style</span>
					</div>
					<button
						type="button"
						onClick={() => setIsCollapsed(true)}
						className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-center"
					>
						<X size={16} className="text-gray-400" />
					</button>
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
