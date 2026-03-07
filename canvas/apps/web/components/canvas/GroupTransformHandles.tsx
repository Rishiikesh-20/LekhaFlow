"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Line, Rect } from "react-konva";

export type GroupHandlePosition =
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right"
	| "top-center"
	| "bottom-center"
	| "left-center"
	| "right-center";

interface GroupTransformHandlesProps {
	/** Group bounding box (with 4px padding already applied externally) */
	x: number;
	y: number;
	width: number;
	height: number;
	onResizeStart: (
		handle: GroupHandlePosition,
		e: KonvaEventObject<MouseEvent>,
	) => void;
	onResizeMove: (
		handle: GroupHandlePosition,
		e: KonvaEventObject<MouseEvent>,
	) => void;
	onResizeEnd: () => void;
	onRotateStart: (e: KonvaEventObject<MouseEvent>) => void;
	onRotateMove: (e: KonvaEventObject<MouseEvent>) => void;
	onRotateEnd: () => void;
}

const HANDLE_SIZE = 8;
const HANDLE_COLOR = "#6965db";
const HANDLE_STROKE = "#ffffff";
const ROTATE_HANDLE_OFFSET = 30;

export function GroupTransformHandles({
	x,
	y,
	width,
	height,
	onResizeStart,
	onResizeMove,
	onResizeEnd,
	onRotateStart,
	onRotateMove,
	onRotateEnd,
}: GroupTransformHandlesProps) {
	const handles: {
		position: GroupHandlePosition;
		cx: number;
		cy: number;
		cursor: string;
	}[] = [
		{ position: "top-left", cx: x, cy: y, cursor: "nwse-resize" },
		{ position: "top-right", cx: x + width, cy: y, cursor: "nesw-resize" },
		{ position: "bottom-left", cx: x, cy: y + height, cursor: "nesw-resize" },
		{
			position: "bottom-right",
			cx: x + width,
			cy: y + height,
			cursor: "nwse-resize",
		},
		{ position: "top-center", cx: x + width / 2, cy: y, cursor: "ns-resize" },
		{
			position: "bottom-center",
			cx: x + width / 2,
			cy: y + height,
			cursor: "ns-resize",
		},
		{
			position: "left-center",
			cx: x,
			cy: y + height / 2,
			cursor: "ew-resize",
		},
		{
			position: "right-center",
			cx: x + width,
			cy: y + height / 2,
			cursor: "ew-resize",
		},
	];

	const rotateCx = x + width / 2;
	const rotateCy = y - ROTATE_HANDLE_OFFSET;

	return (
		<>
			{/* Group bounding box */}
			<Rect
				x={x}
				y={y}
				width={width}
				height={height}
				stroke={HANDLE_COLOR}
				strokeWidth={1.5}
				dash={[6, 3]}
				listening={false}
			/>

			{/* Connection line from top edge to rotate handle */}
			<Line
				points={[x + width / 2, y, rotateCx, rotateCy]}
				stroke={HANDLE_COLOR}
				strokeWidth={1}
				dash={[4, 4]}
				listening={false}
			/>

			{/* Rotate handle */}
			<Circle
				x={rotateCx}
				y={rotateCy}
				radius={HANDLE_SIZE / 2 + 1}
				fill={HANDLE_COLOR}
				stroke={HANDLE_STROKE}
				strokeWidth={2}
				draggable
				onMouseEnter={(e) => {
					const container = e.target.getStage()?.container();
					if (container) container.style.cursor = "grab";
				}}
				onMouseLeave={(e) => {
					const container = e.target.getStage()?.container();
					if (container) container.style.cursor = "default";
				}}
				onDragStart={(e) => {
					e.cancelBubble = true;
					const container = e.target.getStage()?.container();
					if (container) container.style.cursor = "grabbing";
					onRotateStart(e as unknown as KonvaEventObject<MouseEvent>);
				}}
				onDragMove={(e) => {
					e.cancelBubble = true;
					onRotateMove(e as unknown as KonvaEventObject<MouseEvent>);
					// Pin handle in place — the parent re-renders with new positions
					e.target.x(rotateCx);
					e.target.y(rotateCy);
				}}
				onDragEnd={(e) => {
					e.cancelBubble = true;
					const container = e.target.getStage()?.container();
					if (container) container.style.cursor = "default";
					e.target.x(rotateCx);
					e.target.y(rotateCy);
					onRotateEnd();
				}}
			/>

			{/* Resize handles */}
			{handles.map(({ position, cx, cy, cursor }) => (
				<Circle
					key={`group-handle-${position}`}
					x={cx}
					y={cy}
					radius={HANDLE_SIZE / 2}
					fill={HANDLE_COLOR}
					stroke={HANDLE_STROKE}
					strokeWidth={1}
					draggable
					onMouseEnter={(e) => {
						const container = e.target.getStage()?.container();
						if (container) container.style.cursor = cursor;
					}}
					onMouseLeave={(e) => {
						const container = e.target.getStage()?.container();
						if (container) container.style.cursor = "default";
					}}
					onDragStart={(e) => {
						e.cancelBubble = true;
						onResizeStart(
							position,
							e as unknown as KonvaEventObject<MouseEvent>,
						);
					}}
					onDragMove={(e) => {
						e.cancelBubble = true;
						onResizeMove(
							position,
							e as unknown as KonvaEventObject<MouseEvent>,
						);
						// Pin handle so it doesn't drift
						e.target.x(cx);
						e.target.y(cy);
					}}
					onDragEnd={(e) => {
						e.cancelBubble = true;
						e.target.x(cx);
						e.target.y(cy);
						onResizeEnd();
					}}
				/>
			))}
		</>
	);
}
