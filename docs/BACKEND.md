# Implementation status

The Supabase implementation and activation steps are documented in [SUPABASE-SETUP.md](SUPABASE-SETUP.md). This older contract describes planned endpoints; the implemented adapter uses PostgreSQL RPCs and one Edge Function instead. Hosted Auth and Storage smoke tests remain pending until a Supabase project is connected.

# Tekton ECA: backend contract

Generated from `src/modules.ts`. The frontend already talks to data only through the store (`src/store.tsx`), so a backend replaces its `add / update / remove / decideApproval / login` methods with API calls; screens do not change.

## Conventions
- IDs: UUID primary keys. The prototype uses string ids; every `project` field below is a **foreign key to `projects.code`** (or `projects.id` in the real schema), and `worker`/`employee` fields reference `employees` (use `employeeId` in the real schema).
- Money is in PHP, stored as integer centavos or `numeric(14,2)`. Dates are ISO `YYYY-MM-DD` (store as `date`, display in `Asia/Manila`).
- Never trust the client: enforce the access matrix and the project scope (client, foreman, site supervisor see only `users.project`) on the server.
- Passwords: hash (argon2/bcrypt). The prototype stores them in plain text for demo only.

## Resources

### Projects (`/api/projects`)
| Field | Type | Notes |
|---|---|---|
| code (Site ID) | code | auto-generated, unique, never reused |
| name (Site Name) | text |  |
| client (Client) | text |  |
| type (Project type) | select | SAQ1 / SAQ2 / CME / COLOC / RELOC |
| site (Site Address) | text | Free-text address; no location is prefilled |
| poNumber (P.O. Number) | text | Optional purchase order number |
| budget (Budget) | number |  |
| status (Status) | select | Planning / Ongoing / Delayed / Completed |

### Site checklist (`/api/checklist`)
| Field | Type | Notes |
|---|---|---|
| project | project | FK → projects.code |
| section | text |  |
| label | text |  |
| key | select | no / yes |
| status | select | Pending / Done |
| date | date |  |
| remarks | text |  |
| out | text |  |
| outKey | select | no / yes |
| outStatus | select | Pending / Out |
| outDate | date |  |
| order | number |  |

### Checklist templates (`/api/templates`)
| Field | Type | Notes |
|---|---|---|
| type (Type) | select | SAQ1 / SAQ2 / CME / COLOC / RELOC |
| section | text |  |
| label (Document) | text |  |
| key (Key (red)) | select | no / yes |
| out (OUT) | text |  |
| outKey (OUT key (red)) | select | no / yes |
| order | number |  |

### Progress (`/api/progress`)
| Field | Type | Notes |
|---|---|---|
| project | project | FK → projects.code |
| milestone | text |  |
| percent | number |  |
| date | date |  |

### Tasks (`/api/tasks`)
| Field | Type | Notes |
|---|---|---|
| task | text |  |
| project | project | FK → projects.code |
| crew | text |  |
| due | date |  |
| status | select | Todo / Ongoing / Done |

### Attendance (`/api/attendance`)
| Field | Type | Notes |
|---|---|---|
| worker | employee | FK → employees.name |
| project | project | FK → projects.code |
| date | date |  |
| days | number |  |
| ot | number |  |
| status | select | Pending / Approved |

### Deliveries (`/api/deliveries`)
| Field | Type | Notes |
|---|---|---|
| item | text |  |
| supplier | text |  |
| project | project | FK → projects.code |
| eta | date |  |
| status | select | Expected / Received / Delayed |

### Incidents (`/api/incidents`)
| Field | Type | Notes |
|---|---|---|
| report | text |  |
| project | project | FK → projects.code |
| severity | select | Low / Medium / High |
| date | date |  |
| status | select | Open / Closed |

### Purchases (`/api/purchases`)
| Field | Type | Notes |
|---|---|---|
| item | text |  |
| project | project | FK → projects.code |
| supplier | text |  |
| amount | number |  |
| status | select | Pending / Approved / Received / Rejected |

### Approvals (`/api/approvals`)
| Field | Type | Notes |
|---|---|---|
| request | text |  |
| by | text |  |
| type | select | Purchase / Budget / Leave / Transfer / Cash advance / Password reset |
| status | select | Pending / Approved / Rejected |
| module | text | system field |
| refId | text | system field |

### Budgets (`/api/budgets`)
| Field | Type | Notes |
|---|---|---|
| project | project | FK → projects.code |
| category | select | Materials / Labor / Equipment / Other |
| budget | number |  |

### Expenses (`/api/expenses`)
| Field | Type | Notes |
|---|---|---|
| item | text |  |
| project | project | FK → projects.code |
| category | select | Materials / Labor / Equipment / Other |
| amount | number |  |
| date | date |  |

### Billing (`/api/billing`)
| Field | Type | Notes |
|---|---|---|
| invoice | text |  |
| project | project | FK → projects.code |
| amount | number |  |
| due | date |  |
| status | select | Draft / Sent / Paid / Overdue |

### Payments (`/api/payments`)
| Field | Type | Notes |
|---|---|---|
| client | text |  |
| project | project | FK → projects.code |
| amount | number |  |
| date | date |  |
| method | select | GCash / Bank / Cash / Check |

### Employees (`/api/employees`)
| Field | Type | Notes |
|---|---|---|
| name | text |  |
| position | text |  |
| rate | number |  |
| hired | date |  |
| project | project | FK → projects.code |
| status | select | Active / On leave / Resigned |

### Payroll (`/api/payroll`)
| Field | Type | Notes |
|---|---|---|
| employee | employee | FK → employees.name |
| period | text |  |
| gross | number |  |
| deductions | number |  |
| status | select | Draft / Approved / Paid |

### Leaves (`/api/leaves`)
| Field | Type | Notes |
|---|---|---|
| employee | employee | FK → employees.name |
| type | select | Vacation / Sick / Emergency |
| from | date |  |
| to | date |  |
| status | select | Pending / Approved / Rejected |

### Cash advance (`/api/cashadvance`)
| Field | Type | Notes |
|---|---|---|
| worker | employee | FK → employees.name |
| amount | number |  |
| date | date |  |
| status | select | Pending / Approved / Released / Rejected |

### Documents (`/api/documents`)
| Field | Type | Notes |
|---|---|---|
| title | text |  |
| project | project | FK → projects.code |
| type | select | Permit / Contract / Plan / Certificate |
| expires | date |  |
| status | select | Review / Approved / Returned / Expired |

### Permits (`/api/permits`)
| Field | Type | Notes |
|---|---|---|
| permit | text |  |
| project | project | FK → projects.code |
| agency | text |  |
| expires | date |  |
| status | select | Pending / Active / Expiring |

### Assets (`/api/assets`)
| Field | Type | Notes |
|---|---|---|
| asset | text |  |
| code | text |  |
| site | text |  |
| condition | select | Good / Fair / Repair |
| status | select | Deployed / Available / Maintenance |

### Transfers (`/api/transfers`)
| Field | Type | Notes |
|---|---|---|
| asset | text |  |
| from | text |  |
| to | text |  |
| date | date |  |
| status | select | Pending / Approved / Done / Rejected |

## Derived values (compute on the server)
- **Budget actual** = sum(expenses by project+category) + sum(purchases not Pending/Rejected, as Materials). Status: Over (> budget), Warning (≥ 90%), Within.
- **Project progress** = average of its progress milestones. **Spent** = expenses + purchases not Pending/Rejected. **Balance** = billed (not Draft) − collected.
- **Payroll gross** = Σ (days × daily rate + OT hours × rate ÷ 8 × 1.25) over *Approved* attendance in the period. Statutory deductions are not implemented yet.

## Workflows
- **Approvals:** creating a Pending purchase, transfer or cash advance also creates an `approvals` row (`module`, `refId`). Approving/rejecting sets the linked record's status in the same transaction.
- **Attendance:** foreman saves per worker per day as `Pending` (absent = `days: 0`). HR, site supervisor, assistant manager or admin approves; approved rows are locked for the foreman. Payroll generation reads only Approved rows.
- **Projects:** Admin can archive and restore a project. Archived projects keep all records and audit history, disappear from active project selectors, and become read-only until restored. Permanent deletion is allowed only when every module reference, checklist row and user assignment has been removed; the UI lists remaining references and requires typing the Site ID. The database enforces the same rules and never cascades project history.
- **Invoices:** `Mark paid` sets status Paid and creates a `payments` row.
- **Documents:** uploads create a record in `Review` plus the file (object storage); officer sets Approved/Returned/Expired. Site compliance = approved Permit, Contract, Plan, Certificate per project.

## Access matrix (module visible per role, from `NAV`)
| Role | Modules |
|---|---|
| admin | overview, projects, progress, tasks, attendance, deliveries, incidents, purchases, approvals, budgets, expenses, billing, payments, payroll, employees, leaves, cashadvance, documents, sitedocs, permits, templates, assets, transfers, reports, audit, users, settings |
| assistant_manager | overview, projects, progress, approvals, tasks, incidents, sitedocs, reports |
| site_supervisor | overview, progress, tasks, attendance, deliveries, incidents |
| foreman | overview, attendance, purchases, cashadvance |
| client | overview, progress, billing, documents |
| documents | overview, sitedocs, documents, permits, templates |
| budget | overview, budgets, expenses, approvals |
| asset | overview, assets, transfers |
| hr | overview, employees, attendance, payroll, leaves |
| finance | overview, billing, payments, expenses, payroll |

Read-only role: `client`. Status editing restrictions: `attendance` (admin, hr, site_supervisor, assistant_manager), `approvals` (decide through the approve/reject action only).

## Suggested endpoints
`GET/POST /api/{resource}` · `GET/PATCH/DELETE /api/{resource}/{id}` · `POST /api/approvals/{id}/decide {status}` · `POST /api/payroll/generate {from,to}` · `POST /api/billing/{id}/mark-paid` · `POST /api/files` (multipart) + `GET /api/files/{id}` · `POST /api/auth/login`, `/logout`, `/change-password` · `GET /api/notifications`.

## Still to build (not in the prototype)
Estimating/BOQ and quotation, change orders, progress billing with retention, purchase orders with receiving, statutory payroll and payslips, daily site reports, material inventory, multi-level approvals, schedule/Gantt, accounting export, e-sign, offline/PWA.

## Users: profile photo
`users.avatar` is a small square JPEG (data URL in the prototype). With a backend: `PUT /api/users/me/avatar` (multipart), validate type and size, crop/resize to 256x256 server-side, store in object storage and return `avatarUrl`; `DELETE /api/users/me/avatar` removes it.

## Site checklists (SAQ1, SAQ2, CME, COLOC, RELOC)
- `projects.code` is the **Site ID** (typed by the user, unique, immutable). `projects.type` is the category.
- `templates` holds the master checklist per type: sections, required documents (documents), OUT deliverables and key milestones (`key=yes`, shown in red). Only SAQ2 is filled in from the team's sheet; the other types have empty sections.
- Creating a project copies its type's template into `checklist` rows (one per line, status Pending). Later template edits do not change existing sites. Editors can also build a checklist freehand on any site (add sections, documents, OUT lines, rename or delete sections); each addition can optionally be written back to the type's template so new sites get it, and a site's checklist can replace the template (`Save as template`). Archiving keeps a checklist available in read-only history; permanent deletion requires an empty checklist and no other linked records or user assignments.
- A checklist row holds a document (`Pending/Done` + date), an OUT (`Pending/Out` + date), or both: the OUT sits on the row of the document that releases it (CD -> MOC, DDD -> BP). A row with neither only keeps an empty section alive. A section is *ready* when all its documents are Done.
