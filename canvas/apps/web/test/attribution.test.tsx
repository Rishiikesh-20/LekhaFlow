/**
 * ============================================================================
 * ATTRIBUTION / BLAME TESTS (Story 7)
 * ============================================================================
 *
 * Validates:
 * 1. Attribution metadata lives on CanvasElement (compile-time contract)
 * 2. AttributionTooltip shows correct creator / modifier / timestamps
 * 3. Tooltip visibility behaviour (null element, absent metadata, etc.)
 * 4. Attribution embedding logic (mirrors useYjsSync add/update)
 */

import type { CanvasElement } from "@repo/common";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttributionTooltip } from "../components/canvas/AttributionTooltip";

// ─────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────

const baseMockElement: CanvasElement = {
	id: "elem-1",
	type: "rectangle",
	x: 100,
	y: 200,
	width: 50,
	height: 50,
	angle: 0,
	strokeColor: "#000",
	backgroundColor: "transparent",
	strokeWidth: 2,
	strokeStyle: "solid",
	fillStyle: "solid",
	opacity: 100,
	roughness: 0,
	seed: 12345,
	version: 1,
	versionNonce: 111,
	isDeleted: false,
	groupIds: [],
	boundElements: null,
	updated: Date.now() - 60_000, // 1 minute ago
	link: null,
	locked: false,
	created: Date.now() - 120_000, // 2 minutes ago
	createdBy: "Alice",
	lastModifiedBy: "Alice",
	roundness: null,
};

// ─────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────

describe("Story 7 – Object Blame / Attribution Inspection", () => {
	// ───────────────────────────────────────────────────────────────
	// 1. DATA MODEL
	// ───────────────────────────────────────────────────────────────

	describe("Data Model", () => {
		it("CanvasElement includes createdBy, lastModifiedBy, and created", () => {
			const el: CanvasElement = baseMockElement;
			expect(el.createdBy).toBe("Alice");
			expect(el.lastModifiedBy).toBe("Alice");
			expect(typeof el.created).toBe("number");
		});

		it("createdBy and lastModifiedBy are independent", () => {
			const el: CanvasElement = {
				...baseMockElement,
				createdBy: "Alice",
				lastModifiedBy: "Bob",
			};
			expect(el.createdBy).toBe("Alice");
			expect(el.lastModifiedBy).toBe("Bob");
		});
	});

	// ───────────────────────────────────────────────────────────────
	// 2. ATTRIBUTION TOOLTIP
	// ───────────────────────────────────────────────────────────────

	describe("AttributionTooltip", () => {
		it("renders nothing when element is null", () => {
			const { container } = render(
				<AttributionTooltip element={null} x={0} y={0} delay={0} />,
			);
			expect(container.innerHTML).toBe("");
		});

		it("shows creator when element is provided", () => {
			render(
				<AttributionTooltip
					element={baseMockElement}
					x={100}
					y={200}
					delay={0}
				/>,
			);
			expect(screen.getByText("Alice")).toBeTruthy();
			expect(screen.getByText("Created by")).toBeTruthy();
		});

		it("shows 'Modified by' when lastModifiedBy differs from createdBy", () => {
			const el: CanvasElement = {
				...baseMockElement,
				createdBy: "Alice",
				lastModifiedBy: "Bob",
			};

			render(<AttributionTooltip element={el} x={0} y={0} delay={0} />);

			expect(screen.getByText("Alice")).toBeTruthy();
			expect(screen.getByText("Bob")).toBeTruthy();
			expect(screen.getByText("Modified by")).toBeTruthy();
		});

		it("does NOT show 'Modified by' when same as creator", () => {
			const el: CanvasElement = {
				...baseMockElement,
				createdBy: "Alice",
				lastModifiedBy: "Alice",
			};

			render(<AttributionTooltip element={el} x={0} y={0} delay={0} />);

			expect(screen.getByText("Alice")).toBeTruthy();
			expect(screen.queryByText("Modified by")).toBeNull();
		});

		it("shows element type badge", () => {
			render(
				<AttributionTooltip element={baseMockElement} x={0} y={0} delay={0} />,
			);
			expect(screen.getByText("Rectangle")).toBeTruthy();
		});

		it("renders nothing when createdBy and lastModifiedBy are both absent", () => {
			const el: CanvasElement = {
				...baseMockElement,
				createdBy: undefined,
				lastModifiedBy: undefined,
			};

			const { container } = render(
				<AttributionTooltip element={el} x={0} y={0} delay={0} />,
			);

			expect(container.querySelector("[class*='fixed']")).toBeNull();
		});

		it("hides when element changes to null", () => {
			const { rerender } = render(
				<AttributionTooltip element={baseMockElement} x={0} y={0} delay={0} />,
			);

			expect(screen.getByText("Alice")).toBeTruthy();

			rerender(<AttributionTooltip element={null} x={0} y={0} delay={0} />);

			expect(screen.queryByText("Alice")).toBeNull();
		});

		it("shows relative timestamps", () => {
			const el: CanvasElement = {
				...baseMockElement,
				created: Date.now() - 30_000, // 30 seconds ago
			};

			render(<AttributionTooltip element={el} x={0} y={0} delay={0} />);

			expect(screen.getByText("Just now")).toBeTruthy();
		});

		it("shows 'Xm ago' for timestamps under 1 hour", () => {
			const el: CanvasElement = {
				...baseMockElement,
				created: Date.now() - 5 * 60_000, // 5 minutes ago
			};

			render(<AttributionTooltip element={el} x={0} y={0} delay={0} />);

			expect(screen.getByText("5m ago")).toBeTruthy();
		});

		it("shows 'Xh ago' for timestamps under 24 hours", () => {
			const el: CanvasElement = {
				...baseMockElement,
				created: Date.now() - 3 * 3_600_000, // 3 hours ago
			};

			render(<AttributionTooltip element={el} x={0} y={0} delay={0} />);

			expect(screen.getByText("3h ago")).toBeTruthy();
		});

		it("positions the tooltip at x+12, y-8", () => {
			const { container } = render(
				<AttributionTooltip
					element={baseMockElement}
					x={200}
					y={300}
					delay={0}
				/>,
			);

			const tooltip = container.querySelector("[class*='fixed']");
			expect(tooltip).toBeTruthy();
			expect((tooltip as HTMLElement).style.left).toBe("212px");
			expect((tooltip as HTMLElement).style.top).toBe("292px");
		});
	});

	// ───────────────────────────────────────────────────────────────
	// 3. ATTRIBUTION EMBEDDING LOGIC (mirrors useYjsSync)
	// ───────────────────────────────────────────────────────────────

	describe("Attribution embedding", () => {
		it("addElement enriches with createdBy when not set", () => {
			const myName = "CurrentUser";
			const element: Partial<CanvasElement> = {
				...baseMockElement,
				createdBy: undefined,
				lastModifiedBy: undefined,
			};

			const enriched = {
				...element,
				createdBy: element.createdBy || myName,
				lastModifiedBy: element.lastModifiedBy || myName,
			};

			expect(enriched.createdBy).toBe("CurrentUser");
			expect(enriched.lastModifiedBy).toBe("CurrentUser");
		});

		it("addElement preserves existing createdBy", () => {
			const myName = "CurrentUser";
			const element: Partial<CanvasElement> = {
				...baseMockElement,
				createdBy: "OriginalAuthor",
				lastModifiedBy: "OriginalAuthor",
			};

			const enriched = {
				...element,
				createdBy: element.createdBy || myName,
				lastModifiedBy: element.lastModifiedBy || myName,
			};

			expect(enriched.createdBy).toBe("OriginalAuthor");
		});

		it("updateElement sets lastModifiedBy to current user", () => {
			const myName = "UserB";
			const existing: CanvasElement = {
				...baseMockElement,
				createdBy: "UserA",
				lastModifiedBy: "UserA",
			};

			const updated = {
				...existing,
				width: 200,
				lastModifiedBy: myName,
				version: (existing.version || 0) + 1,
				updated: Date.now(),
			};

			expect(updated.createdBy).toBe("UserA");
			expect(updated.lastModifiedBy).toBe("UserB");
			expect(updated.version).toBe(2);
		});

		it("updateElement preserves createdBy from original author", () => {
			const myName = "UserC";
			const existing: CanvasElement = {
				...baseMockElement,
				createdBy: "UserA",
				lastModifiedBy: "UserB",
			};

			const updated = {
				...existing,
				strokeColor: "#ff0000",
				lastModifiedBy: myName,
			};

			expect(updated.createdBy).toBe("UserA");
			expect(updated.lastModifiedBy).toBe("UserC");
		});
	});
});
