# Start the project from scratch

This is an implementation request. No work has been done yet. Initialize and build the application; an existing application or repository is not an input requirement.

## Project directory and authorization

Use the current user-selected project directory containing this file, `SYSTEM_PROMPT.md`, and `docs/SPECIFICATION.md`. Treat it as the application root. The intended directory name is `business-manager`, but an explicitly selected alternative is valid.

You are authorized to create local project files, install project dependencies, initialize local Git if absent, and run non-destructive local checks within this workspace. Honor runtime permissions. Do not create remote repositories, push, deploy, install machine-wide tools without approval, provision paid services, or connect to/mutate an unverified hosted database. Do not send live messages or touch production resources.

Do not look for an existing repository elsewhere. Do not scan `/Users/huzi`, other home directories, or unrelated client projects. Missing application files on this first run are expected.

## Inputs

Read `CLAUDE.md` and `SYSTEM_PROMPT.md`, then the complete `docs/SPECIFICATION.md`. The full specification is provided in this directory; the system prompt is not its replacement. Treat `docs/ACCOUNTS_AND_CREDENTIALS.md` as a setup reference only, with no real credentials.

Preserve these inputs. Do not replace the specification with your own shorter version. If a supplied file cannot actually be accessed, report that exact missing file instead of searching unrelated directories or reconstructing requirements.

## Current task: architecture and Phase 1 Foundation

Briefly state the implementation sequence, then execute it in the current run. Do not stop after a plan, ask me which phase to start, or ask for a pre-existing repository.

Before major application code, document the architecture required by specification Section 159: data model and relationships, permission architecture/precedence, order state machine, search/filter strategy, navigation, design system, notifications, and performance. Mark proposals and unresolved business decisions explicitly. Keep this practical; it must lead into implementation rather than become a documentation-only exercise.

Create `docs/REQUIREMENTS.md` mapping all specification sections and mandatory subrequirements to status, implementation, and acceptance evidence. Identify the subset being implemented now. Preserve the rest as future scope, not silently omitted requirements.

Initialize and implement the Phase 1 scope from Section 157:

- Next.js App Router, strict TypeScript, Tailwind CSS, customized shadcn/ui, and the required foundational tooling.
- A deliberate initial design system and application shell matching the specification, not a generic card-grid dashboard.
- Supabase and Prisma configuration, organized schema structure, and a documented migration workflow.
- Supabase Auth integration and separate application user profile data.
- Database-backed roles and permissions, multiple roles per user, direct ALLOW/DENY overrides, centralized permission resolution, server-side authorization, and permission-aware navigation.
- Relevant unit/component tests and the foundation for required end-to-end testing.
- Accurate development/setup documentation, scripts, and non-secret `.env.example` placeholders.

Design for the whole platform, but implement only Phase 1 and its necessary prerequisites now. Do not implement all ten phases in one uncontrolled pass. Do not report whole-project completion after completing the foundation.

If scaffolding refuses a directory containing documentation, preserve the documentation and use a temporary child directory to generate the scaffold, then merge collision-free files into the actual root. Do not delete the input files or leave the app one directory too deep.

## Missing credentials or business decisions

Missing Supabase, Resend, WhatsApp, Redis, monitoring, or analytics configuration must not stop independent code, UI, configuration, or unit-test work. Document exactly which checks require configuration and mark them NOT_RUN when appropriate. In particular, do not require messaging-provider accounts before foundational local development.

Protected features must fail closed when unconfigured. No fake login, mock database presented as real persistence, hard-coded role bypasses, fabricated successful integrations, or hidden placeholders. Clearly isolated test mocks are acceptable in tests; they are not live integration verification.

Resolve reversible technical choices and record them. Defer only affected work when a financial, security-sensitive, or unspecified business policy requires a decision. Do not stop the entire foundation because a later finance policy is unresolved.

## Verification and handoff

Run available type checking, lint, focused tests, and the production build. Run database-backed/integration/E2E checks only with the required verified local or development configuration. Distinguish a build that succeeds from a live integration that has not been exercised.

Return:

1. Current task status: COMPLETE, PARTIAL, or BLOCKED.
2. Application files and behavior actually created.
3. Exact installation/run commands supported by the generated project.
4. Checks actually run with PASS, FAIL, or NOT_RUN and reasons.
5. Missing configuration and remaining Phase 1 work.

If blocked on one component, continue the independent safe work. If execution tools or runtime permissions prevent implementation, state that specific limitation without pretending code was created.
