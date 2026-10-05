# Business Manager: project instructions

This is a new application built from scratch. The initial directory contains only the project instructions and documentation. Do not look for an existing application in other directories.

Read and follow `SYSTEM_PROMPT.md` before working. Use `docs/SPECIFICATION.md` as the complete product requirements. Use `docs/ACCOUNTS_AND_CREDENTIALS.md` only as a configuration reference, not additional feature scope or a requirement that every account exists before local development starts.

The initial task is in `START_HERE.md`: establish the required architecture and implement Phase 1 Foundation. Do not repeat that task blindly once work exists; on later runs inspect progress and follow the user's current request.

The project root is the user-selected folder containing this file. Preserve these files and unrelated user changes. Do not read other client projects, scan the user's home directory, or invent missing product requirements.

Read the complete specification at initial planning, then relevant sections and dependencies during later tasks. Track acceptance evidence in `docs/REQUIREMENTS.md` as implementation proceeds. Planning documents must distinguish proposed architecture from implemented behavior.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
