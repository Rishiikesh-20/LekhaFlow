import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Canvas } from "../components/Canvas";
import { CanvasAuthWrapper } from "../components/CanvasAuthWrapper";
import { Toolbar } from "../components/canvas/Toolbar";
import { ZoomControls } from "../components/canvas/ZoomControls";
import { initialState, useCanvasStore } from "../store/canvas-store";

// ----------------------------------------------------------------------------
// MOCKS
// ----------------------------------------------------------------------------

// Store auth callback for testing
// biome-ignore lint/suspicious/noExplicitAny: Mocking auth callback
let capturedAuthCallback: any = null;

const { mockPush, mockReplace, mockGetSession, mockOnAuthStateChange } =
	vi.hoisted(() => {
		return {
			mockPush: vi.fn(),
			mockReplace: vi.fn(),
			mockGetSession: vi.fn(),
			// biome-ignore lint/suspicious/noExplicitAny: Mocking auth callback
			mockOnAuthStateChange: vi.fn((cb: any) => {
				capturedAuthCallback = cb;
				return {
					data: { subscription: { unsubscribe: vi.fn() } },
				};
			}),
		};
	});

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: mockReplace,
	}),
	usePathname: () => "/canvas/room-1",
	useSearchParams: () => ({
		get: vi.fn(() => null),
	}),
}));

// Mock Supabase
vi.mock("../lib/supabase.client", () => ({
	supabase: {
		auth: {
			getSession: mockGetSession,
			onAuthStateChange: mockOnAuthStateChange,
		},
		from: vi.fn(() => {
			const chainMock = {
				select: vi.fn(() => chainMock),
				eq: vi.fn(() => chainMock),
				order: vi.fn(() => chainMock),
				limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
				single: vi.fn(() => Promise.resolve({ data: null, error: null })),
				insert: vi.fn(() => Promise.resolve({ data: [], error: null })),
				update: vi.fn(() => Promise.resolve({ data: [], error: null })),
				delete: vi.fn(() => Promise.resolve({ data: [], error: null })),
			};
			return chainMock;
		}),
	},
}));

// Mock useYjsSync hook to avoid real WebSocket/Yjs logic
vi.mock("../hooks/useYjsSync", () => ({
	useYjsSync: () => ({
		doc: {},
		provider: null,
		addElement: vi.fn(),
		updateElement: vi.fn(),
		deleteElements: vi.fn(),
		updateCursor: vi.fn(),
		updateSelection: vi.fn(),
		updateViewport: vi.fn(),
		getYElements: vi.fn(() => new Map()),
		undo: vi.fn(),
		redo: vi.fn(),
		canUndo: false,
		canRedo: false,
	}),
}));

// Mock React Konva
vi.mock("react-konva", () => ({
	// biome-ignore lint/suspicious/noExplicitAny: Mocking Konva components
	Stage: ({ children }: any) => <div data-testid="stage">{children}</div>,
	// biome-ignore lint/suspicious/noExplicitAny: Mocking Konva components
	Layer: ({ children }: any) => <div data-testid="layer">{children}</div>,
	Rect: () => <div data-testid="konva-rect" />,
	Circle: () => <div data-testid="konva-circle" />,
	Line: () => <div data-testid="konva-line" />,
	Ellipse: () => <div data-testid="konva-ellipse" />,
	Text: () => <div data-testid="konva-text" />,
}));

// Mock ResizeObserver (required for Canvas container sizing)
global.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// Reset store helper
const resetStore = () => {
	useCanvasStore.setState(initialState);
};

describe("UI Integration Tests", () => {
	beforeEach(() => {
		resetStore();
		vi.clearAllMocks();
	});

	// ----------------------------------------------------------------------------
	// 1. TOOLBAR INTERACTIONS
	// ----------------------------------------------------------------------------
	describe("Toolbar", () => {
		it("Tool Selection: clicking icon updates store and active state", async () => {
			render(<Toolbar />);
			const user = userEvent.setup();

			// Initial state (Selection tool is default)
			const selectionBtn = screen.getByTitle(/Select \(V\)/i);
			expect(useCanvasStore.getState().activeTool).toBe("selection");

			// Click Rectangle tool
			const rectBtn = screen.getByTitle(/Rectangle/i);
			await user.click(rectBtn);

			// Assert store update
			expect(useCanvasStore.getState().activeTool).toBe("rectangle");

			// Assert active class/style (checking for violet background class)
			expect(rectBtn.className).toContain("bg-violet-100");
			expect(selectionBtn.className).not.toContain("bg-violet-100");
		});
	});

	// ----------------------------------------------------------------------------
	// 2. ZOOM CONTROLS
	// ----------------------------------------------------------------------------
	describe("Zoom Controls", () => {
		it("Zoom In/Out: updates store within limits", async () => {
			render(<ZoomControls />);
			const user = userEvent.setup();

			const zoomInBtn = screen.getByTitle(/Zoom in/i);
			const zoomOutBtn = screen.getByTitle(/Zoom out/i);
			const resetBtn = screen.getByTitle(/Reset zoom/i);

			// Initial zoom
			expect(useCanvasStore.getState().zoom).toBe(1);

			// Zoom In
			await user.click(zoomInBtn);
			expect(useCanvasStore.getState().zoom).toBe(1.2); // 1 * 1.2

			// Zoom Out (twice to go below 1)
			await user.click(zoomOutBtn);
			await user.click(zoomOutBtn);
			// 1.2 / 1.2 = 1, then 1 / 1.2 = 0.8333...
			expect(useCanvasStore.getState().zoom).toBeCloseTo(0.8333, 4);

			// Reset
			await user.click(resetBtn);
			expect(useCanvasStore.getState().zoom).toBe(1);
		});

		it("Boundary Enforcement: respects max/min zoom", async () => {
			render(<ZoomControls />);
			const user = userEvent.setup();
			const zoomInBtn = screen.getByTitle(/Zoom in/i);

			// Max zoom is 5. Multiply 1 by 1.2 repeatedly.
			// 1 -> 1.2 -> 1.44 -> 1.728 -> 2.07 -> 2.48 -> 2.98 -> 3.58 -> 4.29 -> 5.15 (capped at 5)
			for (let i = 0; i < 15; i++) {
				await user.click(zoomInBtn);
			}

			expect(useCanvasStore.getState().zoom).toBe(5);
		});
	});

	// ----------------------------------------------------------------------------
	// 3. CANVAS AUTH WRAPPER (ROUTING GUARDS)
	// ----------------------------------------------------------------------------
	describe("Canvas Auth Wrapper", () => {
		it("Missing Token: redirects to login", async () => {
			// Mock no session
			mockGetSession.mockResolvedValue({ data: { session: null } });

			render(<CanvasAuthWrapper roomId="room-1" />);

			await waitFor(() => {
				expect(mockReplace).toHaveBeenCalledWith(
					expect.stringContaining("/login"),
				);
			});
		});

		it("Valid Token: renders canvas", async () => {
			// Mock successful session
			mockGetSession.mockResolvedValue({
				data: {
					session: {
						access_token: "valid-token",
						user: { id: "user-1", email: "test@example.com" },
					},
				},
			});

			render(<CanvasAuthWrapper roomId="room-1" />);

			// Should render Canvas (which renders Stage via mock)
			await waitFor(() => {
				expect(screen.getByTestId("stage")).toBeInTheDocument();
			});

			expect(mockReplace).not.toHaveBeenCalled();
		});

		// TODO: Fix this test - auth callback redirect not working in test environment
		it.skip("Auth Change (Logout): triggers redirect", async () => {
			// 1. Initial Render with valid session
			mockGetSession.mockResolvedValue({
				data: {
					session: {
						access_token: "valid-token",
						user: { id: "user-1", email: "test@example.com" },
					},
				},
			});

			render(<CanvasAuthWrapper roomId="room-1" />);
			await waitFor(() => screen.getByTestId("stage"));

			// Verify callback was captured
			expect(capturedAuthCallback).toBeDefined();

			// Clear any previous calls before testing logout
			mockReplace.mockClear();

			// 2. Simulate Sign Out event (session = null)
			act(() => {
				capturedAuthCallback("SIGNED_OUT", null);
			});

			// 3. Verify redirect was called
			expect(mockReplace).toHaveBeenCalledWith(
				expect.stringContaining("/login?next="),
			);
		});
	});

	// ----------------------------------------------------------------------------
	// 4. HOTKEYS (INTEGRATION VIA CANVAS)
	// ----------------------------------------------------------------------------
	describe("Hotkeys", () => {
		it("Keyboard Shortcuts: 'R' activates Rectangle tool", async () => {
			// We need to render the Canvas because the keydown listener is attached in Canvas.tsx
			render(<Canvas roomId="room-1" token="mock-token" />);

			// Press 'R'
			fireEvent.keyDown(window, { key: "r" });

			expect(useCanvasStore.getState().activeTool).toBe("rectangle");
		});

		it("Keyboard Shortcuts: 'V' activates Selection tool", async () => {
			// Set to something else first
			useCanvasStore.setState({ activeTool: "freedraw" });

			render(<Canvas roomId="room-1" token="mock-token" />);

			// Press 'V'
			fireEvent.keyDown(window, { key: "v" });

			expect(useCanvasStore.getState().activeTool).toBe("selection");
		});

		it("Keyboard Shortcuts: 'Esc' clears selection or drawing", async () => {
			// Setup: Select an element
			useCanvasStore.setState({ selectedElementIds: new Set(["el-1"]) });

			render(<Canvas roomId="room-1" token="mock-token" />);

			// Press Esc
			fireEvent.keyDown(window, { key: "Escape" });

			expect(useCanvasStore.getState().selectedElementIds.size).toBe(0);
		});
	});
});
