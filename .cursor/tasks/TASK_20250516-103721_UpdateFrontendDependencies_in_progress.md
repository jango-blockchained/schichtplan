# Task Plan: Update Frontend Dependencies

**Task ID:** TASK_20250516-103721_UpdateFrontendDependencies
**Status:** Pending
**Project:** Schichtplan
**Goal:** Systematically update outdated NPM dependencies in the `src/frontend/package.json` file.

---

## 0. General Guidelines & Prerequisites

*   **Version Control:**
    *   Before starting, ensure your current work is committed.
    *   Create a new Git branch specifically for these dependency updates.
    *   Commit changes frequently after each successful update and testing phase.
*   **Changelogs:** For **ALL MAJOR** version updates, carefully read the official release notes and migration guides from the respective package authors.
*   **Incremental Updates:** Update major dependencies **one at a time** or in very small, related groups to isolate potential issues.
*   **Target Directory:** All `npm-check-updates` and `bun install` commands must target the `src/frontend/` directory.
    *   Use `npx npm-check-updates --prefix src/frontend <options>`
    *   Or `cd src/frontend && npx npm-check-updates <options> && cd ..`
    *   Use `bun install --cwd src/frontend`
    *   Or `cd src/frontend && bun install && cd ..`
*   **Thorough Testing:** After each update (or small batch of updates):
    *   Run the automated test suite (e.g., `bun test --cwd src/frontend`).
    *   Manually test the application in the browser, paying close attention to areas related to the updated package(s).
    *   Check the browser's developer console for any new errors or warnings.

---

## Phase 1: Low-Risk Updates (Patch & Minor Updates)

This phase focuses on updating packages with patch or minor version changes, which are generally safer. These can potentially be batched.

**Working Directory for commands:** `/home/jango/Git/maike2/schichtplan/src/frontend` (or use `--prefix src/frontend` and `--cwd src/frontend` from root)

1.  **Update Radix UI Components & Lucide React Icons**
    *   Packages: `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-primitive`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `@radix-ui/react-tooltip`, `lucide-react`.
    *   Command: `npx npm-check-updates -u @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-context-menu @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-hover-card @radix-ui/react-label @radix-ui/react-menubar @radix-ui/react-navigation-menu @radix-ui/react-popover @radix-ui/react-primitive @radix-ui/react-progress @radix-ui/react-radio-group @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-tooltip lucide-react`
    *   Install: `bun install`
    *   Test & Commit. (DONE - 20250516-103721: Radix UI & Lucide React updated and installed via ncu and bun install. Manual testing and commit by user pending.)

2.  **Update Data Fetching & State Management**
    *   Package: `@tanstack/react-query`
    *   Command: `npx npm-check-updates -u @tanstack/react-query`
    *   Install: `bun install`
    *   Test & Commit. (DONE - 20250516-103721: @tanstack/react-query updated to ^5.76.1 and installed. Manual testing and commit by user pending.)

3.  **Update TypeScript & Core Build Tooling**
    *   Packages: `typescript` (patch), `@vitejs/plugin-react`, `autoprefixer`, `postcss`
    *   Command: `npx npm-check-updates -u typescript @vitejs/plugin-react autoprefixer postcss`
    *   Install: `bun install`
    *   Test & Commit. (DONE - 20250516-103721: TypeScript, Vite plugin, autoprefixer, postcss updated in package.json and bun install run. Manual testing and commit by user pending.)

4.  **Update Linters & Formatters (Minor/Patch)**
    *   Packages: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `prettier`
    *   Command: `npx npm-check-updates -u @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier`
    *   Install: `bun install`
    *   Test & Commit. (DONE - 20250516-103721: ESLint TypeScript plugins and Prettier updated and installed. Manual testing, running linters/formatters, and commit by user pending.)

5.  **Update Testing & Dev Utilities (Minor/Patch)**
    *   Packages: `happy-dom`, `jsdom`, `msw`, `serve`, `vite-bundle-visualizer`
    *   Command: `npx npm-check-updates -u happy-dom jsdom msw serve vite-bundle-visualizer`
    *   Install: `bun install`
    *   Test & Commit.

---

## Phase 2: Major Updates (High Caution - Tackle Individually)

These updates have a higher risk of breaking changes and should be handled one by one. **Always read release notes/migration guides first.**

**Working Directory for commands:** `/home/jango/Git/maike2/schichtplan/src/frontend`

1.  **Update Tailwind CSS (to v4)**
    *   Packages: `tailwindcss`, `@tailwindcss/vite`
    *   Action: **Critically Review** Tailwind CSS v4 migration guide.
    *   Command: `npx npm-check-updates -u tailwindcss @tailwindcss/vite`
    *   Install: `bun install`
    *   Test: Thoroughly check all styling and responsive behavior. Refactor styles as needed.
    *   Commit.

2.  **Update ESLint (to v9)**
    *   Packages: `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
    *   Action: Review ESLint v9 migration guide and `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` compatibility/notes.
    *   Command: `npx npm-check-updates -u eslint eslint-plugin-react-hooks eslint-plugin-react-refresh`
    *   Install: `bun install`
    *   Test: Run linting. Update ESLint configuration if necessary.
    *   Commit.

3.  **Update Testing Library (Major)**
    *   Packages: `@testing-library/react`, `@testing-library/user-event`
    *   Action: Review release notes for `@testing-library/react` v15 & v16.
    *   Command: `npx npm-check-updates -u @testing-library/react @testing-library/user-event`
    *   Install: `bun install`
    *   Test: Run all automated tests. Update tests if there are breaking API changes.
    *   Commit.

4.  **Update React Router DOM (to v7)**
    *   Package: `react-router-dom`
    *   Action: **Critically Review** React Router v7 upgrade guide.
    *   Command: `npx npm-check-updates -u react-router-dom`
    *   Install: `bun install`
    *   Test: Thoroughly test all application routes, navigation, and route-related functionality.
    *   Commit.

5.  **Update React & React DOM (to v19)**
    *   Packages: `react`, `react-dom`, `@types/react`, `@types/react-dom`
    *   Action: **Critically Review** React 19 release notes and upgrade guide. This is a very significant update.
    *   Command: `npx npm-check-updates -u react react-dom @types/react @types/react-dom`
    *   Install: `bun install`
    *   Test: Perform extensive testing across the entire application. Look for issues related to concurrent features, hooks, or other React APIs. Refactor code as needed based on upgrade guide.
    *   Commit.

6.  **Update Node.js Type Definitions (Major)**
    *   Package: `@types/node`
    *   Action: Review if any specific Node.js features used in frontend build/scripts might be affected.
    *   Command: `npx npm-check-updates -u @types/node`
    *   Install: `bun install`
    *   Test: Ensure build process and any scripts relying on Node.js types are working.
    *   Commit.

7.  **Update `react-day-picker` (Major)**
    *   Package: `react-day-picker` (8.10.1 to 9.7.0)
    *   Action: Review `react-day-picker` changelog from v8 to v9.
    *   Command: `npx npm-check-updates -u react-day-picker`
    *   Install: `bun install`
    *   Test: Thoroughly test all calendar and date picking functionalities.
    *   Commit.

8.  **Update `react-error-boundary` (Major)**
    *   Package: `react-error-boundary` (v5 to v6)
    *   Action: Review changelog for API changes.
    *   Command: `npx npm-check-updates -u react-error-boundary`
    *   Install: `bun install`
    *   Test: Test error handling scenarios.
    *   Commit.

9.  **Update `react-resizable-panels` (Major)**
    *   Package: `react-resizable-panels` (v2 to v3)
    *   Action: Review changelog for API changes.
    *   Command: `npx npm-check-updates -u react-resizable-panels`
    *   Install: `bun install`
    *   Test: Test resizable panel functionality.
    *   Commit.

---

## Phase 3: Final Review & Testing

*   Once all targeted dependencies are updated:
    *   Perform a full regression test of the entire application.
    *   Conduct a code review of the changes, if possible.
    *   Monitor the application after deployment (if applicable) for any unforeseen issues.

---
**End of Plan**
