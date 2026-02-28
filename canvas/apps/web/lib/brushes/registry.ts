/**
 * ============================================================================
 * LEKHAFLOW - BRUSH REGISTRY
 * ============================================================================
 *
 * Central registry that maps brush-type identifiers to Brush instances.
 * All built-in brushes are registered at module load time.
 */

import { CalligraphyBrush } from "./calligraphy-brush";
import { MarkerBrush } from "./marker-brush";
import { RoundBrush } from "./round-brush";
import type { Brush, BrushType } from "./types";

// ============================================================================
// REGISTRY
// ============================================================================

const brushMap = new Map<string, Brush>([
	[RoundBrush.type, RoundBrush],
	[MarkerBrush.type, MarkerBrush],
	[CalligraphyBrush.type, CalligraphyBrush],
]);

/**
 * Retrieve a brush by its type identifier.
 *
 * @returns The matching `Brush`, or `undefined` if not registered.
 */
export function getBrush(type: BrushType | string): Brush | undefined {
	return brushMap.get(type);
}

/**
 * Register a custom brush at runtime.
 * Overwrites any existing brush with the same `type`.
 */
export function registerBrush(brush: Brush): void {
	brushMap.set(brush.type, brush);
}

/**
 * List all registered brush type identifiers.
 */
export function listBrushTypes(): string[] {
	return [...brushMap.keys()];
}

/**
 * List all registered brush instances.
 */
export function listBrushes(): Brush[] {
	return [...brushMap.values()];
}
