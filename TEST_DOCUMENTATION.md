# Unit Test Documentation: LekhaFlow  
**Project:** LekhaFlow - Real-time Collaborative Whiteboard  
**Date:** 2026-02-10  
**Status:** DRAFT  
**Author:** QA Engineering Team  

---

## 1. Module Overview

The LekhaFlow testing strategy covers the full stack, ensuring reliability across the frontend interaction layer, real-time synchronization engine, and backend persistence services.

| Module | Component | Description | Test Focus |
| :--- | :--- | :--- | :--- |
| **Frontend** | `apps/web` | Next.js Client, Canvas UI | Geometry math, User interactions, Local state (Zustand). |
| **Sync Engine** | `apps/web` (Hooks) | Yjs, Hocuspocus Provider | CRDT data syncing, Awareness (presence), Conflict resolution. |
| **HTTP API** | `apps/http-backend` | Express REST API | Authentication, Canvas management (CRUD), Input validation. |
| **WS Backend** | `apps/ws-backend` | WebSocket Service | Real-time connection handling, Binary data persistence to Postgres. |
| **Shared** | `@repo/common` | Shared Types/Utils | Zod Schemas, Common Types (Currently covering type definitions). |

---

## 2. Test Environment

The testing architecture utilizes a modern TypeScript-based stack for both unit and integration testing.

*   **Test Runner:** [Vitest](https://vitest.dev/) (Fast, Jest-compatible runner).
*   **Frontend Environment:** `jsdom` (simulating DOM for React components).
*   **Backend Environment:** `node` (v18.x).
*   **API Simulation:** [Supertest](https://github.com/ladjs/supertest) (for Express routes).
*   **Mocking:** `vi.mock` (Vitest native mocking) for Supabase, WebSocket providers, and modules.
*   **Canvas Mocking:** `react-konva` components are mocked to test logic without canvas setup issues.

---

## 3. Test Sections

### 3.1 Geometry & Math (Frontend)
**Source:** `apps/web/test/element-utils.test.ts`

Focuses on the mathematical core of the whiteboard: hit-testing (detecting clicks on shapes) and bounding box calculations.

| Test ID | Feature | Test Case Description | Expected Result |
| :--- | :--- | :--- | :--- |
| **TC-GEO-001** | Hit Testing | Rectangle Hit Test (Inside, Boundary, Outside) | Returns `true` for points inside/on edge (10px threshold), `false` outside. |
| **TC-GEO-002** | Hit Testing | Ellipse Hit Test (Center vs Corner) | Returns `true` for center, `false` for bbox corners outside the oval. |
| **TC-GEO-003** | Hit Testing | Line Buffer Logic | Returns `true` for points within `threshold + strokeWidth/2`. |
| **TC-GEO-004** | Grouping | `getCombinedBounds` for multiple elements | Correctly calculates enclosing box $(min\_x, min\_y)$ to $(max\_x, max\_y)$. |
| **TC-GEO-005** | Normalization | "Flip Logic" (Negative w/h) | Dragging backwards (creating negative width) results in positive bounding box dimensions. |
| **TC-GEO-006** | Rotation | Rotated Bounding Box | 45° rotation of square results in $width = height \approx diagonal$. |
| **TC-GEO-007** | Stability | Zero-dimension element safety | Elements with $width=0$ do not cause NaNs or crashes. |

### 3.2 State & Sync (Frontend)
**Source:** `apps/web/test/canvas-store.test.ts`, `apps/web/test/useYjsSync.test.ts`

Validates local state management (Zustand) and the integration with the Yjs CRDT engine.

| Test ID | Feature | Test Case Description | Expected Result |
| :--- | :--- | :--- | :--- |
| **TC-ST-001** | Tool State | Tool Switching | `activeTool` updates correctly; switching tools auto-clears current selection. |
| **TC-ST-002** | Zoom | Viewport Constraints | Zoom level clamped between `0.1` (min) and `5.0` (max). |
| **TC-ST-003** | CRUD | `addElement` / `deleteElements` | Elements added/removed from `Map` correctly; Immutability maintained on updates. |
| **TC-SYNC-001**| Hydration | Initial Load from Y.Doc | Zustand store populates with existing elements from Yjs document. |
| **TC-SYNC-002**| Remote Sync | Remote Mutation Handling | Remote changes (simulated via Y.Doc transaction) instantly update local Zustand store. |
| **TC-SYNC-003**| Undo/Redo | Local Context | `undo()` reverts local actions. |
| **TC-SYNC-004**| Presence | Collaborator Awareness | User joining triggers update in `collaborators` list (Cursor/Name). |

### 3.3 HTTP API & Security (Backend)
**Source:** `apps/http-backend/src/controller/canvas.test.ts`

Tests the REST endpoints for creating and managing canvases, with a strong focus on security.

| Test ID | Feature | Test Case Description | Expected Result |
| :--- | :--- | :--- | :--- |
| **TC-API-001** | Auth | Missing/Invalid Token (401) | API returns `401 Unauthorized` if `Authorization` header is missing or invalid. |
| **TC-API-002** | Creation | Successful Canvas Creation | Valid payload returns `201 Created` with `roomId` and `slug`. Database `insert` called. |
| **TC-API-003** | Security | Malicious `owner_id` Injection | Payload with `owner_id: "attacker"` is ignored; Backend forces `owner_id` from Auth Token. |
| **TC-API-004** | Routing | Global Error Handling | Unhandled exceptions in controller flow are caught by global error middleware. |

### 3.4 Persistence Logic (WS Backend)
**Source:** `apps/ws-backend/test/database.test.ts`

Validates the logic used to save the Yjs binary document state to the Postgres database.
*> **Note:** This test uses a `simulateStoreFunction` that mirrors the logic in `src/index.ts`. Mirroring ensures logic correctness but requires manual sync with production code.*

| Test ID | Feature | Test Case Description | Expected Result |
| :--- | :--- | :--- | :--- |
| **TC-WS-001** | Formatting | Binary to Hex Conversion | Uint8Array state successfully converted to Postgres `bytea` hex format (`\x...`). |
| **TC-WS-002** | Upsert | New Canvas (Insert) | If canvas does not exist + User ID provided $\rightarrow$ SQL `INSERT`. |
| **TC-WS-003** | Upsert | Existing Canvas (Update) | If canvas exists $\rightarrow$ SQL `UPDATE` (only `data` and `updated_at`, never `owner_id`). |
| **TC-WS-004** | Security | Update Owner Protection | Updating an existing canvas does *not* overwrite the `owner_id` field. |

---

## 4. Data Integrity & Negative Testing

| Category | Test Case | Module | Status |
| :--- | :--- | :--- | :--- |
| **Security** | Injecting `owner_id` in Create Payload | HTTP Backend | **PASS** (Protected by Controller Logic) |
| **Security** | Accessing API without Token | HTTP Backend | **PASS** (Protected by Middleware) |
| **Geometry** | Hit-testing far outside bounds | Frontend | **PASS** (Correctly returns false) |
| **Geometry** | Zero-width/height element bounds | Frontend | **PASS** (Handled gracefully) |
| **Database** | Updating non-existent canvas without UserID | WS Backend | **PASS** (Ignored/No Insert) |

---

## 5. Traceability Matrix

Mapping foundational requirements to implemented test cases.

| Requirement ID | Requirement Description | Test ID(s) |
| :--- | :--- | :--- |
| **REQ-FE-01** | Users must be able to select elements by clicking on them. | TC-GEO-001, TC-GEO-002, TC-GEO-003 |
| **REQ-FE-02** | Zooming must be restricted to usable levels (10% - 500%). | TC-ST-002 |
| **REQ-RT-01** | Changes made by one user must appear for others. | TC-SYNC-002 |
| **REQ-RT-02** | Users must see cursors of other collaborators. | TC-SYNC-004 |
| **REQ-API-01** | Only authenticated users can create canvases. | TC-API-001 |
| **REQ-SEC-01** | Users cannot create resources on behalf of others. | TC-API-003, TC-WS-004 |
| **REQ-DB-01** | Canvas state must be persisted across sessions. | TC-WS-002, TC-WS-003 |

---

## 6. Summary Report

| Module | Total Tests | Passed | Skipped | Pass Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Frontend Logic** (Math/Store/Sync) | 18 | 18 | 0 | **100%** |
| **HTTP Backend** | 4 | 4 | 0 | **100%** |
| **WebSocket Persistence** | 5 | 5 | 0 | **100%** |
| **UI Integration** | 6 | 6 | 0 | **100%** |
| **Shared Packages** | 0 | 0 | 0 | *N/A* |
| **TOTAL** | **33** | **33** | **0** | **100%** |

> **Gap Analysis:**
> *   `@repo/common` validation schemas currently lack explicit unit tests.
> *   The WS Backend tests rely on simulated logic (`simulateStoreFunction`) rather than importing the actual production function. This is a known technical debt item.
