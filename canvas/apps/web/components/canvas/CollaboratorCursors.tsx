/**
 * ============================================================================
 * LEKHAFLOW - COLLABORATOR CURSORS
 * ============================================================================
 *
 * Renders cursor positions and labels for other users in real-time.
 */

"use client";

interface Collaborator {
	id: string;
	name: string;
	color: string;
	cursor: { x: number; y: number } | null;
	selectedElementIds: string[];
	isCurrentUser: boolean;
}

interface CollaboratorCursorProps {
	collaborator: Collaborator;
}

function CollaboratorCursor({ collaborator }: CollaboratorCursorProps) {
	const { cursor, name, color, isCurrentUser } = collaborator;

	if (!cursor) return null;

	// Don't render anything for the current user — they already see their OS cursor
	if (isCurrentUser) return null;

	return (
		<div
			className="absolute left-0 top-0 pointer-events-none z-[999] transition-transform duration-100 ease-linear"
			style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
		>
			{/* Cursor Arrow */}
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				className="drop-shadow-md"
				aria-labelledby={`cursor-${collaborator.id}`}
			>
				<title id={`cursor-${collaborator.id}`}>{name}&apos;s cursor</title>
				<path
					d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L5.88 2.85a.5.5 0 0 0-.38.36z"
					fill={color}
					stroke="white"
					strokeWidth="1.5"
				/>
			</svg>

			{/* Name Label */}
			<div
				className="absolute left-[18px] top-[18px] px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-md whitespace-nowrap max-w-[120px] overflow-hidden text-ellipsis"
				style={{ backgroundColor: color }}
			>
				{name}
			</div>
		</div>
	);
}

interface CollaboratorCursorsProps {
	collaborators: Collaborator[];
	/** Current user's own display name — used to suppress self-rendering */
	myName?: string;
}

export function CollaboratorCursors({
	collaborators,
	myName,
}: CollaboratorCursorsProps) {
	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden z-[100]">
			{collaborators
				.filter(
					(c) =>
						// Hide the local user by isCurrentUser flag or by name match
						!c.isCurrentUser && (!myName || c.name !== myName),
				)
				.map((collaborator) => (
					<CollaboratorCursor
						key={collaborator.id}
						collaborator={collaborator}
					/>
				))}
		</div>
	);
}
