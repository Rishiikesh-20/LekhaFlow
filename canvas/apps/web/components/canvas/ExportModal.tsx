/**
 * ============================================================================
 * LEKHAFLOW - EXPORT MODAL
 * ============================================================================
 *
 * Modal for exporting canvas as PNG, SVG, or JSON.
 */

"use client";

import type {
	ArrowElement,
	CanvasElement,
	FreedrawElement,
	LineElement,
	TextElement,
} from "@repo/common";
import type Konva from "konva";
import { Download, FileCode, FileJson, Image, Loader2, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

interface ExportModalProps {
	isOpen: boolean;
	onClose: () => void;
	elements: CanvasElement[];
	// biome-ignore lint/suspicious/noExplicitAny: External library RefObject type
	stageRef: React.RefObject<any>;
	initialFormat?: ExportFormat;
}

type ExportFormat = "png" | "svg" | "json";

interface ExportOption {
	id: ExportFormat;
	icon: React.ReactNode;
	label: string;
	description: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
	{
		id: "png",
		icon: <Image size={22} />,
		label: "PNG",
		description: "Raster image",
	},
	{
		id: "svg",
		icon: <FileCode size={22} />,
		label: "SVG",
		description: "Scalable vector",
	},
	{
		id: "json",
		icon: <FileJson size={22} />,
		label: "JSON",
		description: "Raw data",
	},
];

export function ExportModal({
	isOpen,
	onClose,
	elements,
	stageRef,
	initialFormat,
}: ExportModalProps) {
	const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(
		initialFormat || "png",
	);
	const [isExporting, setIsExporting] = useState(false);
	const [scale, setScale] = useState(2);
	const [includeBackground, setIncludeBackground] = useState(true);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	// Sync format when initialFormat changes (e.g., from sidebar menu)
	useEffect(() => {
		if (initialFormat && isOpen) {
			setSelectedFormat(initialFormat);
		}
	}, [initialFormat, isOpen]);

	// Generate a preview thumbnail when modal opens
	const generatePreview = useCallback(async () => {
		if (stageRef.current && isOpen) {
			try {
				const stage = stageRef.current as Konva.Stage;
				const layer = stage.getLayers()[0];

				// Add temp background for preview
				const KonvaLib = (await import("konva")).default;
				const bgRect = new KonvaLib.Rect({
					x: -stage.x() / stage.scaleX(),
					y: -stage.y() / stage.scaleY(),
					width: stage.width() / stage.scaleX(),
					height: stage.height() / stage.scaleY(),
					fill: "#fafafa",
				});
				layer?.add(bgRect);
				bgRect.moveToBottom();
				layer?.draw();

				const dataURL = stage.toDataURL({
					pixelRatio: 0.5,
					mimeType: "image/png",
				});
				setPreviewUrl(dataURL);

				// Cleanup
				bgRect.destroy();
				layer?.draw();
			} catch (err) {
				console.error("Failed to generate preview:", err);
				setPreviewUrl(null);
			}
		}
	}, [stageRef, isOpen]);

	useEffect(() => {
		if (isOpen) {
			generatePreview();
		} else {
			setPreviewUrl(null);
		}
	}, [isOpen, generatePreview]);

	const handleExport = async () => {
		setIsExporting(true);

		try {
			const timestamp = new Date().toISOString().slice(0, 10);
			const filename = `lekhaflow-canvas-${timestamp}`;

			switch (selectedFormat) {
				case "png": {
					if (stageRef.current) {
						const stage = stageRef.current as Konva.Stage;
						const layer = stage.getLayers()[0];

						// Add a background rect if needed
						let bgRect: Konva.Rect | null = null;
						if (includeBackground && layer) {
							const KonvaLib = (await import("konva")).default;
							bgRect = new KonvaLib.Rect({
								x: -stage.x() / stage.scaleX(),
								y: -stage.y() / stage.scaleY(),
								width: stage.width() / stage.scaleX(),
								height: stage.height() / stage.scaleY(),
								fill: "#fafafa",
							});
							layer.add(bgRect);
							bgRect.moveToBottom();
							layer.draw();
						}

						const dataURL = stage.toDataURL({
							pixelRatio: scale,
							mimeType: "image/png",
						});
						downloadFile(dataURL, `${filename}.png`);

						// Remove temp background
						if (bgRect) {
							bgRect.destroy();
							layer?.draw();
						}
					}
					break;
				}

				case "svg": {
					const svg = generateSVG(elements, includeBackground);
					const blob = new Blob([svg], { type: "image/svg+xml" });
					const url = URL.createObjectURL(blob);
					downloadFile(url, `${filename}.svg`);
					URL.revokeObjectURL(url);
					break;
				}

				case "json": {
					const data = {
						version: "1.0",
						exportedAt: new Date().toISOString(),
						elements: elements,
					};
					const blob = new Blob([JSON.stringify(data, null, 2)], {
						type: "application/json",
					});
					const url = URL.createObjectURL(blob);
					downloadFile(url, `${filename}.json`);
					URL.revokeObjectURL(url);
					break;
				}
			}

			await new Promise((r) => setTimeout(r, 500));
			onClose();
		} catch (error) {
			console.error("Export failed:", error);
		} finally {
			setIsExporting(false);
		}
	};

	const downloadFile = (url: string, filename: string) => {
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const generateSVG = (
		elements: CanvasElement[],
		withBackground: boolean,
	): string => {
		const activeElements = elements.filter((el) => !el.isDeleted);

		if (activeElements.length === 0) {
			return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><text x="50" y="50" fill="#999" font-size="14">Empty canvas</text></svg>`;
		}

		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;

		for (const el of activeElements) {
			const w = Math.abs(el.width || 0);
			const h = Math.abs(el.height || 0);
			minX = Math.min(minX, el.x);
			minY = Math.min(minY, el.y);
			maxX = Math.max(maxX, el.x + w);
			maxY = Math.max(maxY, el.y + h);

			// For freedraw/line/arrow, check all points
			if (el.type === "freedraw") {
				const fd = el as FreedrawElement;
				for (const pt of fd.points) {
					minX = Math.min(minX, el.x + pt[0]);
					minY = Math.min(minY, el.y + pt[1]);
					maxX = Math.max(maxX, el.x + pt[0]);
					maxY = Math.max(maxY, el.y + pt[1]);
				}
			}
			if (el.type === "line" || el.type === "arrow") {
				const lineEl = el as LineElement | ArrowElement;
				for (const pt of lineEl.points) {
					minX = Math.min(minX, el.x + pt.x);
					minY = Math.min(minY, el.y + pt.y);
					maxX = Math.max(maxX, el.x + pt.x);
					maxY = Math.max(maxY, el.y + pt.y);
				}
			}
		}

		const padding = 40;
		const width = maxX - minX + padding * 2;
		const height = maxY - minY + padding * 2;
		const offsetX = -minX + padding;
		const offsetY = -minY + padding;

		let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}">`;

		if (withBackground) {
			svg += `<rect width="100%" height="100%" fill="#fafafa"/>`;
		}

		// Add arrow marker defs
		svg += `<defs>`;
		svg += `<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="currentColor"/></marker>`;
		svg += `<marker id="arrowhead-start" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"><polygon points="10 0, 0 3.5, 10 7" fill="currentColor"/></marker>`;
		svg += `</defs>`;

		for (const el of activeElements) {
			const x = el.x + offsetX;
			const y = el.y + offsetY;
			const stroke = el.strokeColor || "#1e1e1e";
			const strokeWidth = el.strokeWidth || 1;
			const fill =
				el.backgroundColor === "transparent"
					? "none"
					: el.backgroundColor || "none";
			const opacity = (el.opacity || 100) / 100;
			const transform = el.angle
				? ` transform="rotate(${el.angle} ${x + (el.width || 0) / 2} ${y + (el.height || 0) / 2})"`
				: "";

			switch (el.type) {
				case "rectangle": {
					const rx =
						(el as { roundness?: { value: number } | null }).roundness?.value ||
						0;
					svg += `<rect x="${x}" y="${y}" width="${Math.abs(el.width)}" height="${Math.abs(el.height)}" rx="${rx}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" opacity="${opacity}"${transform}/>`;
					break;
				}
				case "ellipse": {
					const cx = x + Math.abs(el.width || 0) / 2;
					const cy = y + Math.abs(el.height || 0) / 2;
					svg += `<ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(el.width || 0) / 2}" ry="${Math.abs(el.height || 0) / 2}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" opacity="${opacity}"${transform}/>`;
					break;
				}
				case "diamond": {
					const w = Math.abs(el.width || 0);
					const h = Math.abs(el.height || 0);
					const cx = x + w / 2;
					const cy = y + h / 2;
					const points = `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`;
					svg += `<polygon points="${points}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" opacity="${opacity}"${transform}/>`;
					break;
				}
				case "line": {
					const lineEl = el as LineElement;
					if (lineEl.points.length >= 2) {
						const pathPoints = lineEl.points
							.map((pt) => `${x + pt.x},${y + pt.y}`)
							.join(" ");
						let markers = "";
						if (lineEl.startArrowhead && lineEl.startArrowhead !== "none")
							markers += ` marker-start="url(#arrowhead-start)"`;
						if (lineEl.endArrowhead && lineEl.endArrowhead !== "none")
							markers += ` marker-end="url(#arrowhead)"`;
						svg += `<polyline points="${pathPoints}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" opacity="${opacity}"${markers} stroke-linecap="round" stroke-linejoin="round"/>`;
					}
					break;
				}
				case "arrow": {
					const arrowEl = el as ArrowElement;
					if (arrowEl.points.length >= 2) {
						const pathPoints = arrowEl.points
							.map((pt) => `${x + pt.x},${y + pt.y}`)
							.join(" ");
						let markers = ` marker-end="url(#arrowhead)"`;
						if (arrowEl.startArrowhead && arrowEl.startArrowhead !== "none")
							markers += ` marker-start="url(#arrowhead-start)"`;
						svg += `<polyline points="${pathPoints}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" opacity="${opacity}"${markers} stroke-linecap="round" stroke-linejoin="round" style="color:${stroke}"/>`;
					}
					break;
				}
				case "freedraw": {
					const fdEl = el as FreedrawElement;
					if (fdEl.points.length >= 2) {
						const first = fdEl.points[0];
						if (!first) break;
						let d = `M ${x + first[0]} ${y + first[1]}`;
						for (let i = 1; i < fdEl.points.length; i++) {
							const pt = fdEl.points[i];
							if (!pt) continue;
							d += ` L ${x + pt[0]} ${y + pt[1]}`;
						}
						svg += `<path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
					}
					break;
				}
				case "text": {
					const textEl = el as TextElement;
					const textAlign = textEl.textAlign || "left";
					let anchor = "start";
					if (textAlign === "center") anchor = "middle";
					if (textAlign === "right") anchor = "end";
					let textX = x;
					if (textAlign === "center") textX = x + Math.abs(el.width || 0) / 2;
					if (textAlign === "right") textX = x + Math.abs(el.width || 0);

					if (textEl.runs && textEl.runs.length > 0) {
						// Rich-text SVG export: render each run with its own style
						svg += `<text x="${textX}" y="${y}" text-anchor="${anchor}" opacity="${opacity}"${transform}>`;
						let lineIdx = 0;
						let runX = textX;
						for (const run of textEl.runs) {
							const rFontSize = run.fontSize || textEl.fontSize || 16;
							const rFamily = run.fontFamily || "Arial";
							const rWeight = run.bold ? "bold" : "normal";
							const rStyle = run.italic ? "italic" : "normal";
							const rDecoration = run.underline ? "underline" : "none";
							const escaped = (run.text || "")
								.replace(/&/g, "&amp;")
								.replace(/</g, "&lt;")
								.replace(/>/g, "&gt;");

							// Split on newlines for multi-line support
							const parts = escaped.split("\n");
							for (let p = 0; p < parts.length; p++) {
								const part = parts[p] ?? "";
								if (p > 0) {
									lineIdx++;
									runX = textX;
								}
								if (part) {
									const dyAttr =
										lineIdx === 0 && runX === textX
											? ` dy="${rFontSize}"`
											: p > 0
												? ` dy="${rFontSize * 1.25}"`
												: "";
									const xAttr = p > 0 ? ` x="${textX}"` : "";
									svg += `<tspan${xAttr}${dyAttr} fill="${stroke}" font-size="${rFontSize}" font-family="${rFamily}" font-weight="${rWeight}" font-style="${rStyle}" text-decoration="${rDecoration}">${part}</tspan>`;
								} else if (p > 0) {
									// Empty line after newline — emit a blank tspan for spacing
									svg += `<tspan x="${textX}" dy="${rFontSize * 1.25}"> </tspan>`;
								}
								runX += part.length * rFontSize * 0.6; // approximate advance
							}
						}
						svg += `</text>`;
					} else {
						// Legacy plain-text SVG export
						const fontSize = textEl.fontSize || 16;
						const lines = (textEl.text || "").split("\n");
						svg += `<text x="${textX}" y="${y}" fill="${stroke}" font-size="${fontSize}" text-anchor="${anchor}" opacity="${opacity}"${transform}>`;
						for (let i = 0; i < lines.length; i++) {
							const line = lines[i] ?? "";
							const escaped = line
								.replace(/&/g, "&amp;")
								.replace(/</g, "&lt;")
								.replace(/>/g, "&gt;");
							svg += `<tspan x="${textX}" dy="${i === 0 ? fontSize : fontSize * 1.2}">${escaped}</tspan>`;
						}
						svg += `</text>`;
					}
					break;
				}
			}
		}

		svg += "</svg>";
		return svg;
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
			{/* Backdrop */}
			<button
				type="button"
				className="absolute inset-0 bg-black/50 backdrop-blur-sm border-none cursor-default"
				onClick={onClose}
				aria-hidden="true"
				tabIndex={-1}
			/>

			{/* Modal */}
			<div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden animate-scale-in">
				{/* Header */}
				<div className="bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
							<Download size={22} className="text-white" />
						</div>
						<div>
							<h2 className="text-lg font-bold text-white m-0">
								Export Canvas
							</h2>
							<p className="text-[13px] text-white/70 m-0">
								{elements.length} elements
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-2.5 rounded-xl border-none bg-white/10 cursor-pointer hover:bg-white/20 transition-colors"
					>
						<X size={20} className="text-white" />
					</button>
				</div>

				{/* Content */}
				<div className="p-6">
					{/* Canvas Preview Thumbnail */}
					{previewUrl && (
						<div className="mb-5">
							<p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
								Preview
							</p>
							<div className="relative w-full h-[140px] rounded-xl overflow-hidden bg-gray-50 border border-gray-200 flex items-center justify-center">
								{" "}
								{/* biome-ignore lint/performance/noImgElement: Dynamic canvas preview from blob URL */}{" "}
								<img
									src={previewUrl}
									alt="Canvas preview"
									className="max-w-full max-h-full object-contain"
									style={{ imageRendering: "auto" }}
								/>
								<div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/50 text-white text-[10px] font-medium rounded-md">
									{elements.length} elements
								</div>
							</div>
						</div>
					)}

					{/* Format Selection */}
					<div className="mb-5">
						<p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
							Export Format
						</p>
						<div className="flex gap-3">
							{EXPORT_OPTIONS.map((option) => (
								<button
									type="button"
									key={option.id}
									onClick={() => setSelectedFormat(option.id)}
									className={`relative flex-1 py-4 px-3 rounded-xl cursor-pointer transition-all flex flex-col items-center gap-2 border-none ${
										selectedFormat === option.id
											? "bg-violet-50 ring-2 ring-violet-500 shadow-sm"
											: "bg-white ring-1 ring-gray-200 hover:ring-gray-300"
									}`}
								>
									<span
										className={
											selectedFormat === option.id
												? "text-violet-500"
												: "text-gray-400"
										}
									>
										{option.icon}
									</span>
									<span className="text-[13px] font-semibold text-gray-700">
										{option.label}
									</span>
									<span className="text-[11px] text-gray-400">
										{option.description}
									</span>
								</button>
							))}
						</div>
					</div>

					{/* PNG Options */}
					{selectedFormat === "png" && (
						<div className="mb-5">
							<p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
								Scale (Resolution)
							</p>
							<div className="flex gap-2">
								{[1, 2, 3, 4].map((s) => (
									<button
										type="button"
										key={s}
										onClick={() => setScale(s)}
										className={`flex-1 py-2.5 rounded-lg cursor-pointer text-[13px] font-semibold transition-all border-none ${
											scale === s
												? "bg-violet-50 ring-2 ring-violet-500 text-violet-600"
												: "bg-white ring-1 ring-gray-200 text-gray-500 hover:ring-gray-300"
										}`}
									>
										{s}x
									</button>
								))}
							</div>
						</div>
					)}

					{/* Background Option */}
					{(selectedFormat === "png" || selectedFormat === "svg") && (
						<div className="mb-5">
							<label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-gray-50">
								<input
									type="checkbox"
									checked={includeBackground}
									onChange={(e) => setIncludeBackground(e.target.checked)}
									className="w-[18px] h-[18px] accent-violet-500"
								/>
								<span className="text-sm font-medium text-gray-700">
									Include background
								</span>
							</label>
						</div>
					)}

					{/* Export Button */}
					<button
						type="button"
						onClick={handleExport}
						disabled={isExporting}
						className={`w-full py-3.5 rounded-xl border-none bg-gradient-to-r from-violet-500 to-violet-600 text-white text-[15px] font-bold cursor-pointer flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(139,92,246,0.3)] transition-opacity ${
							isExporting ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
						}`}
					>
						{isExporting ? (
							<>
								<Loader2 size={18} className="animate-spin" />
								Exporting...
							</>
						) : (
							<>
								<Download size={18} />
								Export as {selectedFormat.toUpperCase()}
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
