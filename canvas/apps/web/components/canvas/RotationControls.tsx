"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Group, Line, Path } from "react-konva";

interface RotationControlsProps {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	elementId: string;
	zoom: number;
	scrollX: number;
	scrollY: number;
	onRotate90: (elementId: string) => void;
	onRotationStart: (elementId: string, e: KonvaEventObject<MouseEvent>) => void;
	onRotationMove: (
		elementId: string,
		angle: number,
		e: KonvaEventObject<MouseEvent>,
	) => void;
	onRotationEnd: (elementId: string) => void;
}

const HANDLE_SIZE = 10;
const BUTTON_SIZE = 24;
const HANDLE_COLOR = "#6965db";
const HANDLE_STROKE = "#ffffff";
const BUTTON_BG = "#ffffff";
const HANDLE_OFFSET = 40; // Distance above element

export function RotationControls({
	x,
	y,
	width,
	height,
	rotation,
	elementId,
	zoom,
	scrollX,
	scrollY,
	onRotate90,
	onRotationStart,
	onRotationMove,
	onRotationEnd,
}: RotationControlsProps) {
	// Element center in world coordinates (pivot point)
	const centerX = x + width / 2;
	const centerY = y + height / 2;

	// Positions relative to center (local space of the rotated wrapper Group)
	const halfH = height / 2;
	const handleLocalY = -(halfH + HANDLE_OFFSET + BUTTON_SIZE);
	const buttonLocalY = -(halfH + HANDLE_OFFSET / 2);
	const topEdgeLocalY = -halfH;

	// Circular arrow icon
	const rotateIconPath = "M 6 -2 A 5 5 0 1 1 1 3 L 1 0 L 4 3 L 1 3 Z";

	return (
		<Group x={centerX} y={centerY} rotation={rotation}>
			{/* Connection line from element top-edge to handle */}
			<Line
				points={[0, topEdgeLocalY, 0, handleLocalY]}
				stroke={HANDLE_COLOR}
				strokeWidth={1}
				dash={[4, 4]}
				listening={false}
			/>

			{/* 90° Rotation Button */}
			<Group
				x={0}
				y={buttonLocalY}
				onClick={(e) => {
					e.cancelBubble = true;
					onRotate90(elementId);
				}}
				onMouseEnter={(e) => {
					const container = e.target.getStage()?.container();
					if (container) container.style.cursor = "pointer";
				}}
				onMouseLeave={(e) => {
					const container = e.target.getStage()?.container();
					if (container) container.style.cursor = "default";
				}}
			>
				<Circle
					radius={BUTTON_SIZE / 2}
					fill={BUTTON_BG}
					stroke={HANDLE_COLOR}
					strokeWidth={2}
					shadowColor="rgba(0,0,0,0.2)"
					shadowBlur={4}
					shadowOffset={{ x: 0, y: 2 }}
				/>
				<Path
					data={rotateIconPath}
					fill={HANDLE_COLOR}
					scaleX={1.2}
					scaleY={1.2}
				/>
			</Group>

			{/* Arbitrary Rotation Drag Handle */}
			<Circle
				x={0}
				y={handleLocalY}
				radius={HANDLE_SIZE / 2}
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
					onRotationStart(
						elementId,
						e as unknown as KonvaEventObject<MouseEvent>,
					);
				}}
				onDragMove={(e) => {
					e.cancelBubble = true;

					const stage = e.target.getStage();
					const screenPos = stage?.getPointerPosition();
					if (!screenPos) return;

					// Convert screen → canvas world coordinates
					const canvasMouseX = (screenPos.x - scrollX) / zoom;
					const canvasMouseY = (screenPos.y - scrollY) / zoom;

					// Angle from pivot (element center) to pointer, top = 0°
					const dx = canvasMouseX - centerX;
					const dy = canvasMouseY - centerY;
					const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
					const normalizedAngle = ((angleDeg % 360) + 360) % 360;

					onRotationMove(
						elementId,
						normalizedAngle,
						e as unknown as KonvaEventObject<MouseEvent>,
					);

					// Force handle back to its local-space position so it
					// doesn't drift while the parent Group re-renders with the
					// new rotation value.
					e.target.x(0);
					e.target.y(handleLocalY);
				}}
				onDragEnd={(e) => {
					e.cancelBubble = true;
					const container = e.target.getStage()?.container();
					if (container) container.style.cursor = "default";
					e.target.x(0);
					e.target.y(handleLocalY);
					onRotationEnd(elementId);
				}}
			/>
		</Group>
	);
}
