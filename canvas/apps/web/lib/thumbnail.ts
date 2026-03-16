import type { Stage } from "konva/lib/Stage";

/**
 * Generates a thumbnail image from the Konva stage.
 * @param stageRef The Konva Stage instance
 * @param backgroundColor The canvas background color to include in the thumbnail
 * @returns A Blob containing the image data
 */
export async function generateThumbnailBlob(
	stage: Stage,
	backgroundColor = "#ffffff",
): Promise<Blob | null> {
	const layer = stage.getLayers()[0];
	if (!layer || (layer.children && layer.children.length === 0)) return null;

	try {
		const KonvaLib = (await import("konva")).default;

		// Add temporary background for the export
		// We calculate the visible area in world coordinates
		const bgRect = new KonvaLib.Rect({
			x: -stage.x() / stage.scaleX(),
			y: -stage.y() / stage.scaleY(),
			width: stage.width() / stage.scaleX(),
			height: stage.height() / stage.scaleY(),
			fill: backgroundColor,
		});

		layer.add(bgRect as unknown as import("konva/lib/Shape").Shape);
		bgRect.moveToBottom();
		layer.draw();

		// Export as data URL first
		const dataURL = stage.toDataURL({
			pixelRatio: 0.2, // Low quality for thumbnails
			mimeType: "image/jpeg",
			quality: 0.8,
		});

		// Cleanup: remove the temp background immediately
		bgRect.destroy();
		layer.draw();

		// Convert Data URL to Blob
		const res = await fetch(dataURL);
		return await res.blob();
	} catch (error) {
		console.error("[Thumbnail] Generation failed:", error);
		return null;
	}
}
