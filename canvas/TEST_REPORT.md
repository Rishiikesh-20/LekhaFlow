# 📋 Digital Canvas — Comprehensive Test Report

> **Total Tests: 236** | **Web (Frontend): 145** | **HTTP Backend: 57** | **WS Backend: 34**
>
> Framework: [Vitest](https://vitest.dev/) · Run: `pnpm test` from monorepo root

---

## Table of Contents

- [Epic 4 — Frontend (Web)](#epic-4--frontend-web)
  - [1. Read-Only Mode](#1-read-only-mode-17-tests)
  - [2. Saving Status](#2-saving-status-16-tests)
  - [3. Viewport Persistence](#3-viewport-persistence-20-tests)
  - [4. Toolbar Lock/Unlock UI](#4-toolbar-lockunlock-ui-14-tests)
  - [5. Header Saving Indicator](#5-header-saving-indicator-12-tests)
- [Frontend — General Tests](#frontend--general-tests)
  - [6. Element Utils Logic](#6-element-utils-logic-33-tests)
  - [7. Canvas Store (Zustand)](#7-canvas-store-zustand-10-tests)
  - [8. UI Integration](#8-ui-integration-9-tests)
  - [9. useYjsSync Hook](#9-useyjs-sync-hook-6-tests)
  - [10. createText Unit Tests](#10-createtext-unit-tests-8-tests)
- [HTTP Backend](#http-backend-57-tests)
  - [11. Auth Routes](#11-auth-routes-18-tests)
  - [12. Canvas — Create](#12-canvas--create-4-tests)
  - [13. Canvas — Extended CRUD](#13-canvas--extended-crud-20-tests)
  - [14. Auth Middleware](#14-auth-middleware-8-tests)
  - [15. Global Error Handler](#15-global-error-handler-7-tests)
- [WS Backend](#ws-backend-34-tests)
  - [16. Authentication & Activity Log](#16-authentication--activity-log-12-tests)
  - [17. Database Fetch & Store](#17-database-fetch--store-16-tests)
  - [18. Database Store (Core)](#18-database-store-core-6-tests)

---

## Epic 4 — Frontend (Web)

All Epic 4 tests live under `apps/web/test/` and validate the features introduced in Epic 4: read-only mode, saving status, viewport persistence, toolbar lock UI, and the saving indicator in the header.

---

### 1. Read-Only Mode (17 tests)

**File:** `apps/web/test/read-only-mode.test.ts`
**Purpose:** Validates the `setReadOnly` action on the Zustand canvas store — toggle behaviour, automatic state cleanup when locking, localStorage persistence per room, and stress testing with rapid toggles.

| #   | Test                                                     | Line                                              | Description                                                                             |
| --- | -------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | defaults to unlocked (`isReadOnly = false`)              | [L51](apps/web/test/read-only-mode.test.ts#L51)   | Asserts the initial store state has `isReadOnly` set to `false`.                        |
| 2   | `setReadOnly(true)` enables read-only mode               | [L55](apps/web/test/read-only-mode.test.ts#L55)   | Calls `setReadOnly(true)` and verifies `isReadOnly` becomes `true`.                     |
| 3   | `setReadOnly(false)` disables read-only mode             | [L60](apps/web/test/read-only-mode.test.ts#L60)   | Enables then disables read-only and verifies final state is `false`.                    |
| 4   | Toggling twice returns to original state                 | [L66](apps/web/test/read-only-mode.test.ts#L66)   | Two toggles; confirms `isReadOnly` is `false` and `activeTool` is `hand` (set on lock). |
| 5   | Forces `activeTool` to `'hand'` when entering read-only  | [L79](apps/web/test/read-only-mode.test.ts#L79)   | Sets tool to `rectangle`, locks canvas, verifies tool changed to `hand`.                |
| 6   | Clears `selectedElementIds` when entering read-only      | [L85](apps/web/test/read-only-mode.test.ts#L85)   | Adds selections, locks, verifies selection set is empty.                                |
| 7   | Resets `isDrawing` when entering read-only               | [L93](apps/web/test/read-only-mode.test.ts#L93)   | Sets `isDrawing: true`, locks, expects `false`.                                         |
| 8   | Resets `isDragging` when entering read-only              | [L99](apps/web/test/read-only-mode.test.ts#L99)   | Sets `isDragging: true`, locks, expects `false`.                                        |
| 9   | Resets `isResizing` when entering read-only              | [L105](apps/web/test/read-only-mode.test.ts#L105) | Sets `isResizing: true`, locks, expects `false`.                                        |
| 10  | Preserves current `activeTool` when unlocking            | [L111](apps/web/test/read-only-mode.test.ts#L111) | After lock→unlock cycle, tool stays as `hand` (not reverted to old tool).               |
| 11  | Does not clear elements on lock                          | [L120](apps/web/test/read-only-mode.test.ts#L120) | Adds 2 elements, locks canvas, verifies elements remain intact.                         |
| 12  | Persists lock state to localStorage when `roomId` is set | [L136](apps/web/test/read-only-mode.test.ts#L136) | Checks `localStorage.setItem` called with key `lekhaflow-lock-room-abc`.                |
| 13  | Persists unlock state to localStorage                    | [L145](apps/web/test/read-only-mode.test.ts#L145) | Lock→unlock; last `setItem` call writes `"false"`.                                      |
| 14  | Does NOT write to localStorage when `roomId` is `null`   | [L155](apps/web/test/read-only-mode.test.ts#L155) | Ensures no `setItem` call when room ID is absent.                                       |
| 15  | Handles localStorage errors gracefully                   | [L162](apps/web/test/read-only-mode.test.ts#L162) | `setItem` throws `QuotaExceededError`; no crash, state still updates.                   |
| 16  | Uses correct key format with room ID                     | [L175](apps/web/test/read-only-mode.test.ts#L175) | Verifies key is `lekhaflow-lock-my-room-123`.                                           |
| 17  | Handles rapid lock/unlock without corruption             | [L189](apps/web/test/read-only-mode.test.ts#L189) | 50 rapid toggles; final state matches expected value.                                   |

---

### 2. Saving Status (16 tests)

**File:** `apps/web/test/saving-status.test.ts`
**Purpose:** Tests the `savingStatus` state machine in the canvas store — all valid transitions (`idle` → `saving` → `saved` / `error`), independence from other state slices, and rapid-fire updates.

| #    | Test                                         | Line                                             | Description                                            |
| ---- | -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| 1    | Defaults to `'idle'`                         | [L22](apps/web/test/saving-status.test.ts#L22)   | Fresh store has `savingStatus === "idle"`.             |
| 2    | Transitions `idle → saving`                  | [L31](apps/web/test/saving-status.test.ts#L31)   | Sets `"saving"`, verifies state.                       |
| 3    | Transitions `saving → saved`                 | [L36](apps/web/test/saving-status.test.ts#L36)   | Sequential transitions checked.                        |
| 4    | Transitions `saving → error`                 | [L42](apps/web/test/saving-status.test.ts#L42)   | Simulates save failure.                                |
| 5    | Transitions `error → saving` (retry)         | [L48](apps/web/test/saving-status.test.ts#L48)   | Retry scenario after error.                            |
| 6    | Transitions `saved → idle`                   | [L54](apps/web/test/saving-status.test.ts#L54)   | Reset after successful save.                           |
| 7    | Transitions `error → idle` (reset)           | [L60](apps/web/test/saving-status.test.ts#L60)   | Reset after error.                                     |
| 8–11 | Accepts all valid status values (parametric) | [L71](apps/web/test/saving-status.test.ts#L71)   | `it.each` over `["idle", "saving", "saved", "error"]`. |
| 12   | Does not affect `activeTool`                 | [L82](apps/web/test/saving-status.test.ts#L82)   | Changes saving status, tool stays `rectangle`.         |
| 13   | Does not affect `elements`                   | [L88](apps/web/test/saving-status.test.ts#L88)   | Elements map unchanged after status update.            |
| 14   | Does not affect `isReadOnly`                 | [L94](apps/web/test/saving-status.test.ts#L94)   | `isReadOnly` stays `true` regardless of saving state.  |
| 15   | Does not affect zoom/scroll                  | [L100](apps/web/test/saving-status.test.ts#L100) | Zoom and scroll values untouched.                      |
| 16   | Handles rapid status changes correctly       | [L113](apps/web/test/saving-status.test.ts#L113) | 6 rapid transitions; final state matches last call.    |

---

### 3. Viewport Persistence (20 tests)

**File:** `apps/web/test/viewport-persistence.test.ts`
**Purpose:** Validates `saveViewport` / `loadViewport` helpers that persist scroll and zoom per room in `localStorage`. Covers round-trip serialisation, corrupt data, numeric edge values, room isolation, and Zustand store integration.

| #   | Test                                                    | Line                                                    | Description                                                 |
| --- | ------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | Saves and loads viewport data correctly                 | [L84](apps/web/test/viewport-persistence.test.ts#L84)   | Round-trip: save {100, 200, 1.5}, load, compare all fields. |
| 2   | Returns `null` for room with no saved data              | [L94](apps/web/test/viewport-persistence.test.ts#L94)   | `loadViewport("nonexistent-room")` returns `null`.          |
| 3   | Uses correct localStorage key format                    | [L98](apps/web/test/viewport-persistence.test.ts#L98)   | Key is `lekhaflow-viewport-my-room-42`.                     |
| 4   | Returns `null` for corrupted JSON                       | [L111](apps/web/test/viewport-persistence.test.ts#L111) | Writes `"not-valid-json{"`, load returns `null`.            |
| 5   | Returns `null` when `scrollX` is missing                | [L118](apps/web/test/viewport-persistence.test.ts#L118) | Partial object without `scrollX` rejected.                  |
| 6   | Returns `null` when zoom is not a number                | [L126](apps/web/test/viewport-persistence.test.ts#L126) | `zoom: "big"` rejected by type check.                       |
| 7   | Returns `null` for empty string                         | [L134](apps/web/test/viewport-persistence.test.ts#L134) | Empty string in storage → `null`.                           |
| 8   | Returns `null` for null value in storage                | [L139](apps/web/test/viewport-persistence.test.ts#L139) | Key not present → `null`.                                   |
| 9   | Saves and loads negative scroll values                  | [L148](apps/web/test/viewport-persistence.test.ts#L148) | `scrollX: -500, scrollY: -300` preserved.                   |
| 10  | Saves and loads zero values                             | [L155](apps/web/test/viewport-persistence.test.ts#L155) | `{0, 0, 0.1}` round-trips.                                  |
| 11  | Saves and loads large scroll values                     | [L163](apps/web/test/viewport-persistence.test.ts#L163) | `{999999, 999999, 5}` round-trips.                          |
| 12  | Handles floating-point zoom values                      | [L173](apps/web/test/viewport-persistence.test.ts#L173) | `1.333333` preserved with `toBeCloseTo`.                    |
| 13  | Different rooms have independent viewport data          | [L186](apps/web/test/viewport-persistence.test.ts#L186) | Room A and B store different values.                        |
| 14  | Overwriting one room does not affect another            | [L197](apps/web/test/viewport-persistence.test.ts#L197) | Overwrite A, check B unchanged.                             |
| 15  | `setScroll` updates store correctly                     | [L215](apps/web/test/viewport-persistence.test.ts#L215) | `setScroll(150, 250)` reflected in state.                   |
| 16  | `setZoom` clamps to min 0.1                             | [L221](apps/web/test/viewport-persistence.test.ts#L221) | `setZoom(0.01)` → `0.1`.                                    |
| 17  | `setZoom` clamps to max 5                               | [L226](apps/web/test/viewport-persistence.test.ts#L226) | `setZoom(100)` → `5`.                                       |
| 18  | `resetViewport` restores defaults                       | [L231](apps/web/test/viewport-persistence.test.ts#L231) | Scroll and zoom return to `{0, 0, 1}`.                      |
| 19  | `saveViewport` does not throw when localStorage is full | [L244](apps/web/test/viewport-persistence.test.ts#L244) | `QuotaExceededError` swallowed silently.                    |
| 20  | `loadViewport` does not throw when `getItem` throws     | [L253](apps/web/test/viewport-persistence.test.ts#L253) | `SecurityError` swallowed; returns `null`.                  |

---

### 4. Toolbar Lock/Unlock UI (14 tests)

**File:** `apps/web/test/toolbar-lock.test.tsx`
**Purpose:** React component tests for the `<Toolbar />` using `@testing-library/react`. Validates lock button icon, disabled states for drawing tools when canvas is locked, active-tool visual styling, and total button count.

| #   | Test                                                 | Line                                             | Description                                                            |
| --- | ---------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| 1   | Shows Unlock icon when canvas is unlocked            | [L58](apps/web/test/toolbar-lock.test.tsx#L58)   | Renders `<Toolbar />`, checks `icon-Unlock` testid present.            |
| 2   | Shows Lock icon when canvas is locked                | [L65](apps/web/test/toolbar-lock.test.tsx#L65)   | Sets `isReadOnly: true`, checks `icon-Lock` testid.                    |
| 3   | Toggles lock state when lock button is clicked       | [L71](apps/web/test/toolbar-lock.test.tsx#L71)   | Click lock button → `isReadOnly` becomes `true`.                       |
| 4   | Toggles back to unlocked on second click             | [L78](apps/web/test/toolbar-lock.test.tsx#L78)   | Two clicks; re-renders between; final state `false`.                   |
| 5   | Displays correct title when locked                   | [L91](apps/web/test/toolbar-lock.test.tsx#L91)   | `title="Unlock Canvas (L)"` present.                                   |
| 6   | Displays correct title when unlocked                 | [L97](apps/web/test/toolbar-lock.test.tsx#L97)   | `title="Lock Canvas (L)"` present.                                     |
| 7   | Disables drawing tools when locked                   | [L106](apps/web/test/toolbar-lock.test.tsx#L106) | Hand tool enabled; all others implicitly disabled.                     |
| 8   | Marks non-hand tools as disabled when locked         | [L117](apps/web/test/toolbar-lock.test.tsx#L117) | Rectangle and Pencil buttons have `disabled` attribute + title suffix. |
| 9   | Enables all tools when unlocked                      | [L129](apps/web/test/toolbar-lock.test.tsx#L129) | `isReadOnly: false`; Rectangle & Pencil not disabled.                  |
| 10  | Clicking disabled tool does NOT change `activeTool`  | [L139](apps/web/test/toolbar-lock.test.tsx#L139) | Click on disabled Rectangle; `activeTool` stays `hand`.                |
| 11  | Select tool is also disabled when locked             | [L149](apps/web/test/toolbar-lock.test.tsx#L149) | `"Select (V) — Canvas is locked"` button is disabled.                  |
| 12  | Shows active styling for selected tool when unlocked | [L160](apps/web/test/toolbar-lock.test.tsx#L160) | `bg-violet-100` class on active Rectangle button.                      |
| 13  | Does NOT show active styling when locked             | [L169](apps/web/test/toolbar-lock.test.tsx#L169) | Disabled Rectangle has `opacity-50`, no `bg-violet-100`.               |
| 14  | Renders exactly 12 buttons (1 lock + 11 tools)       | [L185](apps/web/test/toolbar-lock.test.tsx#L185) | `getAllByRole("button").length === 12`.                                |

---

### 5. Header Saving Indicator (12 tests)

**File:** `apps/web/test/header-saving-indicator.test.tsx`
**Purpose:** Component tests for `<SavingStatusIndicator />` exported from the Header module. Tests render output per status value, correct Lucide icon mapping, transition re-renders, and Tailwind text colour classes.

| #   | Test                                                  | Line                                                        | Description                                 |
| --- | ----------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| 1   | Renders nothing for `'idle'` status                   | [L104](apps/web/test/header-saving-indicator.test.tsx#L104) | Container `innerHTML` is empty.             |
| 2   | Renders "Saving…" for `'saving'` status               | [L110](apps/web/test/header-saving-indicator.test.tsx#L110) | Text "Saving..." present in DOM.            |
| 3   | Renders "Saved" for `'saved'` status                  | [L116](apps/web/test/header-saving-indicator.test.tsx#L116) | Text "Saved" present.                       |
| 4   | Renders "Save failed" for `'error'` status            | [L122](apps/web/test/header-saving-indicator.test.tsx#L122) | Text "Save failed" present.                 |
| 5   | Shows `Loader2` icon for `'saving'`                   | [L133](apps/web/test/header-saving-indicator.test.tsx#L133) | `icon-Loader2` testid present.              |
| 6   | Shows `Cloud` icon for `'saved'`                      | [L139](apps/web/test/header-saving-indicator.test.tsx#L139) | `icon-Cloud` testid present.                |
| 7   | Shows `CloudOff` icon for `'error'`                   | [L145](apps/web/test/header-saving-indicator.test.tsx#L145) | `icon-CloudOff` testid present.             |
| 8   | Updates text when status transitions `saving → saved` | [L155](apps/web/test/header-saving-indicator.test.tsx#L155) | Re-render; "Saving..." replaced by "Saved". |
| 9   | Disappears when transitioning to idle                 | [L164](apps/web/test/header-saving-indicator.test.tsx#L164) | `saved → idle`; container empties.          |
| 10  | Uses amber for `'saving'`                             | [L178](apps/web/test/header-saving-indicator.test.tsx#L178) | `text-amber-600` class on "Saving..." span. |
| 11  | Uses green for `'saved'`                              | [L185](apps/web/test/header-saving-indicator.test.tsx#L185) | `text-green-600` class on "Saved" span.     |
| 12  | Uses red for `'error'`                                | [L192](apps/web/test/header-saving-indicator.test.tsx#L192) | `text-red-600` class on "Save failed" span. |

---

## Frontend — General Tests

These tests cover core canvas utilities, store behaviour, integration tests with rendered components, the Yjs synchronisation hook, and the `createText` factory function.

---

### 6. Element Utils Logic (33 tests)

**File:** `apps/web/test/element-utils.test.ts`
**Purpose:** Pure-logic unit tests for hit-testing (`isPointInElement`), bounding box computation (`getElementBounds`, `getCombinedBounds`), rotation transforms (`getRotatedBoundingBox`), and resize handle positions. Uses parametric `it.each` for shape-specific hit-testing.

| #     | Section                              | Line                                             | Description                                                                             |
| ----- | ------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1–10  | Rectangle hit-testing (parametric)   | [L24](apps/web/test/element-utils.test.ts#L24)   | `it.each` for points inside, on boundary (10 px threshold), and outside a 100×100 rect. |
| 11–16 | Ellipse hit-testing (parametric)     | [L47](apps/web/test/element-utils.test.ts#L47)   | Center, edge, threshold, and bounding-box corners outside ellipse arc.                  |
| 17–25 | Line buffer hit-testing (parametric) | [L66](apps/web/test/element-utils.test.ts#L66)   | Horizontal line; tests on-line, within threshold (≤ 11 px), start/end, beyond.          |
| 26–27 | Text bounding box hit-testing        | [L84](apps/web/test/element-utils.test.ts#L84)   | Hit inside estimated bbox; miss far outside.                                            |
| 28    | Multi-element combined bounds        | [L99](apps/web/test/element-utils.test.ts#L99)   | Two rects at (0,0) and (100,100); combined bounds 110×110.                              |
| 29    | Zero-dimension safety                | [L115](apps/web/test/element-utils.test.ts#L115) | 0×0 rect; no `NaN`, rotation safe.                                                      |
| 30    | Negative resize normalisation        | [L133](apps/web/test/element-utils.test.ts#L133) | Rect with `width: -100`; bounding box returns positive dimensions via `Math.abs`.       |
| 31    | 45° rotated bounding box accuracy    | [L168](apps/web/test/element-utils.test.ts#L168) | 100×100 rect at 45°; bbox ≈ 141.42 × 141.42 (diagonal).                                 |
| 32–33 | Resize handles positions             | [L179](apps/web/test/element-utils.test.ts#L179) | NW at (0,0), SE at (100,100).                                                           |

---

### 7. Canvas Store (Zustand) (10 tests)

**File:** `apps/web/test/canvas-store.test.ts`
**Purpose:** Direct state management tests on the Zustand `useCanvasStore` — tool switching, auto-clearing selection, zoom constraints, element CRUD, bulk operations, and stable selector references.

| #   | Test                                     | Line                                            | Description                                             |
| --- | ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| 1   | `activeTool` updates correctly           | [L14](apps/web/test/canvas-store.test.ts#L14)   | Switch `selection → rectangle → hand`.                  |
| 2   | Switching tools clears selection         | [L25](apps/web/test/canvas-store.test.ts#L25)   | Select element, switch to `freedraw`, selection empty.  |
| 3   | Zoom/Pan updates with constraints        | [L41](apps/web/test/canvas-store.test.ts#L41)   | `setScroll`, `setZoom` min (0.1) / max (5) clamping.    |
| 4   | `addElement` adds element to map         | [L57](apps/web/test/canvas-store.test.ts#L57)   | Create rectangle, `addElement`, check `elements.get()`. |
| 5   | `updateElement` updates without mutation | [L66](apps/web/test/canvas-store.test.ts#L66)   | Change `strokeColor`, other props untouched.            |
| 6   | `deleteElements` removes correct ID      | [L82](apps/web/test/canvas-store.test.ts#L82)   | Delete one of two elements; verify correct one removed. |
| 7   | `selectAll` populates `selectedIds`      | [L97](apps/web/test/canvas-store.test.ts#L97)   | Add 2 elements, `selectAll()`, both IDs in set.         |
| 8   | Group deletion deletes multiple IDs      | [L112](apps/web/test/canvas-store.test.ts#L112) | Delete 2 of 3 elements in one call.                     |
| 9   | Group movement via `updateElement`       | [L126](apps/web/test/canvas-store.test.ts#L126) | Shift two elements by +10,+10 using `forEach`.          |
| 10  | Stable selector references               | [L152](apps/web/test/canvas-store.test.ts#L152) | `getState()` returns same reference when unchanged.     |

---

### 8. UI Integration (9 tests)

**File:** `apps/web/test/ui-integration.test.tsx`
**Purpose:** Integration tests that render real React components (`<Toolbar />`, `<ZoomControls />`, `<CanvasAuthWrapper />`, `<Canvas />`) with mocked Next.js navigation, Supabase auth, Yjs, and React Konva. Validates user interactions end-to-end.

| #   | Test                                            | Line                                               | Description                                                     |
| --- | ----------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Clicking tool icon updates store & active style | [L95](apps/web/test/ui-integration.test.tsx#L95)   | Click Rectangle → store updates; `bg-violet-100` class applied. |
| 2   | Zoom In/Out/Reset within limits                 | [L115](apps/web/test/ui-integration.test.tsx#L115) | Click zoom in, out twice, reset; values verified.               |
| 3   | Max zoom boundary enforcement                   | [L134](apps/web/test/ui-integration.test.tsx#L134) | 15 zoom-in clicks; capped at `5`.                               |
| 4   | Missing session → redirect to `/login`          | [L150](apps/web/test/ui-integration.test.tsx#L150) | No auth session; `router.replace("/login")` called.             |
| 5   | Valid session → renders canvas (Stage)          | [L160](apps/web/test/ui-integration.test.tsx#L160) | Mock session; `stage` testid appears, no redirect.              |
| 6   | Auth change (logout) → triggers redirect        | [L179](apps/web/test/ui-integration.test.tsx#L179) | Simulate `SIGNED_OUT` event; redirect to `/login`.              |
| 7   | Hotkey `R` activates Rectangle tool             | [L207](apps/web/test/ui-integration.test.tsx#L207) | `keyDown("r")` on `window`; store `activeTool === "rectangle"`. |
| 8   | Hotkey `V` activates Selection tool             | [L215](apps/web/test/ui-integration.test.tsx#L215) | Start on `freedraw`, press `V`, tool switches.                  |
| 9   | Hotkey `Esc` clears selection                   | [L225](apps/web/test/ui-integration.test.tsx#L225) | Pre-select element, press `Escape`, selection cleared.          |

---

### 9. useYjsSync Hook (6 tests)

**File:** `apps/web/test/useYjsSync.test.ts`
**Purpose:** Tests the `useYjsSync` React hook using `renderHook` from Testing Library. Covers Y.Doc → Zustand hydration, remote mutation propagation, undo/redo via `UndoManager`, and awareness-based collaborator list updates. Uses a mock `HocuspocusProvider`.

| #   | Test                                             | Line                                          | Description                                                                                |
| --- | ------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Store Seeding: loads Y.Doc elements into Zustand | [L69](apps/web/test/useYjsSync.test.ts#L69)   | Transact a rectangle into Y.Map; Zustand `elements` map updates.                           |
| 2   | Type Safety: handles valid data structure        | [L93](apps/web/test/useYjsSync.test.ts#L93)   | Verify `x`, `y`, `width`, `height` are correct types.                                      |
| 3   | External change updates local store              | [L108](apps/web/test/useYjsSync.test.ts#L108) | Remote sets `x: 999` via doc transact; Zustand reflects.                                   |
| 4   | Conflict resolution: consistent state with Yjs   | [L127](apps/web/test/useYjsSync.test.ts#L127) | Remote overwrites `strokeColor`; Zustand stays in sync.                                    |
| 5   | Undo reverts local addition                      | [L143](apps/web/test/useYjsSync.test.ts#L143) | `addElement`, `canUndo === true`, `undo()`, element gone.                                  |
| 6   | User join updates collaborators list             | [L167](apps/web/test/useYjsSync.test.ts#L167) | Capture awareness `"change"` handler; invoke with remote state; collaborators map updated. |

---

### 10. createText Unit Tests (8 tests)

**File:** `apps/web/lib/element-utils.test.ts`
**Purpose:** Unit tests for the `createText` factory function in the element utilities module. Validates defaults, custom overrides, width estimation, multi-line height, unique ID generation, and special character handling.

| #   | Test                                     | Line                                          | Description                                                                                 |
| --- | ---------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Creates text with default options        | [L9](apps/web/lib/element-utils.test.ts#L9)   | Verify `type`, `x`, `y`, `text`, `fontSize: 20`, `fontFamily: 1`, `textAlign: "left"`, etc. |
| 2   | Creates text with custom options         | [L26](apps/web/lib/element-utils.test.ts#L26) | `fontSize: 24`, `textAlign: "center"`, `strokeColor`, `opacity` overridden.                 |
| 3   | Estimates width based on text length     | [L42](apps/web/lib/element-utils.test.ts#L42) | Longer string → larger `width`.                                                             |
| 4   | Multi-line text → taller height          | [L49](apps/web/lib/element-utils.test.ts#L49) | `"Line 1\nLine 2\nLine 3"` has greater `height` than single line.                           |
| 5   | Generates unique IDs                     | [L55](apps/web/lib/element-utils.test.ts#L55) | Two calls produce different `id` values.                                                    |
| 6   | Default stroke and fill properties exist | [L63](apps/web/lib/element-utils.test.ts#L63) | `opacity` and `strokeColor` are defined.                                                    |
| 7   | Empty text handled                       | [L70](apps/web/lib/element-utils.test.ts#L70) | `text: ""`, `originalText: ""`.                                                             |
| 8   | Special characters preserved             | [L77](apps/web/lib/element-utils.test.ts#L77) | Emoji and symbols `"Hello 🎨 World! @#$%"` stored verbatim.                                 |

---

## HTTP Backend (57 tests)

All HTTP backend tests live under `apps/http-backend/src/`. They use **supertest** to make real HTTP requests against an Express app instance with mocked Supabase clients.

---

### 11. Auth Routes (18 tests)

**File:** `apps/http-backend/src/controller/auth.test.ts`
**Purpose:** End-to-end route tests for the four auth endpoints: `POST /signup`, `POST /signin`, `GET /me`, and `POST /sync-user`. Validates input validation (email format, password length, empty body), Supabase error forwarding, token handling, and DB fallback for `/me`.

#### POST /api/v1/auth/signup (7 tests)

| #   | Test                                       | Line                                                       | Description                              |
| --- | ------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------- |
| 1   | Returns 400 if email is missing            | [L53](apps/http-backend/src/controller/auth.test.ts#L53)   | Body with `password` + `name` only.      |
| 2   | Returns 400 if email is invalid            | [L61](apps/http-backend/src/controller/auth.test.ts#L61)   | `email: "not-an-email"` rejected.        |
| 3   | Returns 400 if password is too short (< 6) | [L68](apps/http-backend/src/controller/auth.test.ts#L68)   | `password: "123"` rejected.              |
| 4   | Returns 400 if name is empty               | [L75](apps/http-backend/src/controller/auth.test.ts#L75)   | `name: ""` rejected.                     |
| 5   | Returns 400 if body is empty               | [L82](apps/http-backend/src/controller/auth.test.ts#L82)   | Empty `{}` body.                         |
| 6   | Returns 201 on successful signup           | [L87](apps/http-backend/src/controller/auth.test.ts#L87)   | Mock `signUp` success; verify `user.id`. |
| 7   | Returns 400 when supabase returns an error | [L107](apps/http-backend/src/controller/auth.test.ts#L107) | `"User already exists"` error forwarded. |

#### POST /api/v1/auth/signin (5 tests)

| #   | Test                                        | Line                                                       | Description                                     |
| --- | ------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| 8   | Returns 400 if email is missing             | [L126](apps/http-backend/src/controller/auth.test.ts#L126) | Only password in body.                          |
| 9   | Returns 400 if password is too short        | [L133](apps/http-backend/src/controller/auth.test.ts#L133) | `password: "12"`.                               |
| 10  | Returns 400 if body is completely empty     | [L140](apps/http-backend/src/controller/auth.test.ts#L140) | `{}` body.                                      |
| 11  | Returns 200 with token on valid credentials | [L145](apps/http-backend/src/controller/auth.test.ts#L145) | Mock `signInWithPassword`; verify `data.token`. |
| 12  | Returns 401 on invalid credentials          | [L164](apps/http-backend/src/controller/auth.test.ts#L164) | Supabase returns `"Invalid credentials"`.       |

#### GET /api/v1/auth/me (4 tests)

| #   | Test                                            | Line                                                       | Description                                                          |
| --- | ----------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| 13  | Returns 401 without Authorization header        | [L184](apps/http-backend/src/controller/auth.test.ts#L184) | No header → 401.                                                     |
| 14  | Returns 401 with invalid token                  | [L189](apps/http-backend/src/controller/auth.test.ts#L189) | `getUser` returns error.                                             |
| 15  | Returns user profile when DB has the user       | [L204](apps/http-backend/src/controller/auth.test.ts#L204) | Full chain: `getUser` → `from("users").select().eq().maybeSingle()`. |
| 16  | Returns fallback user data when DB has no entry | [L238](apps/http-backend/src/controller/auth.test.ts#L238) | `maybeSingle` returns `null`; response uses `user_metadata`.         |

#### POST /api/v1/auth/sync-user (2 tests)

| #   | Test                                     | Line                                                       | Description                                   |
| --- | ---------------------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| 17  | Returns 401 without auth header          | [L274](apps/http-backend/src/controller/auth.test.ts#L274) | No token → 401.                               |
| 18  | Returns 200 and upserted user on success | [L279](apps/http-backend/src/controller/auth.test.ts#L279) | Upsert chain mocked; verify response user ID. |

---

### 12. Canvas — Create (4 tests)

**File:** `apps/http-backend/src/controller/canvas.test.ts`
**Purpose:** Original tests for the `POST /create-canvas` route, covering unauthorized access, successful creation, and an owner_id injection security check.

| #   | Test                                                         | Line                                                         | Description                                                            |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1   | Returns 401 when no Authorization header                     | [L34](apps/http-backend/src/controller/canvas.test.ts#L34)   | No header; `createServiceClient` not called.                           |
| 2   | Returns 401 when token is invalid                            | [L44](apps/http-backend/src/controller/canvas.test.ts#L44)   | `getUser` returns error.                                               |
| 3   | Creates canvas and returns 201 with valid token              | [L62](apps/http-backend/src/controller/canvas.test.ts#L62)   | Full mock chain; verify `roomId`, `slug`, insert args.                 |
| 4   | Ignores malicious `owner_id` and uses authenticated `userId` | [L114](apps/http-backend/src/controller/canvas.test.ts#L114) | Body includes `owner_id: "attacker_id"`; insert uses authenticated ID. |

---

### 13. Canvas — Extended CRUD (20 tests)

**File:** `apps/http-backend/src/controller/canvas-extended.test.ts`
**Purpose:** Extended edge-case tests for all canvas routes (`GET /canvas`, `GET /canvas/:roomId`, `PUT /canvas/:roomId`, `DELETE /canvas/:roomId`, `POST /create-canvas`). Mocks the service layer directly (not Supabase) to avoid module-level `createServiceClient()` caching issues.

#### GET /api/v1/canvas — List canvases (4 tests)

| #   | Test                                     | Line                                                                  | Description                                |
| --- | ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Returns 401 without auth header          | [L82](apps/http-backend/src/controller/canvas-extended.test.ts#L82)   | No Authorization header.                   |
| 2   | Returns empty array when no canvases     | [L87](apps/http-backend/src/controller/canvas-extended.test.ts#L87)   | Service returns `[]`.                      |
| 3   | Returns canvases list                    | [L97](apps/http-backend/src/controller/canvas-extended.test.ts#L97)   | Service returns 2 canvases.                |
| 4   | Passes authenticated `userId` to service | [L111](apps/http-backend/src/controller/canvas-extended.test.ts#L111) | Verifies `getCanvasesService("user-abc")`. |

#### GET /api/v1/canvas/:roomId — Get single canvas (4 tests)

| #   | Test                                   | Line                                                                  | Description                       |
| --- | -------------------------------------- | --------------------------------------------------------------------- | --------------------------------- |
| 5   | Returns 401 without auth               | [L125](apps/http-backend/src/controller/canvas-extended.test.ts#L125) | No token.                         |
| 6   | Returns 404 when canvas does not exist | [L130](apps/http-backend/src/controller/canvas-extended.test.ts#L130) | Service returns `null`.           |
| 7   | Returns canvas data when found         | [L141](apps/http-backend/src/controller/canvas-extended.test.ts#L141) | Verifies response body structure. |
| 8   | Passes `roomId` param to service       | [L157](apps/http-backend/src/controller/canvas-extended.test.ts#L157) | `getCanvasService("my-room")`.    |

#### PUT /api/v1/canvas/:roomId — Update canvas (6 tests)

| #   | Test                                             | Line                                                                  | Description                                      |
| --- | ------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------ |
| 9   | Returns 401 without auth                         | [L171](apps/http-backend/src/controller/canvas-extended.test.ts#L171) | No token.                                        |
| 10  | Returns 400 if name exceeds max length (50)      | [L178](apps/http-backend/src/controller/canvas-extended.test.ts#L178) | 51-char name rejected.                           |
| 11  | Returns 400 if name is empty string              | [L188](apps/http-backend/src/controller/canvas-extended.test.ts#L188) | `""` rejected.                                   |
| 12  | Returns 200 on valid name update                 | [L197](apps/http-backend/src/controller/canvas-extended.test.ts#L197) | Successful update, message contains "updated".   |
| 13  | Calls `updateCanvasService` with correct args    | [L206](apps/http-backend/src/controller/canvas-extended.test.ts#L206) | Verifies roomId, body, userId passed to service. |
| 14  | Accepts optional fields: `data`, `thumbnail_url` | [L218](apps/http-backend/src/controller/canvas-extended.test.ts#L218) | 200 returned with extra fields in body.          |

#### DELETE /api/v1/canvas/:roomId — Soft delete (3 tests)

| #   | Test                                                  | Line                                                                  | Description                                    |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| 15  | Returns 401 without auth                              | [L234](apps/http-backend/src/controller/canvas-extended.test.ts#L234) | No token.                                      |
| 16  | Returns 200 on successful soft delete                 | [L239](apps/http-backend/src/controller/canvas-extended.test.ts#L239) | Message contains "deleted".                    |
| 17  | Calls `deleteCanvasService` with userId for ownership | [L249](apps/http-backend/src/controller/canvas-extended.test.ts#L249) | `deleteCanvasService("room-abc", "user-xyz")`. |

#### POST /api/v1/canvas/create-canvas — Extra validation (3 tests)

| #   | Test                                           | Line                                                                  | Description                        |
| --- | ---------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| 18  | Returns 400 if name is missing                 | [L266](apps/http-backend/src/controller/canvas-extended.test.ts#L266) | Body has only `isPublic`.          |
| 19  | Returns 400 if name exceeds 50 characters      | [L276](apps/http-backend/src/controller/canvas-extended.test.ts#L276) | 51 `X` characters.                 |
| 20  | Defaults `isPublic` to false when not provided | [L286](apps/http-backend/src/controller/canvas-extended.test.ts#L286) | Only `name` in body; 201 returned. |

---

### 14. Auth Middleware (8 tests)

**File:** `apps/http-backend/src/middleware/auth.test.ts`
**Purpose:** Unit tests for the Express `authMiddleware` function. Tests call the middleware directly with mock `req`/`res`/`next` objects, verifying `HttpError` creation with correct status codes, token extraction logic, and edge cases.

| #   | Test                                                | Line                                                       | Description                                                                  |
| --- | --------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | 401 when Authorization header is missing            | [L44](apps/http-backend/src/middleware/auth.test.ts#L44)   | No headers → `next(HttpError{401})`.                                         |
| 2   | 401 for empty Authorization header                  | [L53](apps/http-backend/src/middleware/auth.test.ts#L53)   | `authorization: ""` (falsy).                                                 |
| 3   | 401 when token is invalid                           | [L63](apps/http-backend/src/middleware/auth.test.ts#L63)   | `getUser` returns error → 401 with "Invalid or Expired Token".               |
| 4   | 401 when `getUser` returns `user=null` and no error | [L81](apps/http-backend/src/middleware/auth.test.ts#L81)   | Edge case: null user without explicit error.                                 |
| 5   | Sets `req.user` and calls `next()` on valid token   | [L95](apps/http-backend/src/middleware/auth.test.ts#L95)   | Successful auth; `next()` called with no args; `req.user.id === "user-999"`. |
| 6   | Extracts only the token after `"Bearer "`           | [L119](apps/http-backend/src/middleware/auth.test.ts#L119) | `getUser` receives `"my-actual-token"` (not full header).                    |
| 7   | Handles malformed `"Bearer"` without token          | [L135](apps/http-backend/src/middleware/auth.test.ts#L135) | `"Bearer"` (no space/token) → `getUser(undefined)` → 401.                    |
| 8   | Handles `getUser` throwing an exception             | [L150](apps/http-backend/src/middleware/auth.test.ts#L150) | `mockRejectedValue(Error)` → `next(error)`.                                  |

---

### 15. Global Error Handler (7 tests)

**File:** `apps/http-backend/src/error/error.test.ts`
**Purpose:** Tests the Express global error handler middleware. Validates correct HTTP status codes for `HttpError` instances (404, 400, 401), generic `Error` → 500 mapping, error detail suppression for security, and consistent `{success: false}` response shape.

| #   | Test                                              | Line                                                 | Description                                                     |
| --- | ------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Returns correct status code for `HttpError` (404) | [L28](apps/http-backend/src/error/error.test.ts#L28) | `HttpError("Not Found", 404)` → `res.status(404)`.              |
| 2   | Returns 400 for `BAD_REQUEST`                     | [L38](apps/http-backend/src/error/error.test.ts#L38) | Status 400 verified.                                            |
| 3   | Returns 401 for `UNAUTHORIZED`                    | [L45](apps/http-backend/src/error/error.test.ts#L45) | Status 401 verified.                                            |
| 4   | Returns 500 for generic `Error`                   | [L52](apps/http-backend/src/error/error.test.ts#L52) | Non-`HttpError` → 500 + `"Internal Server Error"`.              |
| 5   | Does not leak error details for generic errors    | [L61](apps/http-backend/src/error/error.test.ts#L61) | `"secret database credentials"` not in response body.           |
| 6   | Returns `success: false` in all error responses   | [L71](apps/http-backend/src/error/error.test.ts#L71) | Verify response body shape for `FORBIDDEN`.                     |
| 7   | Handles `HttpError` with custom message           | [L82](apps/http-backend/src/error/error.test.ts#L82) | `"Validation Failed: email is required"` preserved in response. |

---

## WS Backend (34 tests)

All WS backend tests live under `apps/ws-backend/test/`. They test the WebSocket server's authentication flow, database fetch/store logic, and hex encoding by simulating the actual business logic extracted from the Hocuspocus server hooks.

---

### 16. Authentication & Activity Log (12 tests)

**File:** `apps/ws-backend/test/auth.test.ts`
**Purpose:** Tests the `onAuthenticate` handler logic — JWT token validation via Supabase `getUser`, activity log deduplication (no duplicate "accessed" entries within 1 hour), graceful handling of logging failures, and return value format.

#### Token Validation (6 tests)

| #   | Test                                                   | Line                                           | Description                                        |
| --- | ------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------- |
| 1   | Throws when token is `null`                            | [L111](apps/ws-backend/test/auth.test.ts#L111) | `"Unauthorized: No token provided"`.               |
| 2   | Throws when token is empty string                      | [L121](apps/ws-backend/test/auth.test.ts#L121) | Empty string is falsy → same error.                |
| 3   | Throws when supabase returns auth error                | [L131](apps/ws-backend/test/auth.test.ts#L131) | `Token expired` → `"Unauthorized: Invalid token"`. |
| 4   | Throws when supabase returns `null` user without error | [L141](apps/ws-backend/test/auth.test.ts#L141) | Edge case: `user: null, error: null`.              |
| 5   | Returns user object on valid authentication            | [L150](apps/ws-backend/test/auth.test.ts#L150) | Verify `{id, email}` in response.                  |
| 6   | Passes the token to supabase `getUser`                 | [L161](apps/ws-backend/test/auth.test.ts#L161) | `getUserMock` called with `"my-jwt-token"`.        |

#### Activity Log Deduplication (4 tests)

| #   | Test                                               | Line                                           | Description                                                        |
| --- | -------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| 7   | Inserts activity log when no recent entry exists   | [L175](apps/ws-backend/test/auth.test.ts#L175) | `existingLog: null` → `insert()` called with `action: "accessed"`. |
| 8   | Does NOT insert when recent entry exists           | [L189](apps/ws-backend/test/auth.test.ts#L189) | `existingLog: {id: "..."}` → `insert()` not called.                |
| 9   | Does not fail auth if log insert fails             | [L201](apps/ws-backend/test/auth.test.ts#L201) | `logInsertError` set; auth still returns user.                     |
| 10  | Queries `activity_logs` table with correct filters | [L214](apps/ws-backend/test/auth.test.ts#L214) | `from("activity_logs")` called.                                    |

#### Return Value (2 tests)

| #   | Test                                | Line                                           | Description                                |
| --- | ----------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| 11  | Returns `{user: {id, email}}`       | [L230](apps/ws-backend/test/auth.test.ts#L230) | Exact shape verified with `toEqual`.       |
| 12  | Handles user with `undefined` email | [L241](apps/ws-backend/test/auth.test.ts#L241) | `email` not required; `id` still returned. |

---

### 17. Database Fetch & Store (16 tests)

**File:** `apps/ws-backend/test/store-fetch.test.ts`
**Purpose:** Tests the Hocuspocus `fetch` and `store` callback logic. The fetch path covers hex string decoding (`\x` prefix handling), null/empty data, `Uint8Array` passthrough, and large payloads. The store path covers null/invalid state skipping, hex encoding, auto-naming, and conditional create vs. update.

#### Database Fetch (10 tests)

| #   | Test                                                 | Line                                                  | Description                                      |
| --- | ---------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| 1   | Returns `null` when no canvas row exists             | [L87](apps/ws-backend/test/store-fetch.test.ts#L87)   | `data: null` from DB.                            |
| 2   | Returns `null` on database error                     | [L92](apps/ws-backend/test/store-fetch.test.ts#L92)   | `error: {message: "Connection refused"}`.        |
| 3   | Decodes hex string with `\x` prefix correctly        | [L102](apps/ws-backend/test/store-fetch.test.ts#L102) | `"\\x0102abcd"` → `Uint8Array [1, 2, 171, 205]`. |
| 4   | Decodes hex string without `\x` prefix               | [L112](apps/ws-backend/test/store-fetch.test.ts#L112) | `"0102abcd"` → same result.                      |
| 5   | Decodes empty hex string (just `\x` prefix)          | [L122](apps/ws-backend/test/store-fetch.test.ts#L122) | `"\\x"` → empty `Uint8Array`.                    |
| 6   | Returns non-null for invalid hex (Buffer lenient)    | [L132](apps/ws-backend/test/store-fetch.test.ts#L132) | `Buffer.from` is lenient with partial hex.       |
| 7   | Returns `null` when data field is `null`             | [L145](apps/ws-backend/test/store-fetch.test.ts#L145) | Canvas exists, `data: null`.                     |
| 8   | Returns `null` when data is empty string             | [L153](apps/ws-backend/test/store-fetch.test.ts#L153) | Falsy empty string.                              |
| 9   | Returns `Uint8Array` if data is already `Uint8Array` | [L162](apps/ws-backend/test/store-fetch.test.ts#L162) | Passthrough without conversion.                  |
| 10  | Handles large hex strings (1 KB)                     | [L175](apps/ws-backend/test/store-fetch.test.ts#L175) | 1024-byte payload round-trip.                    |

#### Database Store — Extended (6 tests)

| #   | Test                                              | Line                                                  | Description                                                 |
| --- | ------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| 11  | Skips save when state is `null`                   | [L215](apps/ws-backend/test/store-fetch.test.ts#L215) | `from()` not called.                                        |
| 12  | Skips save when state is not a `Uint8Array`       | [L221](apps/ws-backend/test/store-fetch.test.ts#L221) | String cast to `Uint8Array` → `skipped: true`.              |
| 13  | Correctly formats single-byte payload as hex      | [L229](apps/ws-backend/test/store-fetch.test.ts#L229) | `[0xff]` → `"\\xff"`.                                       |
| 14  | Generates correct name for new canvas             | [L238](apps/ws-backend/test/store-fetch.test.ts#L238) | `"Canvas abcdefgh"` (first 8 chars of `documentName`).      |
| 15  | Does not create canvas when `userId` is undefined | [L249](apps/ws-backend/test/store-fetch.test.ts#L249) | No userId + no existing canvas → neither insert nor update. |
| 16  | Empty `Uint8Array` produces empty hex (`\x`)      | [L258](apps/ws-backend/test/store-fetch.test.ts#L258) | `[]` → `"\\x"`.                                             |

---

### 18. Database Store — Core (6 tests)

**File:** `apps/ws-backend/test/database.test.ts`
**Purpose:** Original store-function tests that verify the check-then-insert/update (upsert) pattern, hex encoding correctness, ownership integrity, and insert-vs-update branching logic.

| #   | Test                                                                 | Line                                               | Description                                                               |
| --- | -------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Calls `update()` when canvas already exists                          | [L93](apps/ws-backend/test/database.test.ts#L93)   | `selectData: {id: "..."}` → `updateMock` called; `insertMock` not called. |
| 2   | Converts binary payload to hex format                                | [L113](apps/ws-backend/test/database.test.ts#L113) | `[0x01, 0x02, 0xab, 0xcd]` → `"\\x0102abcd"`.                             |
| 3   | Calls `insert()` when canvas does not exist and `userId` is provided | [L129](apps/ws-backend/test/database.test.ts#L129) | `selectData: null` → `insert()` with `id`, `owner_id`, `name`, `data`.    |
| 4   | Does NOT call `insert()` when no `userId`                            | [L153](apps/ws-backend/test/database.test.ts#L153) | `userId: undefined` → no insert/update.                                   |
| 5   | Uses upsert pattern (select-before-write)                            | [L170](apps/ws-backend/test/database.test.ts#L170) | `selectMock` invocation order precedes `insertMock`.                      |
| 6   | Updates existing canvas without changing `owner_id`                  | [L191](apps/ws-backend/test/database.test.ts#L191) | `updateMock` payload has `data` + `updated_at`, no `owner_id`.            |

---

## Test Infrastructure

| Item                       | Detail                                                   |
| -------------------------- | -------------------------------------------------------- |
| **Runner**                 | [Vitest](https://vitest.dev/) v2.x                       |
| **Monorepo orchestration** | Turborepo — `turbo run test`                             |
| **Root script**            | `pnpm test` → `turbo run test`                           |
| **Web environment**        | `happy-dom` (jsdom alternative)                          |
| **HTTP Backend**           | `node` environment + `supertest`                         |
| **WS Backend**             | `node` environment                                       |
| **React testing**          | `@testing-library/react` + `@testing-library/user-event` |
| **Mocking**                | `vi.mock()` for modules, `vi.fn()` for functions         |
| **Coverage**               | Available via `vitest run --coverage` per package        |

### Running Tests

```bash
# All tests (from monorepo root)
pnpm test

# Individual packages
cd apps/web && pnpm test
cd apps/http-backend && pnpm test
cd apps/ws-backend && pnpm test
```

---

## 📊 Full Backlog Status — All Epics

> **✅ Done** = Implemented + tested | **🟡 Partial** = Some sub-stories done, gaps remain | **❌ Not Started** = No code exists
>
> **Tested** column indicates whether dedicated test coverage exists.

---

### Epic 1 — Canvas Creation & Management

| Story                             | Sub-stories | Status         | Tested | What's Done                                                                                                           | What's Missing                                                               |
| --------------------------------- | ----------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **1.1** Create New Canvas         | 1.1.1–1.1.5 | ✅ Done        | ✅ Yes | Schema, `POST /create-canvas` endpoint, `createCanvasService`, Dashboard modal UI, auth + Zod validation              | —                                                                            |
| **1.2** Name Canvas               | 1.2.1–1.2.5 | ✅ Done        | ✅ Yes | `PUT /canvas/:roomId` endpoint, editable `<input>` in Header.tsx, on-blur save, store update                          | Debounce (saves on blur, not debounced keystrokes)                           |
| **1.3** Canvas Size & Background  | 1.3.1–1.3.4 | 🟡 Partial     | ❌ No  | Infinite canvas with zoom/pan, dot-grid background via CSS `radial-gradient`                                          | No canvas-level background **color picker** UI (only element fill exists)    |
| **1.4** View All Canvases         | 1.4.1–1.4.5 | ✅ Done        | ✅ Yes | `GET /canvas` list endpoint, Dashboard page with grid/list views, canvas cards with thumbnails + dates + shared badge | —                                                                            |
| **1.5** Canvas Preview Thumbnails | 1.5.1–1.5.5 | 🟡 Partial     | ❌ No  | Auto-capture via `stage.toDataURL()`, base64 stored in `thumbnail_url` column, displayed on dashboard cards           | No Supabase storage bucket — uses inline base64 in DB                        |
| **1.6** Duplicate Canvas          | 1.6.1–1.6.4 | ❌ Not Started | ❌ No  | —                                                                                                                     | No duplicate endpoint, no deep copy, no action menu, no optimistic UI        |
| **1.7** Delete Canvas             | 1.7.1–1.7.4 | ✅ Done        | ✅ Yes | `DELETE /canvas/:roomId` soft-delete (`is_deleted`), delete button on cards, optimistic removal from local state      | —                                                                            |
| **1.8** Archive Canvas            | 1.8.1–1.8.4 | ❌ Not Started | ❌ No  | —                                                                                                                     | No `is_archived` schema, no toggle endpoint, no filter, no archive read-only |

---

### Epic 2 — Drawing and Creative Tools

| Story                              | Sub-stories | Status         | Tested | What's Done                                                                                                                                | What's Missing                                                          |
| ---------------------------------- | ----------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| **2.1** Freehand Pen & Eraser      | 2.1.1–2.1.4 | ✅ Done        | ✅ Yes | `perfect-freehand` integration, Konva `<Line>` rendering, eraser with continuous drag deletion, Ramer-Douglas-Peucker point simplification | —                                                                       |
| **2.2** Basic Shape Drawing        | 2.2.1–2.2.4 | ✅ Done        | ✅ Yes | Shape factory (`createRectangle`, `createEllipse`), diamond shape, Shift for aspect-ratio lock, Alt for center scaling                     | —                                                                       |
| **2.3** Text Tool                  | 2.3.1–2.3.4 | ✅ Done        | ✅ Yes | `<textarea>` overlay, Konva `<Text>` rendering, Y.js-backed add/update, auto-resize container, double-click edit                           | —                                                                       |
| **2.4** Stroke Customization       | 2.4.1–2.4.4 | ✅ Done        | ✅ Yes | Stroke width/color/style/opacity attributes, PropertiesPanel with swatches + sliders, default memory in store, threshold-based hit testing | —                                                                       |
| **2.5** Brush Styles (rough.js)    | 2.5.1–2.5.3 | ❌ Not Started | ❌ No  | Schema fields `fillStyle: "hachure"                                                                                                        | "cross-hatch"` exist                                                    | No rough.js dependency, no rendering, no style toggle UI |
| **2.6** Fill Tool                  | 2.6.1–2.6.3 | 🟡 Partial     | ❌ No  | Solid fill + `backgroundColor` in PropertiesPanel, opacity slider                                                                          | Hachure/cross-hatch fills not rendered (needs rough.js)                 |
| **2.7** Live Ghost Stroke Previews | 2.7.1–2.7.3 | ✅ Done        | ❌ No  | `currentElement` renders dashed preview during draw, no Yjs round-trip, commit on mouseUp                                                  | —                                                                       |
| **2.8** Multi-Object Selection     | 2.8.1–2.8.4 | 🟡 Partial     | ✅ Yes | `getCombinedBounds`, ResizeHandles with 8 handles, Ctrl+A select-all, bulk delete                                                          | No marquee drag-to-select, no multi-element move, no custom Transformer |

---

### Epic 3 — Real-Time Team Collaboration & Presence

| Story                                     | Status         | Tested | What's Done                                                                                                   | What's Missing                                             |
| ----------------------------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **3.1** Live Presence & Remote Cursors    | ✅ Done        | ✅ Yes | Yjs awareness, `CollaboratorCursors.tsx` with SVG cursor + name labels, connection status badge, avatar stack | —                                                          |
| **3.2** Secure Workspace Invitation Links | 🟡 Partial     | ❌ No  | Share modal with copy-link, URL-based room join                                                               | No invitation tokens, no email invites, no role assignment |
| **3.3** Collaborative Laser Pointer       | 🟡 Partial     | ❌ No  | Local `laser` tool with temporary path rendering                                                              | Laser strokes not broadcast to other users via awareness   |
| **3.4** User Mentions & Notifications     | ❌ Not Started | ❌ No  | —                                                                                                             | No mentions system, no notification infrastructure         |
| **3.5** Follow the Leader (Viewport Sync) | ❌ Not Started | ❌ No  | —                                                                                                             | No viewport follow/sync between users                      |
| **3.6** Granular Object Locking           | ❌ Not Started | ❌ No  | `lockedBy` field exists in element types                                                                      | No per-object lock UI or enforcement logic                 |
| **3.7** Room Chat Sidebar                 | ❌ Not Started | ❌ No  | —                                                                                                             | No chat component, no messages in Yjs or DB                |
| **3.8** RBAC Dashboard                    | ❌ Not Started | ❌ No  | —                                                                                                             | No roles table, no permissions system                      |

---

### Epic 4 — Session History and Version Control

| Story                                 | Sub-stories           | Status         | Tested | What's Done                                                                                                                      | What's Missing                                                    |
| ------------------------------------- | --------------------- | -------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **4.1** Auto-Save & State Persistence | 4.1.1–4.1.3 + Backend | ✅ Done        | ✅ Yes | Hocuspocus `Database` extension with debounced store, `SavingStatusIndicator` in Header, client-side saving/saved/error tracking | —                                                                 |
| **4.2** Session Viewport Recovery     | 4.2.1–4.2.2           | ✅ Done        | ✅ Yes | `useViewportPersistence` hook with debounced localStorage writes, hydrate on mount per `roomId`                                  | —                                                                 |
| **4.3** Real-Time Local Undo/Redo     | 4.3.1–4.3.2           | ✅ Done        | ✅ Yes | `Y.UndoManager` on elements map, Undo/Redo buttons in ZoomControls, Ctrl+Z / Ctrl+Shift+Z hotkeys                                | —                                                                 |
| **4.4** Text-Based Activity Log       | 4.4.1–4.4.2           | ❌ Not Started | ❌ No  | `activity_logs` DB table exists; WS backend logs "accessed" events                                                               | No action interceptor for element changes, no toast system, no UI |
| **4.5** Named Version Checkpoints     | 4.5.1–4.5.3           | ❌ Not Started | ❌ No  | `canvas_versions` DB table exists in schema                                                                                      | No snapshot API, no version history sidebar                       |
| **4.6** Read-Only Mode (Lock Canvas)  | 4.6.1–4.6.2           | ✅ Done        | ✅ Yes | `isReadOnly` + `setReadOnly` in store, Lock button in Toolbar, tools disabled, selection cleared, localStorage persistence       | —                                                                 |
| **4.7** Object Blame / Attribution    | 4.7.1–4.7.3           | ❌ Not Started | ❌ No  | —                                                                                                                                | No `createdBy`/`lastModifiedBy` fields, no tracking, no tooltip   |
| **4.8** Restore to Previous Version   | 4.8.1–4.8.2           | ❌ Not Started | ❌ No  | —                                                                                                                                | No restore API, no client re-sync                                 |

---

### Epic 5 — Workspace Organization

| Story                                      | Status         | Tested | What's Done                                        | What's Missing                                  |
| ------------------------------------------ | -------------- | ------ | -------------------------------------------------- | ----------------------------------------------- |
| **5.1** Folder-Based Project Structure     | ❌ Not Started | ❌ No  | `folders` DB table + `folder_id` FK in schema only | No API, no folder management UI                 |
| **5.2** Visual Thumbnails (Canvas Preview) | ✅ Done        | ❌ No  | Same as 1.5 — auto-capture + display on dashboard  | —                                               |
| **5.3** Global Search and Filtering        | ❌ Not Started | ❌ No  | —                                                  | No search input, no filter logic, no search API |
| **5.4** Soft Delete and Trash Recovery     | 🟡 Partial     | ✅ Yes | Soft delete with `is_deleted` column works         | No trash view, no "restore from trash" UI       |
| **5.5** "Recently Viewed" Quick Access     | ❌ Not Started | ❌ No  | `updated_at` column + access logging exist         | No "Recently Viewed" dashboard section          |
| **5.6** Custom Tagging System              | ❌ Not Started | ❌ No  | `tags` + `canvas_tags` junction tables in schema   | No API, no tag UI, no tag filtering             |
| **5.7** Grid vs. List View Toggle          | ✅ Done        | ❌ No  | Toggle in Dashboard.tsx with both layouts          | —                                               |
| **5.8** "Starred" or Favorites             | ❌ Not Started | ❌ No  | —                                                  | No `is_starred` field, no star UI               |

---

### Epic 6 — Smart Features and Assistance

| Story                                        | Status         | Tested | What's Done | What's Missing                                    |
| -------------------------------------------- | -------------- | ------ | ----------- | ------------------------------------------------- |
| **6.1** Contextual Diagram Explanation (Q&A) | ❌ Not Started | ❌ No  | —           | No AI route, no modal, no LLM integration         |
| **6.2** AI-Driven Modification               | ❌ Not Started | ❌ No  | —           | No diff parsing, no NL edit requests              |
| **6.3** Smart Sketch Beautification          | ❌ Not Started | ❌ No  | —           | No shape recognition, no clean replacement        |
| **6.4** Auto-Generation of Documentation     | ❌ Not Started | ❌ No  | —           | No extraction or markdown generation              |
| **6.5** Diagram Intent Classification        | ❌ Not Started | ❌ No  | —           | No type detection, no intent tagging              |
| **6.6** Stroke Smoothing Assistance          | ❌ Not Started | ❌ No  | —           | No curve-fitting beyond built-in perfect-freehand |
| **6.7** Natural Language Canvas Search       | ❌ Not Started | ❌ No  | —           | No semantic embeddings, no NL search              |
| **6.8** "Explain Like I'm New" Mode          | ❌ Not Started | ❌ No  | —           | No explain-mode toggle, no persona config         |

---

### 📈 Overall Progress Summary

| Metric             | Count                                        |
| ------------------ | -------------------------------------------- |
| **Total Stories**  | 48                                           |
| ✅ **Done**        | 17                                           |
| 🟡 **Partial**     | 7                                            |
| ❌ **Not Started** | 24                                           |
| **Completion**     | **35% done · 15% partial · 50% not started** |

| Metric                    | Count          |
| ------------------------- | -------------- |
| **Stories with Tests**    | 13             |
| **Stories without Tests** | 35             |
| **Test Coverage Rate**    | 27% of stories |

| Epic                      | Done   | Partial | Not Started | Total  |
| ------------------------- | ------ | ------- | ----------- | ------ |
| **1 — Canvas Management** | 4      | 2       | 2           | 8      |
| **2 — Drawing Tools**     | 5      | 2       | 1           | 8      |
| **3 — Collaboration**     | 1      | 2       | 5           | 8      |
| **4 — Session History**   | 4      | 0       | 4           | 8      |
| **5 — Workspace Org**     | 2      | 1       | 5           | 8      |
| **6 — Smart/AI**          | 0      | 0       | 8           | 8      |
| **TOTAL**                 | **17** | **7**   | **24**      | **48** |

---

---

## 🏗️ Architecture & Technology Explanations

### HTTP Backend — Architecture & What It Does

The **HTTP Backend** (`apps/http-backend`) is the REST API server that handles all non-realtime operations: authentication, canvas CRUD, and user profile management.

**Tech Stack:**

| Library                   | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| **Express 5.2**           | HTTP server framework (latest major)             |
| **Zod 4**                 | Request body validation with typed schemas       |
| **@supabase/supabase-js** | Database & auth client (PostgreSQL via Supabase) |
| **cors**                  | Cross-Origin Resource Sharing middleware         |
| **http-status-codes**     | Typed HTTP status constants                      |
| **dotenv**                | Environment variable loading                     |
| **supertest** (dev)       | Integration test HTTP assertions                 |
| **vitest** (dev)          | Test runner                                      |

**How It Works:**

1. **Entry Point** (`src/index.ts`) — Creates an Express app on **port 8000**, applies `express.json()` + `cors()`, mounts all routes under `/api/v1`, and registers a global error handler.

2. **Route Structure:**

   ```
   /api/v1
   ├── /auth
   │   ├── POST   /signup       — Create account (email + password)
   │   ├── POST   /signin       — Login (returns httpOnly cookie, 7-day expiry)
   │   ├── GET    /me           — Get current user profile (🔒 auth required)
   │   └── POST   /sync-user    — Upsert Google user data (🔒 auth required)
   └── /canvas
       ├── GET    /             — List owned + shared canvases (🔒)
       ├── GET    /:roomId      — Get single canvas by ID (🔒)
       ├── POST   /create-canvas — Create new canvas with slug (🔒)
       ├── PUT    /:roomId      — Update canvas name/data/thumbnail (🔒)
       └── DELETE /:roomId      — Soft-delete canvas (🔒)
   ```

3. **Auth Middleware** (`src/middleware/auth.ts`) — Extracts the `Bearer` token from the `Authorization` header, calls `supabase.auth.getUser(token)` to validate the JWT, and injects the verified `User` object into `req.user`. Returns `401 Unauthorized` for missing/invalid tokens.

4. **Service Layer** (`src/services/canvas.ts`) — Business logic separated from controllers:
   - `createCanvasService` — Generates a slug from the canvas name (lowercase, spaces → hyphens + timestamp), inserts into `canvases` table.
   - `getCanvasesService` — Fetches canvases you own + canvases you accessed (via `activity_logs` table), returns merged list with owned first.
   - `getCanvasService` — Single canvas by ID (filters `is_deleted = false`).
   - `updateCanvasService` — Updates name/data/thumbnail where `owner_id` matches.
   - `deleteCanvasService` — Soft-delete: sets `is_deleted = true` (not a hard delete).
   - `syncUserService` — Upserts user into `public.users` table from Google metadata.

5. **Global Error Handler** (`src/error/error.ts`) — Catches all thrown errors. `HttpError` instances return their status + message; unknown errors return a generic `500 Internal Server Error` (no internal details leaked).

---

### WS Backend — Architecture & What It Does

The **WS Backend** (`apps/ws-backend`) is the **real-time collaboration server** that keeps all connected users' canvases in sync using Yjs CRDTs over WebSockets.

**Tech Stack:**

| Library                            | Purpose                                           |
| ---------------------------------- | ------------------------------------------------- |
| **@hocuspocus/server 2.14**        | Yjs-aware WebSocket server framework              |
| **@hocuspocus/extension-database** | Persistence adapter (load/save Yjs documents)     |
| **@hocuspocus/extension-logger**   | Console logging for connections & events          |
| **@supabase/supabase-js 2.47**     | Database client for canvas data + auth tokens     |
| **yjs 13.6**                       | CRDT (Conflict-free Replicated Data Type) library |

**How It Works:**

1. **Hocuspocus Server** (`src/index.ts`) — A purpose-built WebSocket server for Yjs real-time collaboration. Every canvas room is a separate Yjs document identified by `documentName` (the room/canvas ID).

2. **Debounced Persistence:**
   - `debounce: 3000` — Waits 3 seconds of idle time before writing to the database (batches rapid edits).
   - `maxDebounce: 10000` — Forces a save every 10 seconds during continuous editing (safety net).

3. **Authentication** (`onAuthenticate`):
   - Extracts the JWT token from the WebSocket handshake.
   - Calls `supabase.auth.getUser(token)` to validate it.
   - On success: logs an "accessed" action to the `activity_logs` table (with **1-hour dedup** — won't re-log if the same user accessed the same canvas within the last hour). This log is non-blocking; failures don't reject the connection.
   - On failure: throws `"Unauthorized"`, rejecting the WebSocket connection.

4. **Database Extension — Fetch** (loading canvas data on connect):
   - Queries `canvases.data` column by the `documentName` (canvas ID).
   - The `data` column is PostgreSQL `bytea` (binary) stored as hex.
   - Decodes: strips the `\x` prefix → `Buffer.from(hex, "hex")` → `Uint8Array` → feeds into Yjs via `Y.applyUpdate()`.
   - Returns `null` for missing or empty canvases (Yjs starts fresh).

5. **Database Extension — Store** (saving canvas data on edit):
   - Uses a **check-then-insert/update** (upsert) pattern:
     - If canvas exists → `UPDATE` the `data` and `updated_at` columns only.
     - If canvas is new and a `userId` is available → `INSERT` with `id`, `data`, `owner_id`, and auto-generated name.
   - Converts `Uint8Array` → hex string with `\\x` prefix for PostgreSQL `bytea`.

6. **Server Start** — Listens on the configurable `WS_PORT` environment variable.

**Key Design Decisions:**

- **Yjs CRDTs** handle conflict resolution automatically — two users editing the same element won't corrupt data.
- **Hocuspocus** acts as the bridge: it manages WebSocket connections, document lifecycle, awareness (cursors/presence), and pluggable persistence.
- **Binary data path**: Yjs document state → `Uint8Array` → hex-encoded `bytea` in PostgreSQL → decoded back on load. This is efficient and preserves the full CRDT state.

---

### Frontend — Tools & Libraries Used

The **Frontend** (`apps/web`) is a Next.js application that provides the canvas drawing interface, real-time collaboration, and dashboard.

**Core Dependencies:**

| Library                               | Version     | Purpose                                                          |
| ------------------------------------- | ----------- | ---------------------------------------------------------------- |
| **Next.js**                           | 16.1        | React framework with App Router, SSR, file-based routing         |
| **React**                             | 19.2        | UI library (latest with concurrent features)                     |
| **Konva** + **react-konva**           | 10 / 19.2   | HTML5 Canvas rendering (shapes, text, images, hit detection)     |
| **Zustand**                           | 5           | Lightweight state management (no providers, minimal boilerplate) |
| **Yjs**                               | 13.6        | CRDT library for conflict-free real-time sync                    |
| **@hocuspocus/provider**              | 2.14        | WebSocket transport for Yjs (connects to WS backend)             |
| **perfect-freehand**                  | 1.2         | Pen/pencil stroke smoothing (pressure-sensitive, natural feel)   |
| **lucide-react**                      | 0.562       | Icon library (toolbar, UI icons)                                 |
| **Three.js** + **@react-three/fiber** | 0.182 / 9.5 | 3D WebGL rendering (used for the Antigravity login animation)    |
| **uuid**                              | 11.1        | Unique ID generation for canvas elements                         |
| **@supabase/supabase-js**             | 2.49        | Auth client for Google OAuth + session management                |
| **@repo/common**                      | workspace   | Shared types (`CanvasElement`, `Tool`, `Point`, etc.)            |
| **@repo/config**                      | workspace   | Shared environment config (`clientEnv`)                          |

**Dev Dependencies:**

| Library                         | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| **Tailwind CSS 4.1**            | Utility-first CSS styling                       |
| **Vitest 4**                    | Fast unit/integration test runner               |
| **happy-dom**                   | Lightweight DOM implementation for tests        |
| **@testing-library/react**      | Component testing utilities                     |
| **@testing-library/user-event** | Simulated user interactions in tests            |
| **@testing-library/jest-dom**   | Custom DOM matchers (`toBeInTheDocument`, etc.) |
| **PostCSS + Autoprefixer**      | CSS processing pipeline                         |

**Frontend Architecture:**

```
apps/web/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing page (→ redirects to /login or /canvas)
│   ├── login/page.tsx      # Google OAuth login page
│   ├── auth/callback/      # OAuth redirect handler
│   ├── canvas/[roomId]/    # Canvas drawing page
│   └── room/              # Room management
├── components/
│   ├── Canvas.tsx          # Main Konva canvas renderer
│   ├── Dashboard.tsx       # Canvas list, grid/list view
│   ├── canvas/             # Canvas sub-components (Toolbar, Header, ZoomControls)
│   └── ui/                 # Reusable UI components
├── hooks/
│   ├── useYjsSync.ts       # Core Yjs sync hook (HocuspocusProvider, undo/redo)
│   └── index.ts            # Hook exports
├── store/
│   └── canvas-store.ts     # Zustand store (elements, tools, viewport, collab)
└── lib/
    ├── element-utils.ts    # Element creation/manipulation logic
    ├── stroke-utils.ts     # Freehand stroke processing
    └── supabase.client.ts  # Supabase client singleton
```

**Data Flow:**

1. User draws/edits → triggers Zustand store action
2. Store action writes to **Yjs shared document** (not React state directly)
3. Yjs broadcasts the update to all connected clients via **HocuspocusProvider** (WebSocket)
4. Yjs observer fires on each client → updates Zustand store → React re-renders
5. Hocuspocus server debounces and persists the Yjs state to PostgreSQL

---

### Epic 4 — What Was Implemented (Session History & Recovery)

Epic 4 focuses on **session persistence and user experience** — making sure work isn't lost and the canvas feels reliable.

#### ✅ 4.1 — Auto-Save with Status Indicator

**What it does:** Automatically saves the canvas to the database as users draw, with a visual indicator showing the save status.

**Implementation:**

- **Server-side:** The Hocuspocus Database extension in the WS backend handles persistence with debounced writes (3s idle / 10s max). No explicit "save" API call needed — it happens transparently as part of the Yjs sync.
- **Client-side:** The `useYjsSync` hook tracks saving status via Hocuspocus events (`stateless` messages). The store exposes `savingStatus: "idle" | "saving" | "saved" | "error"`.
- **UI:** `SavingStatusIndicator` component in the canvas header shows:
  - 🔄 **"Saving…"** — when changes are being written
  - ✅ **"Saved"** — after successful save (auto-fades after a few seconds)
  - ❌ **"Save failed"** — on error

#### ✅ 4.2 — Viewport Recovery (Scroll & Zoom Persistence)

**What it does:** Remembers where you were looking on the canvas (scroll position + zoom level) so it restores when you return.

**Implementation:**

- **`useViewportPersistence` hook** — Listens to `scrollX`, `scrollY`, and `zoom` changes in the Zustand store.
- **Debounced localStorage writes** — Saves viewport state per `roomId` key (e.g., `viewport-abc123`) with a debounce to avoid excessive writes during scrolling.
- **Hydration on mount** — When the canvas page loads, reads the saved viewport from localStorage and applies it to the store.

#### ✅ 4.3 — Undo / Redo

**What it does:** Lets users undo and redo their drawing actions with keyboard shortcuts or buttons.

**Implementation:**

- **Yjs `UndoManager`** — Created on the shared `elements` Y.Map in the `useYjsSync` hook. Tracks all local changes to the Yjs document.
- **Keyboard shortcuts:** `Ctrl+Z` (undo) and `Ctrl+Shift+Z` (redo), registered as global keydown listeners.
- **UI buttons:** Undo/Redo buttons in the `ZoomControls` component, with disabled states when `canUndo`/`canRedo` are false.
- **State tracking:** `canUndo` and `canRedo` boolean states updated via `UndoManager` event listeners (`stack-item-added`, `stack-item-popped`).

#### ✅ 4.6 — Read-Only (Lock) Mode

**What it does:** Allows users to lock the canvas to prevent accidental edits while reviewing.

**Implementation:**

- **Store:** `isReadOnly` boolean + `setReadOnly(value)` action in the Zustand canvas store.
- **Automatic cleanup:** When entering read-only mode, the store automatically clears: `selectedElementIds`, `isDrawing`, `isDragging`, `isResizing`, `resizeHandle`, and `interactionStartPoint`.
- **Tool disabling:** When `isReadOnly` is true, all drawing tools and selection are disabled in the canvas event handlers.
- **UI:** Lock/Unlock button in the `Toolbar` component with a padlock icon.
- **Persistence:** Read-only state is saved to localStorage per room (e.g., `readonly-abc123`), so it remembers across sessions.

#### ❌ 4.4–4.5, 4.7–4.8 — Not Yet Started

| Story | Title                             | Status      |
| ----- | --------------------------------- | ----------- |
| 4.4   | Version Snapshots & Branching     | Not started |
| 4.5   | Session-Replay Timeline           | Not started |
| 4.7   | Revision History (Named Versions) | Not started |
| 4.8   | Auto-Recovery from Crash          | Not started |

---

### Google Auth — How It Works

The application uses **Google OAuth 2.0** via Supabase for authentication. There is no email/password login UI on the frontend — the login page only offers "Continue with Google".

**Flow Diagram:**

```
┌─────────┐     1. Click "Continue with Google"      ┌──────────┐
│  Login   │ ──────────────────────────────────────▶ │  Google  │
│  Page    │                                          │  OAuth   │
│          │ ◀────────────────────────────────────── │  Consent │
└─────────┘     2. Redirect back with auth code       └──────────┘
     │
     │  3. Redirect to /auth/callback?next=/canvas
     ▼
┌─────────────┐   4. supabase.auth.getSession()   ┌──────────┐
│  Auth        │ ───────────────────────────────▶  │ Supabase │
│  Callback    │                                    │ Auth     │
│  Page        │ ◀───────────────────────────────  │ Server   │
└─────────────┘   5. Returns JWT session            └──────────┘
     │
     │  6. POST /api/v1/auth/sync-user (with JWT)
     ▼
┌─────────────┐   7. Upsert user in public.users  ┌──────────┐
│  HTTP        │ ───────────────────────────────▶  │ Supabase │
│  Backend     │                                    │ Database │
└─────────────┘                                     └──────────┘
     │
     │  8. Redirect to /canvas (or ?next= destination)
     ▼
┌─────────────┐
│  Canvas      │
│  Dashboard   │
└─────────────┘
```

**Step-by-Step:**

1. **Login Page** (`apps/web/app/login/page.tsx`):
   - Shows a "Continue with Google" button over an animated particle background (Three.js Antigravity effect).
   - On click: calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: origin + "/auth/callback?next=/canvas" } })`.
   - Supabase redirects the browser to Google's OAuth consent screen.

2. **Google OAuth** — User grants permission. Google redirects back to Supabase, which exchanges the auth code for tokens and redirects to `/auth/callback`.

3. **Auth Callback** (`apps/web/app/auth/callback/page.tsx`):
   - Calls `supabase.auth.getSession()` to obtain the JWT session from the URL hash/params.
   - Retries once if the session isn't immediately available (race condition guard).
   - Calls `POST /api/v1/auth/sync-user` with the Bearer token to sync the Google profile into the `public.users` table.
   - Redirects to the `?next=` destination (defaults to `/`).

4. **User Sync** (HTTP Backend `syncUser` controller):
   - Reads Google metadata from `user_metadata`: `full_name` → name, `picture` → avatar_url.
   - Upserts into `public.users` table (creates on first login, updates on subsequent logins).

5. **Profile Display** (HTTP Backend `getMe` controller):
   - Queries the `public.users` table for the authenticated user.
   - Falls back to `user_metadata.avatar_url` or `user_metadata.picture` for the Google profile picture if not in the users table.

6. **Google Profile Images** (`next.config.js`):
   - Allows `lh3.googleusercontent.com` as a remote image hostname so Next.js `<Image>` can display Google profile pictures.

**Key Points:**

- The frontend **only** supports Google OAuth (no email/password login form).
- The backend **does** have `/signup` and `/signin` endpoints for email/password, but they're not exposed in the UI.
- Session tokens are managed by Supabase's client library (stored in browser localStorage by default).
- The WS backend also validates the same JWT token when opening WebSocket connections for canvas collaboration.

---

> **Last updated:** February 12, 2026 — 236 total tests across 18 test files.



## 1 — Canvas Creation and Management

### 1.1 Create New Canvas

| Task | File(s) | Status |
|------|---------|--------|
| **1.1.1 Schema update** | packages/supabase/src/types.ts — `canvases` table (id, name, slug, owner_id, is_public, data, is_deleted, thumbnail_url, folder_id…) | ✅ Done |
| **1.1.2 Secure create endpoint** | apps/http-backend/src/routes/canvas.ts — `POST /api/v1/canvas` with `authMiddleware`; apps/http-backend/src/controller/canvas.ts — `createCanvas` handler validates via Zod, extracts `userId` from `req.user` | ✅ Done |
| **1.1.3 API Service** | apps/http-backend/src/services/canvas.ts — `createCanvasService()` generates slug, inserts into DB | ✅ Done |
| **1.1.4 Create modal UI** | apps/web/app/page.tsx — `handleCreateCanvas()` sends POST, redirects to `/canvas/:roomId`; apps/web/components/Dashboard.tsx — create canvas button | ✅ Done (inline, no modal) |
| **1.1.5 Security test** | apps/http-backend/src/controller/canvas.test.ts — tests unauthorized access (no header, invalid token), ownership enforcement (ignores malicious `owner_id` in body) | ✅ Done |

### 1.2 Name Canvas

| Task | File(s) | Status |
|------|---------|--------|
| **1.2.1 Migration** | packages/supabase/src/types.ts — `canvases.name` column (string, 1–50 chars) | ✅ Done |
| **1.2.2 Update endpoint** | apps/http-backend/src/routes/canvas.ts — `PUT /api/v1/canvas/:roomId`; apps/http-backend/src/controller/canvas.ts — `updateCanvas`; apps/http-backend/src/services/canvas.ts — `updateCanvasService()` | ✅ Done |
| **1.2.3 Header component** | apps/web/components/canvas/Header.tsx — `Header` component has inline editable canvas name input, PUT on blur | ✅ Done |
| **1.2.4 Debounce logic** | apps/web/components/canvas/Header.tsx — saves on blur (not debounced keystroke-by-keystroke, but on commit) | ✅ Done |
| **1.2.5 Store update** | apps/web/store/canvas-store.ts — no dedicated canvas name field (name stored server-side, fetched in Header) | ⚠️ Partial (name lives in Header local state) |

### 1.3 Canvas Size & Background

| Task | File(s) | Status |
|------|---------|--------|
| **1.3.1 Infinite canvas** | apps/web/components/Canvas.tsx — pan with hand tool, `setScroll`; apps/web/store/canvas-store.ts — `scrollX/scrollY/zoom` state | ✅ Done |
| **1.3.2 Background grid** | apps/web/components/Canvas.tsx — dot-grid background rendered in Konva Stage | ✅ Done |
| **1.3.3 Background color** | apps/web/components/canvas/PropertiesPanel.tsx — Fill/Background color selection; apps/web/store/canvas-store.ts — `currentBackgroundColor` | ✅ Done (per-element, not canvas-wide) |
| **1.3.4 Background picker** | apps/web/components/canvas/PropertiesPanel.tsx — 8 preset colors + transparent swatch picker | ✅ Done |

### 1.4 View All Canvases

| Task | File(s) | Status |
|------|---------|--------|
| **1.4.1 Indexing** | packages/supabase/src/types.ts — canvases table schema with `owner_id`, `is_deleted` filtering | ✅ Done |
| **1.4.2 List endpoint** | apps/http-backend/src/routes/canvas.ts — `GET /api/v1/canvas`; apps/http-backend/src/services/canvas.ts — `getCanvasesService()` merges owned + shared (via `activity_logs`) | ✅ Done |
| **1.4.3 Dashboard page** | apps/web/components/Dashboard.tsx — grid/list toggle, canvas cards, empty state | ✅ Done |
| **1.4.4 Canvas card component** | apps/web/components/Dashboard.tsx — inline canvas card with thumbnail (or grid-pattern fallback), name, "Shared" badge, date, delete button | ✅ Done |
| **1.4.5 Data fetching** | apps/web/components/Dashboard.tsx — `useEffect` → `GET /api/v1/canvas` with auth header; apps/web/app/page.tsx — renders `<Dashboard>` when authenticated | ✅ Done |

### 1.5 Canvas Preview Thumbnails

| Task | File(s) | Status |
|------|---------|--------|
| **1.5.1 Setup bucket** | Not in codebase — thumbnails stored as `thumbnail_url` in packages/supabase/src/types.ts (canvases table column). No Supabase Storage bucket setup code found | ⚠️ Schema only |
| **1.5.2 Capture utility** | Canvas.tsx — debounced thumbnail capture: `stageRef.current.toDataURL()` with 2s debounce | ✅ Done |
| **1.5.3 Save trigger** | Canvas.tsx — auto-triggered on element changes (debounced) | ✅ Done |
| **1.5.4 Upload handler** | Canvas.tsx — `PUT /api/v1/canvas/:roomId` with `{ thumbnail_url: dataURL }`; apps/http-backend/src/services/canvas.ts — `updateCanvasService()` persists `thumbnail_url` | ✅ Done (base64 inline, not bucket) |
| **1.5.5 Display** | apps/web/components/Dashboard.tsx — thumbnail `<img>` on canvas cards, grid-pattern SVG fallback | ✅ Done |

### 1.6 Duplicate Canvas

| Task | File(s) | Status |
|------|---------|--------|
| **1.6.1 Duplicate endpoint** | Not implemented — no duplicate endpoint in apps/http-backend/src/routes/canvas.ts | ❌ Missing |
| **1.6.2 Deep copy** | Not implemented | ❌ Missing |
| **1.6.3 Action menu** | Not implemented | ❌ Missing |
| **1.6.4 Optimistic UI** | Not implemented | ❌ Missing |

### 1.7 Delete Canvas

| Task | File(s) | Status |
|------|---------|--------|
| **1.7.1 Soft delete** | apps/http-backend/src/services/canvas.ts — `deleteCanvasService()` sets `is_deleted=true, deleted_at=now()`; packages/supabase/src/types.ts — `is_deleted`, `deleted_at` columns | ✅ Done |
| **1.7.2 Archive endpoint** | apps/http-backend/src/routes/canvas.ts — `DELETE /api/v1/canvas/:roomId`; apps/http-backend/src/controller/canvas.ts — `deleteCanvas` | ✅ Done |
| **1.7.3 Delete action** | apps/web/components/Dashboard.tsx — delete button on canvas card, confirm dialog, `DELETE` fetch | ✅ Done |
| **1.7.4 Cache update** | apps/web/components/Dashboard.tsx — `setCanvases(prev => prev.filter(...))` after successful delete (optimistic-ish) | ✅ Done |

### 1.8 Archive Canvas

| Task | File(s) | Status |
|------|---------|--------|
| **1.8.1 Schema** | packages/supabase/src/types.ts — `is_deleted` + `deleted_at` columns (reused for archive pattern) | ⚠️ Partial (uses soft-delete as archive) |
| **1.8.2 Toggle archive** | Not implemented — no toggle (only one-way soft delete) | ❌ Missing |
| **1.8.3 Archive filter** | apps/http-backend/src/services/canvas.ts — `getCanvasesService()` filters `is_deleted = false` | ⚠️ Partial (filters out but no "view archived") |
| **1.8.4 Read-only mode** | apps/web/store/canvas-store.ts — `isReadOnly` state + `setReadOnly()`; apps/web/components/Canvas.tsx — blocks drawing/editing in read-only; apps/web/components/canvas/Toolbar.tsx — disables tools when locked | ✅ Done (general read-only, not archive-specific) |

---

## 2 — Drawing and Creative Tools

### 2.1 Freehand Pen & Eraser Tool

| Task | File(s) | Status |
|------|---------|--------|
| **2.1.1 Perfect Freehand Integration** | apps/web/lib/stroke-utils.ts — `getStrokeOutline()` wraps `perfect-freehand`'s `getStroke()`, `getStrokeOptions()`, `getSvgPathFromStroke()` | ✅ Done |
| **2.1.2 Konva Line Rendering** | Canvas.tsx — `renderElement` case `"freedraw"`: renders as Konva `<Path>` (perfect-freehand SVG) with dashed/dotted variants falling back to `<Line>` | ✅ Done |
| **2.1.3 Eraser Logic** | apps/web/components/Canvas.tsx — eraser tool uses `isErasingRef`, `erasedElementsRef`, hit-tests during mouse move, calls `deleteElements()` on intersecting elements | ✅ Done |
| **2.1.4 Point Simplification** | apps/web/lib/stroke-utils.ts — `simplifyPath()` (Ramer-Douglas-Peucker algorithm), `simplifyByDistance()`; apps/web/components/Canvas.tsx — used in `handleMouseUp` for freedraw | ✅ Done |

### 2.2 Basic Shape Drawing

| Task | File(s) | Status |
|------|---------|--------|
| **2.2.1 Shape Factory** | apps/web/lib/element-utils.ts — `createBaseElement()`, `createRectangle()`, `createEllipse()`, `createDiamond()`, `createShape()` factory with type dispatch | ✅ Done |
| **2.2.2 Diamond Shape** | apps/web/lib/element-utils.ts — `createDiamond()`; apps/web/components/Canvas.tsx — `renderElement` case `"diamond"` (closed `<Line>` polygon) | ✅ Done |
| **2.2.3 Aspect Ratio Lock (Shift)** | apps/web/lib/element-utils.ts — `createShape()` `modifiers.shift` → forces equal width/height; apps/web/components/Canvas.tsx — `shiftPressed` state tracked via keydown/keyup | ✅ Done |
| **2.2.4 Center Scaling (Alt)** | apps/web/lib/element-utils.ts — `createShape()` `modifiers.alt` → draws from center; apps/web/components/Canvas.tsx — `altPressed` state tracked | ✅ Done |

### 2.3 Text Tool

| Task | File(s) | Status |
|------|---------|--------|
| **2.3.1 Input Overlay** | apps/web/components/Canvas.tsx — inline `<textarea>` overlay positioned at canvas coordinates, `editingText` local state, `textareaRef` | ✅ Done |
| **2.3.2 Konva Text Rendering** | apps/web/components/Canvas.tsx — `renderElement` case `"text"` → Konva `<Text>` with fontSize, fontFamily, alignment | ✅ Done |
| **2.3.3 Yjs Text Synchronization** | apps/web/hooks/useYjsSync.ts — `addElement()` / `updateElement()` transact text elements same as any other type via `Y.Map<CanvasElement>` | ✅ Done |
| **2.3.4 Auto-Resize Text Container** | apps/web/lib/element-utils.ts — `createText()` estimates dimensions from `fontSize * lineCount * charWidth`; apps/web/components/Canvas.tsx — textarea resizes on input | ✅ Done |

### 2.4 Stroke Customization

| Task | File(s) | Status |
|------|---------|--------|
| **2.4.1 Stroke Attributes** | packages/common/src/canvas.types.ts — `ExcalidrawElementBase` has `strokeColor`, `strokeWidth`, `strokeStyle` (`StrokeStyle = "solid" \| "dashed" \| "dotted"`) | ✅ Done |
| **2.4.2 Properties Panel** | apps/web/components/canvas/PropertiesPanel.tsx — Stroke color (8 presets), width (1/2/4/6px), line style (solid/dashed/dotted with SVG previews), opacity slider | ✅ Done |
| **2.4.3 Default Properties Memory** | apps/web/store/canvas-store.ts — `currentStrokeColor`, `currentStrokeWidth`, `currentStrokeStyle`, `currentOpacity` persisted in store, applied to new elements | ✅ Done |
| **2.4.4 Hit Testing for Thin Lines** | apps/web/lib/element-utils.ts — `hitTestLine()`, `hitTestArrow()` with `hitThreshold` (7px min); apps/web/components/Canvas.tsx — `hitStrokeWidth={Math.max(element.strokeWidth, 10)}` | ✅ Done |

### 2.5 Brush Styles

| Task | File(s) | Status |
|------|---------|--------|
| **2.5.1 Rough.js Integration** | packages/common/src/canvas.types.ts — `roughness` and `seed` fields defined on elements | ⚠️ Schema only (no rough.js rendering) |
| **2.5.2 Style Toggle** | Not implemented — no UI toggle for rough/clean styles | ❌ Missing |
| **2.5.3 Custom Konva Shape** | Not implemented — no rough.js Konva renderer | ❌ Missing |

### 2.6 Fill Tool

| Task | File(s) | Status |
|------|---------|--------|
| **2.6.1 Fill Schema** | packages/common/src/canvas.types.ts — `backgroundColor`, `fillStyle` (`FillStyle = "solid" \| "hachure" \| "cross-hatch" \| "dots"`) | ✅ Done |
| **2.6.2 Color Picker Integration** | apps/web/components/canvas/PropertiesPanel.tsx — Fill/Background section with 8 color presets + transparent | ✅ Done |
| **2.6.3 Opacity Support** | apps/web/components/canvas/PropertiesPanel.tsx — Opacity slider (10–100%); apps/web/components/Canvas.tsx — `opacity: element.opacity / 100` in `commonProps` | ✅ Done |

### 2.7 Live Ghost Stroke Previews

| Task | File(s) | Status |
|------|---------|--------|
| **2.7.1 Provisional Layer** | apps/web/components/Canvas.tsx — `drawingElement` local state, rendered with `isPreview=true` (dashed outline) alongside committed elements in same `<Layer>` | ✅ Done |
| **2.7.2 Lag-Free Visual Feedback** | apps/web/components/Canvas.tsx — `handleMouseMove` updates `drawingElement` on every move event; `renderElement(..., true)` gives dashed preview style | ✅ Done |
| **2.7.3 Commit on Mouse Release** | apps/web/components/Canvas.tsx — `handleMouseUp`: finalizes `drawingElement`, normalizes dimensions, assigns zIndex, calls `addElement()`, clears drawing state | ✅ Done |

### 2.8 Multi-Object Selection & Manipulation

| Task | File(s) | Status |
|------|---------|--------|
| **2.8.1 Selection Bounding Box** | apps/web/lib/element-utils.ts — `getElementBounds()`, `getSelectionBounds()`, `getElementsInSelectionBox()` (bounds intersection) | ✅ Done |
| **2.8.2 Custom Transformer** | apps/web/components/canvas/ResizeHandles.tsx — 8-handle resize UI; apps/web/components/canvas/RotationControls.tsx — rotation handle + 90° snap | ✅ Done |
| **2.8.3 Bulk Move** | apps/web/components/Canvas.tsx — `handleElementDragEnd` updates position; `draggable={isDraggable}` on all elements when selection tool is active | ✅ Done |
| **2.8.4 Bulk Delete** | apps/web/components/Canvas.tsx — keyboard `Delete`/`Backspace` → `deleteElements(Array.from(selectedElementIds))`; apps/web/hooks/useYjsSync.ts — `deleteElements()` soft-deletes all IDs in one Y.Doc transaction | ✅ Done |

---

## 3 — Real-Time Team Collaboration & Presence

| Story | File(s) | Status |
|-------|---------|--------|
| **3.1 Live Presence & Remote Cursors** | apps/web/hooks/useYjsSync.ts — awareness observer maps remote states to `Collaborator` objects; `updateCursor()` broadcasts local cursor; apps/web/components/canvas/CollaboratorCursors.tsx — SVG arrow cursors with name labels; apps/web/components/canvas/ConnectionStatus.tsx — collaborator count + mini avatars | ✅ Done |
| **3.2 Secure Workspace Invitation Links** | apps/web/components/canvas/Header.tsx — `ShareSection` generates shareable link from `window.location`, copy-to-clipboard; apps/ws-backend/src/index.ts — `onAuthenticate` validates JWT for room access | ✅ Done (link sharing, not invite system) |
| **3.3 Collaborative Laser Pointer** | apps/web/components/Canvas.tsx — laser tool (`"laser"`) with `laserPointsRef`, renders temporary Konva `<Path>`, clears on mouse up; apps/web/components/canvas/Toolbar.tsx — laser tool button (K) | ✅ Done (local only, not broadcast to other users) |
| **3.4 User Mentions & Notifications** | Not implemented | ❌ Missing |
| **3.5 Follow the Leader (Viewport Sync)** | Not implemented | ❌ Missing |
| **3.6 Granular Object Locking** | packages/common/src/canvas.types.ts — `locked` field on `ExcalidrawElementBase`; apps/web/store/canvas-store.ts — canvas-wide `isReadOnly` mode | ⚠️ Partial (global lock only, not per-object) |
| **3.7 Room Chat Sidebar** | Not implemented | ❌ Missing |
| **3.8 RBAC Dashboard** | Not implemented — no roles/permissions system | ❌ Missing |

---

## 4 — Session History and Version Control

### 4.1 Auto-Save and State Persistence

| Task | File(s) | Status |
|------|---------|--------|
| **4.1.1 WebSocket Webhooks for Persistence** | apps/ws-backend/src/index.ts — Hocuspocus `onStoreDocument` hook, triggered by server's debounce config | ✅ Done |
| **4.1.2 Debounced Database Save Logic** | apps/ws-backend/src/index.ts — `debounce: 3000`, `maxDebounce: 10000`; Yjs state → hex `\x` encoding → upsert into `canvases.data` column | ✅ Done |
| **4.1.3 Saving Status UI Indicator** | apps/web/components/canvas/Header.tsx — `SavingIndicator` component (Saving…/Saved/Error with Cloud icons); apps/web/store/canvas-store.ts — `savingStatus` state; apps/web/hooks/useYjsSync.ts — sets saving→saved with 4s timeout | ✅ Done |
| **[Backend] Debounced Save** | apps/ws-backend/src/index.ts — same as 4.1.2 | ✅ Done |

### 4.2 Session Viewport Recovery

| Task | File(s) | Status |
|------|---------|--------|
| **4.2.1 Persist User Viewport** | apps/web/hooks/useViewportPersistence.ts — saves `scrollX/scrollY/zoom` to localStorage keyed by `lekhaflow-viewport-{roomId}`, 500ms debounce via Zustand `subscribeWithSelector` | ✅ Done |
| **4.2.2 Hydrate Camera on Init** | apps/web/hooks/useViewportPersistence.ts — reads from localStorage on mount, calls `setScroll()` + `setZoom()`, guards against hydration-triggered saves via `isHydrated` ref | ✅ Done |

### 4.3 Real-Time Local Undo/Redo

| Task | File(s) | Status |
|------|---------|--------|
| **4.3.1 Initialize Shared Undo Manager** | apps/web/hooks/useYjsSync.ts — `new Y.UndoManager(yElements, { captureTimeout: 500 })`, tracks `canUndo`/`canRedo` via stack events | ✅ Done |
| **4.3.2 Connect Undo/Redo UI and Hotkeys** | apps/web/components/canvas/ZoomControls.tsx — Undo/Redo buttons with disabled state; apps/web/components/Canvas.tsx — `Ctrl+Z` / `Ctrl+Y` hotkeys | ✅ Done |

### 4.4 Text-Based Activity Log

| Task | File(s) | Status |
|------|---------|--------|
| **4.4.1 Action Interceptor Logic** | apps/ws-backend/src/index.ts — `onAuthenticate` logs "accessed" action to `activity_logs` table (with 1-hour dedup) | ⚠️ Partial (only logs "accessed", not drawing actions) |
| **4.4.2 Toast Notification System** | Not implemented — no toast/notification system | ❌ Missing |

### 4.5 Named Version Checkpoints

| Task | File(s) | Status |
|------|---------|--------|
| **4.5.1 Create Versions Database Table** | packages/supabase/src/types.ts — `canvas_versions` table (id, canvas_id, creator_id, name, snapshot, created_at) | ✅ Done (schema only) |
| **4.5.2 Create Manual Snapshot API** | Not implemented — no version API endpoint in apps/http-backend/src/routes/ | ❌ Missing |
| **4.5.3 Build Version History Sidebar UI** | Not implemented | ❌ Missing |

### 4.6 Read-Only Mode (Lock Canvas)

| Task | File(s) | Status |
|------|---------|--------|
| **4.6.1 Read-Only State Management** | apps/web/store/canvas-store.ts — `isReadOnly` state, `setReadOnly()` action (forces hand tool, clears selection, persists to localStorage); Tests: apps/web/test/read-only-mode.test.ts | ✅ Done |
| **4.6.2 Enforce Read-Only in UI** | apps/web/components/canvas/Toolbar.tsx — disables all tools except Hand when locked; apps/web/components/Canvas.tsx — blocks context menu, keyboard shortcuts, mouse handlers in read-only; apps/web/components/canvas/PropertiesPanel.tsx — "Locked" badge | ✅ Done |

### 4.7 Object Blame / Attribution Inspection

| Task | File(s) | Status |
|------|---------|--------|
| **4.7.1 Update Data Model for Attribution** | packages/common/src/canvas.types.ts — `version`, `versionNonce`, `updated`, `created` fields on every element | ⚠️ Partial (no `createdBy` field) |
| **4.7.2 Attribution Tracking Logic** | Not implemented | ❌ Missing |
| **4.7.3 Attribution Tooltip UI** | Not implemented | ❌ Missing |

### 4.8 Restore to Previous Version

| Task | File(s) | Status |
|------|---------|--------|
| **4.8.1 Version Restore API** | Not implemented — `canvas_versions` table exists but no service/endpoint | ❌ Missing |
| **4.8.2 Client Re-sync on Restore** | Not implemented | ❌ Missing |

---

## 5 — Workspace Organization

| Story | File(s) | Status |
|-------|---------|--------|
| **5.1 Folder-Based Project Structure** | packages/supabase/src/types.ts — `folders` table (id, name, owner_id, parent_id self-referential), `canvases.folder_id` FK | ⚠️ Schema only (no UI/endpoints) |
| **5.2 Visual Thumbnails** | See 1.5 above — apps/web/components/Canvas.tsx (capture), apps/web/components/Dashboard.tsx (display) | ✅ Done |
| **5.3 Global Search and Filtering** | Not implemented | ❌ Missing |
| **5.4 Soft Delete and Trash Recovery** | apps/http-backend/src/services/canvas.ts — `deleteCanvasService()` soft-deletes. Recovery/undelete endpoint NOT implemented | ⚠️ Partial (delete only, no recovery) |
| **5.5 "Recently Viewed" Quick Access** | apps/ws-backend/src/index.ts — logs "accessed" action to `activity_logs`; apps/http-backend/src/services/canvas.ts — queries activity_logs for shared canvases. No dedicated "recent" UI | ⚠️ Partial (data tracked, no UI) |
| **5.6 Custom Tagging System** | packages/supabase/src/types.ts — `tags` table + `tags_on_canvases` junction table | ⚠️ Schema only (no UI/endpoints) |
| **5.7 Grid vs List View Toggle** | apps/web/components/Dashboard.tsx — `viewMode` state with grid/list toggle buttons, conditional layout classes | ✅ Done |
| **5.8 "Starred" or Favorites** | Not implemented — no schema or UI | ❌ Missing |

---

## 6 — Smart Features and Assistance

| Story | File(s) | Status |
|-------|---------|--------|
| **6.1 Contextual Diagram Explanation (Q&A)** | Not implemented | ❌ Missing |
| **6.2 AI-Driven Modification** | Not implemented | ❌ Missing |
| **6.3 Smart Sketch Beautification** | Not implemented | ❌ Missing |
| **6.4 Auto-Generation of Documentation** | Not implemented | ❌ Missing |
| **6.5 Diagram Intent Classification** | Not implemented | ❌ Missing |
| **6.6 Stroke Smoothing Assistance** | apps/web/lib/stroke-utils.ts — `simplifyPath()` (RDP algorithm), perfect-freehand pressure simulation. No AI/curve-fitting layer | ⚠️ Partial (algorithmic only) |
| **6.7 Natural Language Canvas Search** | Not implemented | ❌ Missing |
| **6.8 "Explain Like I'm New" Mode** | Not implemented | ❌ Missing |

---

## Additional: Schema Update

The central schema is defined in packages/supabase/src/types.ts (auto-generated from Supabase). It includes **7 tables**:

| Table | File Location | Used By |
|-------|--------------|---------|
| `users` | types.ts | Auth controller, WS backend |
| `canvases` | types.ts | Canvas service, WS backend |
| `folders` | types.ts | ⚠️ Schema only |
| `activity_logs` | types.ts | WS backend (write), canvas service (read) |
| `canvas_versions` | types.ts | ⚠️ Schema only |
| `tags` | types.ts | ⚠️ Schema only |
| `tags_on_canvases` | types.ts | ⚠️ Schema only |

Zod validation schemas in packages/common/src/types.ts: `SignUpSchema`, `SignInSchema`, `CreateCanvasSchema`, `UpdateCanvasSchema`.

Element types in packages/common/src/canvas.types.ts: `CanvasElement` union of 7 element types with full property definitions.

---

## Summary Stats

| Category | Total Tasks | ✅ Done | ⚠️ Partial | ❌ Missing |
|----------|------------|---------|------------|------------|
| 1. Canvas Management | 33 | 24 | 5 | 4 |
| 2. Drawing Tools | 28 | 24 | 1 | 3 |
| 3. Collaboration | 8 | 2 | 2 | 4 |
| 4. History & Versioning | 16 | 9 | 2 | 5 |
| 5. Workspace Organization | 8 | 2 | 4 | 2 |
| 6. Smart Features | 8 | 0 | 1 | 7 |
| **Totals** | **101** | **61** | **15** | **25** |