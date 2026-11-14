# Tekton ECA
`npm install && npm run dev`

## Demo accounts (email / password)
| Role | Email | Password |
|---|---|---|
| Admin | admin@tekton.ph | Admin@2026 |
| Assistant Manager | assistant@tekton.ph | Assist@2026 |
| Site Supervisor | supervisor@tekton.ph | Site@2026 |
| Foreman | foreman@tekton.ph | Foreman@2026 |
| Client | client@tekton.ph | Client@2026 |
| Documents | documents@tekton.ph | Docs@2026 |
| Budget Officer | budget@tekton.ph | Budget@2026 |
| Asset Officer | asset@tekton.ph | Asset@2026 |
| HR | hr@tekton.ph | People@2026 |
| Finance | finance@tekton.ph | Finance@2026 |

In demo mode, accounts and records use browser storage. Supabase mode uses real authentication and server-side permissions; see the setup guide below.
Reset browser demo data from Settings. Cloud data has no demo-reset action.

## Project flow
See [Project Workflow: Setup to Closeout](docs/PROJECT-FLOW.md) for the role-by-role process, document stages, finance approvals, dashboard responsibilities, and current implementation gaps.
- Project selector (Overview header) filters every dashboard; Client, Foreman and Site Supervisor are locked to the project the admin assigns in Users & Roles.
- Project page: `#project/P-001` with Summary, Budget, Billing, Documents, Tasks, Crew tabs (tabs depend on role).
- All dashboard numbers come from module records (`src/metrics.ts`). Charts marked "sample" are still mock.
- Approvals, leaves, payroll, deliveries, tasks, invoices and attendance actions write back to the modules and the audit log.

## Backend-ready
- `docs/BACKEND.md` is the contract (resources, relationships, derived values, workflows, access matrix, endpoints) generated from `src/modules.ts`.
- Stable project codes (P-001...), project/employee fields are dropdowns, deleting a project that is in use is blocked.
- Purchases, transfers and cash advances raise linked approvals; attendance has Pending/Approved with lock; payroll is generated from approved attendance; budget actuals are computed.

## UX states
Splash screen, button spinner/pending (`Btn`, `useAction`), skeleton loaders on page change, upload progress bars with retry, toasts (`useToast`), empty states (`Empty`), error state with retry (`PageBoundary`, `ErrorState`) and success state (`SuccessState`) live in `src/ux.tsx`. Network delay is simulated (Settings â†’ Data); with a real backend, `useAction().run` awaits the actual request and its failures show an error toast with Retry.

## Brand
`src/Logo.tsx` (`Logo`, `LogoMark`) is the Tekton ECA mark re-drawn as SVG: sun behind three towers + wordmark. `dark` variant for the app UI, `light` for white backgrounds. Static files: `public/favicon.svg`, `public/logo-mark.svg`, `public/logo-light.svg` (use for print/quotations).


## Frontend deployment
Live frontend: https://tekton-eca-final-boss.pages.dev

See [Cloudflare Pages deployment](docs/DEPLOYMENT.md) for Direct Upload commands and the current backend status. GitHub pushes do not automatically publish this site.

## Supabase backend
The backend code is ready for configuration. See [Supabase setup and activation](docs/SUPABASE-SETUP.md). Cloud mode uses real Auth, project permissions, shared records, private files and transactional approvals. The live website remains the previously uploaded demo until a Supabase project is configured and a new build is deployed.
