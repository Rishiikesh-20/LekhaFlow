/**
 * ============================================================================
 * LEKHAFLOW - TOOLBAR COMPONENT
 * ============================================================================
 *
 * Floating pill-shaped toolbar for tool selection - horizontal at top center.
 */

"use client";

import type { Tool } from "@repo/common";
import {
	ArrowUpRight,
	Circle,
	Diamond,
	Eraser,
	Hand,
	Lock,
	Minus,
	MousePointer2,
	Pencil,
	Presentation,
	Square,
	Type,
	Unlock,
} from "lucide-react";
import React from "react";
import { useCanvasStore } from "../../store/canvas-store";

interface ToolDefinition {
	id: Tool;
	icon: React.ReactNode;
	label: string;
	shortcut: string;
}

const TOOLS: ToolDefinition[] = [
	{ id: "hand", icon: <Hand size={18} />, label: "Hand", shortcut: "H" },
	{
		id: "selection",
		icon: <MousePointer2 size={18} />,
		label: "Select",
		shortcut: "V",
	},
	{
		id: "rectangle",
		icon: <Square size={18} />,
		label: "Rectangle",
		shortcut: "R",
	},
	{
		id: "diamond",
		icon: <Diamond size={18} />,
		label: "Diamond",
		shortcut: "D",
	},
	{
		id: "ellipse",
		icon: <Circle size={18} />,
		label: "Circle",
		shortcut: "O",
	},
	{
		id: "arrow",
		icon: <ArrowUpRight size={18} />,
		label: "Arrow",
		shortcut: "A",
	},
	{ id: "line", icon: <Minus size={18} />, label: "Line", shortcut: "-" },
	{
		id: "freedraw",
		icon: <Pencil size={18} />,
		label: "Pencil",
		shortcut: "P",
	},
	{
		id: "laser",
		icon: <Presentation size={18} />,
		label: "Laser",
		shortcut: "K",
	},
	{ id: "text", icon: <Type size={18} />, label: "Text", shortcut: "T" },
	{ id: "eraser", icon: <Eraser size={18} />, label: "Eraser", shortcut: "E" },
];

export function Toolbar() {
	const activeTool = useCanvasStore((state) => state.activeTool);
	const setActiveTool = useCanvasStore((state) => state.setActiveTool);
	const isReadOnly = useCanvasStore((state) => state.isReadOnly);
	const setReadOnly = useCanvasStore((state) => state.setReadOnly);
	const isArchived = useCanvasStore((state) => state.isArchived);

	return (
		<div className="absolute left-1/2 top-[72px] sm:top-4 -translate-x-1/2 z-[var(--z-toolbar)] max-w-[calc(100vw-16px)] sm:max-w-[calc(100vw-32px)]">
			<div
				className="glass-card-elevated flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1.5 sm:py-2 overflow-x-auto scrollbar-hide"
				style={{
					borderRadius: "28px",
					boxShadow: "var(--shadow-lg)",
					animation: "fade-in 0.3s ease-out, slide-in-top 0.3s ease-out",
				}}
			>
				{/* Lock/Unlock Button - Toggle Read-Only Mode */}
				<button
					type="button"
					onClick={() => {
						if (!isArchived) setReadOnly(!isReadOnly);
					}}
					disabled={isArchived}
					title={
						isArchived
							? "Canvas is archived (locked)"
							: isReadOnly
								? "Unlock Canvas (L)"
								: "Lock Canvas (L)"
					}
					className={`
						relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0
						transition-all duration-150 border-none group
						${
							isArchived
								? "bg-gray-200 text-gray-400 cursor-not-allowed"
								: isReadOnly
									? "bg-red-100 text-red-600 cursor-pointer"
									: "text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
						}
					`}
					style={{ borderRadius: "8px" }}
				>
					{isReadOnly ? <Lock size={18} /> : <Unlock size={18} />}
					<div
						className={`
							tool-shortcut-badge
							absolute -bottom-1 -right-1
							w-4 h-4 rounded flex items-center justify-center
							text-[10px] font-mono font-medium
							transition-all duration-150
							${
								isReadOnly
									? "bg-red-600 text-white"
									: "bg-gray-300 text-gray-600 group-hover:bg-gray-400"
							}
						`}
						style={{ fontSize: "10px", lineHeight: "1" }}
					>
						L
					</div>
				</button>

				{/* Separator after lock */}
				<div className="h-6 w-px bg-gray-200 mx-0.5 sm:mx-1 flex-shrink-0" />

				{TOOLS.map((tool, index) => {
					const isActive = activeTool === tool.id && !isReadOnly;
					const isDisabled = isReadOnly && tool.id !== "hand";
					return (
						<React.Fragment key={`${tool.id}-${index}`}>
							{/* Separator after hand+selection tools (after index 1) */}
							{index === 2 && (
								<div className="h-6 w-px bg-gray-200 mx-0.5 sm:mx-1 flex-shrink-0" />
							)}
							{/* Separator before eraser (before last tool) */}
							{index === TOOLS.length - 1 && (
								<div className="h-6 w-px bg-gray-200 mx-0.5 sm:mx-1 flex-shrink-0" />
							)}

							<button
								type="button"
								onClick={() => {
									if (!isDisabled) {
										setActiveTool(tool.id);
									}
								}}
								disabled={isDisabled}
								title={`${tool.label} (${tool.shortcut})${isDisabled ? " — Canvas is locked" : ""}`}
								className={`
									relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0
									transition-all duration-150 border-none group
									${
										isDisabled
											? "text-gray-300 cursor-not-allowed opacity-50"
											: isActive
												? "bg-violet-100 text-violet-600 cursor-pointer"
												: "text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
									}
								`}
								style={{
									borderRadius: "8px",
								}}
							>
								{tool.icon}

								{/* Keyboard shortcut badge — hidden on mobile via CSS */}
								<div
									className={`
										tool-shortcut-badge
										absolute -bottom-1 -right-1 
										w-4 h-4 rounded flex items-center justify-center
										text-[10px] font-mono font-medium
										transition-all duration-150
										${
											isActive
												? "bg-violet-600 text-white"
												: "bg-gray-300 text-gray-600 group-hover:bg-gray-400"
										}
									`}
									style={{
										fontSize: "10px",
										lineHeight: "1",
									}}
								>
									{tool.shortcut}
								</div>
							</button>
						</React.Fragment>
					);
				})}
			</div>
		</div>
	);
}
