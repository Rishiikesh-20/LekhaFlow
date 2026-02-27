/**
 * ============================================================================
 * LEKHAFLOW - CONTEXT MENU
 * ============================================================================
 *
 * Right-click context menu for quick actions on canvas/elements.
 */

"use client";

import {
	ArrowDown,
	ArrowUp,
	ChevronsDown,
	ChevronsUp,
	ClipboardPaste,
	Copy,
	Layers,
	Trash2,
} from "lucide-react";
import type React from "react";

interface ContextMenuProps {
	x: number;
	y: number;
	isVisible: boolean;
	metadata?: { createdBy?: string; lastModifiedBy?: string };
	hasSelection: boolean;
	onClose: () => void;
	onCopy: () => void;
	onPaste: () => void;
	onDelete: () => void;
	onBringForward: () => void;
	onSendBackward: () => void;
	onBringToFront: () => void;
	onSendToBack: () => void;
}

interface MenuItemProps {
	icon: React.ReactNode;
	label: string;
	shortcut?: string;
	onClick: () => void;
	disabled?: boolean;
	danger?: boolean;
}

function MenuItem({
	icon,
	label,
	shortcut,
	onClick,
	disabled,
	danger,
}: MenuItemProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`w-full flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent rounded-lg transition-colors ${
				disabled
					? "cursor-not-allowed opacity-40"
					: `cursor-pointer ${danger ? "hover:bg-red-50" : "hover:bg-gray-50"}`
			}`}
		>
			<span className={danger ? "text-red-500" : "text-gray-500"}>{icon}</span>
			<span
				className={`flex-1 text-left text-[13px] font-medium ${
					danger ? "text-red-500" : "text-gray-700"
				}`}
			>
				{label}
			</span>
			{shortcut && (
				<kbd className="px-1.5 py-0.5 text-[11px] font-mono text-gray-400 bg-gray-100 rounded">
					{shortcut}
				</kbd>
			)}
		</button>
	);
}

export function ContextMenu({
	x,
	y,
	isVisible,
	metadata,
	hasSelection,
	onClose,
	onCopy,
	onPaste,
	onDelete,
	onBringForward,
	onSendBackward,
	onBringToFront,
	onSendToBack,
}: ContextMenuProps) {
	if (!isVisible) return null;

	return (
		<>
			{/* Backdrop */}
			<button
				type="button"
				className="fixed inset-0 z-[998] bg-transparent border-none cursor-default"
				onClick={onClose}
				onContextMenu={(e) => {
					e.preventDefault();
					onClose();
				}}
				aria-label="Close menu"
			/>

			{/* Menu */}
			<div
				className="fixed z-[999] glass-card-elevated rounded-xl p-1.5 min-w-[200px] animate-scale-in"
				style={{ left: x, top: y }}
			>
				{/* Clipboard Actions */}
				<MenuItem
					icon={<Copy size={16} />}
					label="Copy"
					shortcut="Ctrl+C"
					onClick={() => {
						onCopy();
						onClose();
					}}
					disabled={!hasSelection}
				/>
				<MenuItem
					icon={<ClipboardPaste size={16} />}
					label="Paste"
					shortcut="Ctrl+V"
					onClick={() => {
						onPaste();
						onClose();
					}}
				/>

				{/* Separator */}
				<div className="h-px bg-gray-200 my-1.5" />

				{/* Layer Actions */}
				<div className="px-3.5 pt-1.5 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
					<Layers size={12} />
					Layers
				</div>
				<MenuItem
					icon={<ChevronsUp size={16} />}
					label="Bring to Front"
					shortcut="Ctrl+]"
					onClick={() => {
						onBringToFront();
						onClose();
					}}
					disabled={!hasSelection}
				/>
				<MenuItem
					icon={<ArrowUp size={16} />}
					label="Bring Forward"
					onClick={() => {
						onBringForward();
						onClose();
					}}
					disabled={!hasSelection}
				/>
				<MenuItem
					icon={<ArrowDown size={16} />}
					label="Send Backward"
					onClick={() => {
						onSendBackward();
						onClose();
					}}
					disabled={!hasSelection}
				/>
				<MenuItem
					icon={<ChevronsDown size={16} />}
					label="Send to Back"
					shortcut="Ctrl+["
					onClick={() => {
						onSendToBack();
						onClose();
					}}
					disabled={!hasSelection}
				/>

				{/* Separator */}
				<div className="h-px bg-gray-200 my-1.5" />

				{/* Delete */}
				<MenuItem
					icon={<Trash2 size={16} />}
					label="Delete"
					shortcut="Del"
					onClick={() => {
						onDelete();
						onClose();
					}}
					disabled={!hasSelection}
					danger
				/>

				{/* Metadata Section */}
				{metadata && (metadata.createdBy || metadata.lastModifiedBy) && (
					<>
						<div className="h-px bg-gray-200 my-1.5" />
						<div className="px-3 pb-1 pt-1.5">
							<div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
								Element Info
							</div>
							{metadata.createdBy && (
								<div className="text-[11px] text-gray-600 flex justify-between">
									<span className="text-gray-400">Created by:</span>
									<span
										className="font-medium truncate max-w-[100px]"
										title={metadata.createdBy}
									>
										{metadata.createdBy}
									</span>
								</div>
							)}
							{metadata.lastModifiedBy &&
								metadata.lastModifiedBy !== metadata.createdBy && (
									<div className="text-[11px] text-gray-600 flex justify-between mt-0.5">
										<span className="text-gray-400">Modified by:</span>
										<span
											className="font-medium truncate max-w-[100px]"
											title={metadata.lastModifiedBy}
										>
											{metadata.lastModifiedBy}
										</span>
									</div>
								)}
						</div>
					</>
				)}
			</div>
		</>
	);
}
