/**
 * ============================================================================
 * LEKHAFLOW - BRUSH REGISTRY
 * ============================================================================
 *
 * Central registry that maps brush-type identifiers to Brush instances.
 * All built-in brushes are registered at module load time.
 */

import { PencilBrush } from "./pencil-brush";
import { SprayBrush } from "./spray-brush";
import type { Brush, BrushType } from "./types";
import { WatercolourBrush } from "./watercolour-brush";

// ============================================================================
// REGISTRY
// ============================================================================

const brushMap = new Map<string, Brush>([
	[PencilBrush.type, PencilBrush],
	[SprayBrush.type, SprayBrush],
	[WatercolourBrush.type, WatercolourBrush],
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
