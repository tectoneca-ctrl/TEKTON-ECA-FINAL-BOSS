# Supabase backend setup

## Current status

The backend implementation is in this repository. The hosted Supabase project has not been created or connected yet. The existing Cloudflare Pages website remains the previously deployed demo until a configured build is explicitly uploaded.

Use the actual working folder: C:\Users\adria\Downloads\tekton-eca (12).

The existing visual design is retained. The app supports two separate modes:

- demo: existing browser-local accounts, records and IndexedDB files.
- supabase: Supabase Auth, shared PostgreSQL records, role/project permissions, private document Storage and server audit events.

Supabase mode never falls back to demo data on a configuration or network error. Demo records and demo passwords are never imported into the database by these migrations.

## Activate a new Supabase project

1. Create a Supabase account and a new project for this company. Keep its database password private. The Supabase integration can be installed and connected here to complete setup together; the project link is sufficient to identify the intended project.
2. Apply both SQL migrations in supabase/migrations, in filename order. They create the ERP schema, validation rules, access matrix and checklist template defaults. They do not create business projects or employee/demo accounts.
3. Deploy supabase/functions/manage-users. It verifies the caller's access token with Supabase Auth and checks the current Admin role before calling any Auth Admin API.
4. Set Auth Site URL to https://tekton-eca-final-boss.pages.dev. Add that exact URL and http://localhost:5173 to allowed redirect URLs. Disable public signup. Set the minimum password length to 12. Configure your SMTP provider before relying on password-reset delivery to staff.
5. Create the first real administrator, using the process below.
6. Copy .env.example to .env.local and set:

    VITE_BACKEND_MODE=supabase
    VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY

Only the project URL and publishable key belong in VITE_ variables. The browser configuration rejects service-role JWTs and sb_secret_ keys. Do not paste secret keys or passwords into chat or commit them.

If using the Supabase CLI after authentication:

    npx supabase login
    npx supabase link --project-ref YOUR_PROJECT_REF
    npx supabase db push
    npx supabase functions deploy manage-users --no-verify-jwt

The Edge Function's built-in JWT gateway check is disabled because its own handler validates the bearer token through Auth and then checks the database role. This does not make it publicly writable.

The CLI config describes local development. Confirm the hosted Auth settings in the dashboard; running database migrations alone does not configure hosted Auth URLs or SMTP.

## First administrator

A one-time server-side script is available:

    npm run backend:admin

It reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ERP_ADMIN_EMAIL, ERP_ADMIN_NAME and ERP_ADMIN_PASSWORD from the process environment. Supply these locally through a private environment/secret manager; never use VITE_ prefixes for them. The password must be at least 12 characters.

The script refuses to bootstrap if an active administrator already exists. It creates the Auth user and ERP profile, and removes the new Auth user if profile creation fails. Clear the secret environment variables after running it.

Thereafter, use Admin > Users & Roles. New users get real Auth accounts. Removing a user in cloud mode disables ERP access while preserving historical records. An administrator cannot change their own role or disable their own access through the app. Accounts without an ERP profile have no ERP access.

## Normal project workflow

1. Admin or Assistant Manager creates the project. Its project type selects the checklist template, copied within the same transaction.
2. Admin assigns Client, Foreman and Site Supervisor accounts to a project. Unassigned scoped accounts can see no project data.
3. Operations records progress, tasks, attendance, deliveries and incidents within permitted projects. Foreman submits Pending attendance; Supervisor or HR reviews it.
4. Documents uploads a private file against a project and reviews the document. Clients can read only Approved documents in their assigned project. A document cannot be approved until its file upload is complete.
5. Checklist completion remains an explicit Documents/Admin confirmation. OUT requires its related document, or the documents of an OUT-only section, to be complete. Uploads are not automatically matched to checklist rows.
6. Purchases, transfers and cash advances create a linked Pending approval automatically. Only Admin makes the final decision, and an Admin cannot approve their own request. The approval and source record change together. Editing a Pending request invalidates an older approval version so the reviewer must refresh.
7. Finance uses Mark paid on a Sent or Overdue invoice. The invoice and collection are saved together. Repeating the same request cannot create a duplicate collection.
8. HR generates draft payroll on the server from approved attendance and the employee rate. HR/Admin approves; Finance/Admin releases. Statutory deductions and payslips are not implemented.

This is one final approval stage. Multi-level Budget -> Finance -> Admin routing remains future work. It is not claimed as implemented.

## Access and data model

This is a single-company backend, not a multi-tenant product.

- erp_profiles connects Supabase Auth IDs to numeric UI IDs, roles and project assignments. No passwords are stored here.
- erp_projects stores unique site codes and validated project fields.
- erp_records stores module-tagged, validated JSON fields with relational project and employee references. This matches the current module-driven frontend and avoids changing the screen layout.
- erp_module_definitions defines accepted fields, types, status values, readers and writers. A new module needs a matching migration.
- erp_settings contains company defaults.
- erp_audit records database changes, actor identity and before/after values. Clients cannot forge or edit audit records.
- private.erp_requests records successful mutation IDs to make retries idempotent.
- erp-documents is a private Storage bucket with a 25 MB object limit.

Authenticated browsers can SELECT through Row Level Security. They cannot insert/update/delete ERP tables directly. Writes use validated RPCs, with a transaction covering the entire batch. Version checks reject stale edits instead of silently replacing another user's work.

Role scope:

| Role | Main access |
| --- | --- |
| Admin | Full company records, access management and final approvals |
| Assistant Manager | Project setup, operations and project monitoring; no payroll administration |
| Site Supervisor | Assigned site progress, tasks, attendance, deliveries and incidents |
| Foreman | Assigned crew, Pending attendance, purchase requests and cash advances |
| Client | Assigned project, progress, billing/collections and Approved documents; read only |
| Documents | Documents, permits and checklists/templates |
| Budget | Budgets, expenses and purchase/approval visibility |
| Asset | Equipment and transfers |
| HR | Employees, attendance, leaves and payroll preparation/approval |
| Finance | Billing, collections, expenses and approved payroll release |

Admin can give Documents an optional finance summary for one project or all projects. A server function returns aggregates only; it does not grant raw invoices, payments, payroll or write permissions.

Records refresh after each successful write, when the tab regains focus, and every 30 seconds while visible. This is polling, not Realtime subscriptions. Notification-read state is currently local to the signed-in tab.

## Files and failed uploads

Cloud uploads first reserve document metadata, upload the file, then attach its private Storage path. A failure stays visibly incomplete and cannot be approved. Retry in the current upload panel reuses the reservation. If that panel was closed, remove the incomplete record before uploading again.

Deleting a document removes the database record first, then the file. If Storage cleanup fails, access is still revoked for clients; an Admin/Documents operator may need to remove the orphan object from Storage. Database transactions cannot include Storage HTTP requests.

Office and CAD files download rather than execute in a browser preview. Only PDF, PNG and JPEG MIME types are opened in the preview.

## Checks

    npm test
    npm run test:db
    npm run build

test:db requires Docker. It starts a disposable PostgreSQL 17 container with no published host ports and deletes that exact container on completion. Tests use minimal auth/storage schemas to exercise the real migrations, SQL functions and RLS; they do not emulate Supabase Auth's HTTP service or actual Storage uploads.

Also type-check the Edge Function:

    npx deno check supabase/functions/manage-users/index.ts

Before switching the live website to cloud mode, complete these hosted checks:

- Real Admin sign-in, logout, remember-me, profile update and password change/recovery.
- Create users in Users & Roles, check project assignment and verify disabled-account access.
- Use separate browsers for two roles to confirm shared records and project isolation.
- Upload, download, approve and delete a real PDF. Check denied access as another project's Client.
- Submit and approve a purchase; mark an invoice paid once; verify repeated actions do not duplicate records.
- Check private-bucket settings, Auth redirect URLs and password-reset email delivery.

## Publish the connected frontend

The current host uses Direct Upload, so changing GitHub or Cloudflare environment variables alone does not rebuild it. Set the public VITE_ variables locally before building, then:

    npm ci
    npm run build
    npm run preview
    wrangler pages deploy dist --project-name tekton-eca-final-boss --branch main

Upload only after the hosted checks pass. Keep .env.local out of Git.

## Remaining product limits

The backend adds persistence, authentication and server-side permissions to the existing product. It does not turn the current finance module into a complete accounting system.

- Spend metrics retain the current expenses plus approved/received purchases calculation. Commitments, recognized costs and cash disbursements are not separated.
- Collections entered manually are project-level; partial-invoice allocation and retention are not implemented.
- Employee names with linked records cannot be renamed or reassigned by ordinary edits yet; stable worker history needs a dedicated reassignment flow.
- Checklist rows are manually confirmed; automatic document-to-checklist linking is not implemented.
- Email invoice reminders remain disabled in cloud mode until a real delivery service is added.
- Real document versioning, e-signatures, statutory payroll, accounting exports and offline synchronization are future modules.
- Database backups do not include the Storage file contents; configure a separate file backup.
- Audit/request retention and deployment monitoring should be configured on the hosted project.

References: [Supabase React Auth](https://supabase.com/docs/guides/auth/quickstarts/react), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Private Storage access](https://supabase.com/docs/guides/storage/security/access-control), [Server-side account creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
