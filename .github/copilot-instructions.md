Repository overview for Copilot sessions

Purpose

This file gives concise, repo-specific guidance for Copilot sessions: how to build/test/lint locally, the important high-level architecture to know before making changes, and project-specific conventions worth following.

1) Build / test / lint (exact commands)

- Install: npm ci (or npm install)
- Dev server: npm run dev  # Vite dev server (host ::, port 8080)
- Build: npm run build
- Preview build: npm run preview
- Lint: npm run lint  # eslint (see eslint.config.js, `dist` is ignored)

- Test (full suite): npm run test  # runs vitest in CI mode
- Test (watch): npm run test:watch

- Run a single test file (examples):
  - npm run test -- src/test/example.test.ts
  - npx vitest run src/components/MyComponent.test.tsx
  - Filter by test name: npx vitest -t "name pattern"  OR npm run test -- -t "name pattern"

2) Where runtime config and secrets live

- Environment variables are loaded via .env and use VITE_* for values consumed by the frontend.
- Key vars the code expects (do not commit secrets):
  - VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID
  - VITE_BACKEND_API_URL and many VITE_* Google Apps Script endpoints used by the UI
  - LLM_PROVIDER / GEMINI_API_KEY / GEMINI_MODEL (used by AI/evaluation integrations)

3) High-level architecture (big picture)

- Frontend: Vite + React + TypeScript app in src/
  - Entry: src/main.tsx -> App.tsx
  - Pages: src/pages/* (regular pages) and src/pages/admin/* (admin surface)
  - Shared UI primitives: src/components/ui/* (shadcn-like components)
  - State/hooks and services: src/hooks/, src/lib/ — services talk to Firebase and external Apps Script endpoints

- Backend/Integrations (external to this repo):
  - Firebase Firestore used as the primary persistent store (src/lib/firestoreService.ts)
  - Google Apps Script endpoints configured via VITE_* variables (used for booking, scoring, etc.)
  - The repository README also documents a separate Python AI evaluation pipeline (scripts/evaluate_student.py and related scripts). See README.md for that pipeline's commands.

4) Key conventions and patterns

- Path aliases: `@` resolves to ./src and `@root` resolves to repository root (see vite.config.ts / tsconfig). Use these aliases rather than deep relative imports.
- Tests: Vitest is configured to include files matching src/**/*.{test,spec}.{ts,tsx} and uses src/test/setup.ts for jsdom setup.
- ESLint: Custom config in eslint.config.js (TypeScript-aware). The lint task runs `eslint .` — fix issues in the repo root.
- Firebase: src/lib/firebase.ts reads VITE_ env vars. Local development should use a .env file (do not commit secrets).
- Date/time strings and booking windows: Firestore dates are stored as plain strings in certain collections — see getBookingWindowsFromFirestore / isBookingWindowOpen for parsing assumptions (DD/MM/YYYY). Be careful when changing date formats.
- UI pattern: Most components are small, composable primitives in src/components/ui/; prefer them over ad-hoc markup.
- Dist is a build artifact; do not edit files under dist/ directly.

5) Helpful pointers copied from README (important repo-specific docs)

- AI evaluation pipeline: README.md contains a full orchestration diagram and the command:
  python scripts/evaluate_student.py <sheet_id> <row>
  (If that scripts/ tree exists in other clones or branches, follow README for artifact lifecycles and cleanup rules.)

6) Where to look for more context quickly

- src/lib/*: business logic and Firestore access (good first stop for data flow)
- src/pages/admin: admin flows and forms (important for changes that alter data shape)
- vite.config.ts / tsconfig.json: path aliases and build-time behavior
- README.md: pipeline and operational notes (non-UI parts)

7) AI / Copilot-specific guidance

- Prefer making small, targeted edits and run the dev server or targeted tests to verify.
- When asked to change API surface, check src/lib/firestoreService.ts and all callers in src/pages/admin and src/pages/* before altering data shapes.
- Avoid suggestions that expose or commit values from .env; point the user to add required VITE_* keys locally.

8) Files with special handling

- .env: contains many VITE_* keys (secrets) — treat as private.
- dist/: production build artifacts. Not a source of truth.
- src/test/setup.ts: test environment shims for jsdom

----

If this repo already has a .github/copilot-instructions.md, merge these sections into the existing file rather than replacing it. This file focuses on concrete commands, architecture, and conventions — not generic best practices.

Summary: created concise repo-specific Copilot instructions that include exact commands, high-level architecture, and conventions. 

Would you like me to also configure an MCP server (for example: Playwright for web UI testing) for this repository? If yes, say which server to add.