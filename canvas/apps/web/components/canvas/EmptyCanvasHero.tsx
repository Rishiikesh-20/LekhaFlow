/**
 * ============================================================================
 * LEKHAFLOW - EMPTY CANVAS HERO
 * ============================================================================
 *
 * Hero section displayed when canvas is empty with hand-drawn annotations.
 */

"use client";

import { Rocket } from "lucide-react";

export function EmptyCanvasHero() {
	return (
		<div
			className="fixed inset-0 flex items-center justify-center pointer-events-none px-4"
			style={{
				zIndex: "var(--z-canvas)",
				fontFamily: "var(--font-handwritten)",
			}}
		>
			<div className="flex flex-col items-center gap-4 sm:gap-8 relative">
				{/* Logo Icon */}
				<div
					className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center"
					style={{
						background: "var(--color-accent)",
						borderRadius: "var(--radius-xl)",
						boxShadow: "var(--shadow-accent)",
					}}
				>
					<Rocket size={28} className="text-white sm:hidden" />
					<Rocket size={32} className="text-white hidden sm:block" />
				</div>

				{/* LekhaFlow Text */}
				<div
					className="text-3xl sm:text-6xl font-bold text-center"
					style={{
						color: "var(--color-text-primary)",
						fontFamily: "var(--font-handwritten)",
					}}
				>
					LekhaFlow
				</div>

				{/* Instructional Text */}
				<div
					className="text-sm sm:text-base text-center max-w-xs sm:max-w-md"
					style={{
						color: "var(--color-text-secondary)",
						fontFamily: "var(--font-handwritten)",
					}}
				>
					Your infinite canvas awaits. Pick a tool from above and start
					creating!
				</div>

				{/* Hand-drawn Arrow pointing to Toolbar — hidden on mobile */}
				<svg
					aria-label="Arrow pointing to toolbar"
					className="absolute pointer-events-none hidden sm:block"
					style={{
						top: "-180px",
						left: "-200px",
						width: "200px",
						height: "200px",
					}}
					viewBox="0 0 200 200"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<title>Arrow pointing to toolbar</title>
					{/* Curved dashed arrow path */}
					<path
						d="M 150 150 Q 120 80 100 40"
						stroke="var(--color-text-secondary)"
						strokeWidth="2"
						strokeDasharray="6 4"
						strokeLinecap="round"
						fill="none"
					/>
					{/* Arrow head */}
					<path
						d="M 95 45 L 100 40 L 105 42"
						stroke="var(--color-text-secondary)"
						strokeWidth="2"
						strokeLinecap="round"
						fill="none"
					/>
				</svg>

				{/* Annotation label for toolbar */}
				<div
					className="absolute text-sm font-medium hidden sm:block"
					style={{
						top: "-140px",
						left: "-290px",
						color: "var(--color-text-secondary)",
						fontFamily: "var(--font-handwritten)",
						transform: "rotate(-8deg)",
					}}
				>
					Pick a tool & start drawing!
				</div>

				{/* Hand-drawn Arrow pointing to Help button — hidden on mobile */}
				<svg
					aria-label="Arrow pointing to help button"
					className="absolute pointer-events-none hidden sm:block"
					style={{
						bottom: "-180px",
						right: "-250px",
						width: "200px",
						height: "180px",
					}}
					viewBox="0 0 200 180"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<title>Arrow pointing to help button</title>
					{/* Curved dashed arrow path */}
					<path
						d="M 50 30 Q 100 80 150 140"
						stroke="var(--color-text-secondary)"
						strokeWidth="2"
						strokeDasharray="6 4"
						strokeLinecap="round"
						fill="none"
					/>
					{/* Arrow head */}
					<path
						d="M 145 135 L 150 140 L 148 145"
						stroke="var(--color-text-secondary)"
						strokeWidth="2"
						strokeLinecap="round"
						fill="none"
					/>
				</svg>

				{/* Annotation label for help */}
				<div
					className="absolute text-sm font-medium hidden sm:block"
					style={{
						bottom: "-120px",
						right: "-320px",
						color: "var(--color-text-secondary)",
						fontFamily: "var(--font-handwritten)",
						transform: "rotate(6deg)",
					}}
				>
					Shortcuts & help
				</div>
			</div>
		</div>
	);
}
