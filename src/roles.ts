export type Role = 'admin' | 'assistant_manager' | 'site_supervisor' | 'foreman' | 'client'
  | 'documents' | 'budget' | 'asset' | 'hr' | 'finance'
export type Tone = 'g' | 'a' | 'r' | ''

export interface RoleCfg {
  label: string; sub: string; action: string; actionTo: string
  kpis: [string, string, string, Tone][]
  chartTitle: string; legend: [string, string]; base: number
  gaugeTitle: string; pct: number; gaugeNote: string; gstats: [string, string][]
  pipeTitle: string; stages: [string, number][]
  attnTitle: string; rows: string[][] // [item, owner, status, due, tag]
  ai: string; aiBtn: string
}

export const ROLES: Record<Role, RoleCfg> = {
  admin: { label: 'Admin', sub: 'Head office', action: 'New project', actionTo: 'projects',
    kpis: [['Active projects', '12', '+2', 'g'], ['Pending approvals', '9', '3 overdue', 'a'], ['Approved', '128', '+12%', 'g'], ['Rejected', '6', '-4%', 'r'], ['Open incidents', '3', '1 new', 'a']],
    chartTitle: 'Requests vs decisions', legend: ['Submitted', 'Decided'], base: 40,
    gaugeTitle: 'On-time decisions', pct: 92, gaugeNote: '125 of 136 within target', gstats: [['6h', 'until next due'], ['4', 'cases lapse within 12h']],
    pipeTitle: 'Open pipeline', stages: [['Draft', 34], ['Review', 41], ['Sent', 32], ['Approval', 60], ['Info', 27], ['Appeal', 18], ['Denied', 9]],
    attnTitle: 'Needs attention', rows: [['Budget revision P-003', 'Liza Cruz', 'Pending', '9h', 'today'], ['Asset transfer #88', 'Ben Ramos', 'Pending', '12h', 'today'], ['New user: M. Ruiz', 'Ana Reyes', 'Review', '1d', 'overdue'], ['Permit renewal P-002', 'Jose Lim', 'Review', '2d', 'overdue']],
    ai: '4 approvals lapse within 12 hours. Follow up by 2 PM.', aiBtn: 'Review 4 cases' },
  assistant_manager: { label: 'Assistant Manager', sub: 'Operations', action: 'New task', actionTo: 'tasks',
    kpis: [['On track', '9', '+1', 'g'], ['Delayed', '3', '1 new', 'a'], ['Open requests', '17', '5 due', 'a'], ['Completed MTD', '24', '+6', 'g'], ['Site visits', '4', 'today', '']],
    chartTitle: 'Progress vs plan', legend: ['Planned', 'Actual'], base: 55,
    gaugeTitle: 'Schedule adherence', pct: 78, gaugeNote: '7 of 9 milestones on time', gstats: [['2d', 'to next milestone'], ['3', 'projects at risk']],
    pipeTitle: 'Project stages', stages: [['Planning', 4], ['Mobilize', 3], ['Structure', 8], ['Finishing', 5], ['Turnover', 2], ['Delayed', 3]],
    attnTitle: 'Project watchlist', rows: [['Lim Warehouse', 'Mark Santos', 'Delayed', '3d', 'overdue'], ['Santos Clinic', 'Ana Reyes', 'Pending', '1d', 'today'], ['Dela Cruz Residence', 'Jose Lim', 'Review', '5h', 'today']],
    ai: 'Lim Warehouse slipped 3 days. Reassign Crew B?', aiBtn: 'Review plan' },
  site_supervisor: { label: 'Site Supervisor', sub: 'Site: Quezon City', action: 'Log incident', actionTo: 'incidents',
    kpis: [['Workers on site', '34', '', ''], ['Tasks today', '11', '2 late', 'a'], ['Deliveries', '3', 'expected', ''], ['Open incidents', '1', 'open', 'a'], ['Attendance', '94%', '+2%', 'g']],
    chartTitle: 'Attendance vs plan', legend: ['Planned', 'Present'], base: 34,
    gaugeTitle: 'Schedule adherence', pct: 85, gaugeNote: '9 of 11 tasks on time', gstats: [['3h', 'to next delivery'], ['2', 'tasks running late']],
    pipeTitle: 'Task pipeline', stages: [['Todo', 12], ['Ongoing', 9], ['Review', 5], ['Done', 21], ['Blocked', 2]],
    attnTitle: 'Today on site', rows: [['Rebar tying, 2F slab', 'Crew A', 'Todo', '4h', 'today'], ['Hollow block laying', 'Crew B', 'Open', '1d', 'overdue'], ['Concrete pour', 'Crew C', 'Expected', '1d', 'today']],
    ai: 'Tomorrow’s pour needs mixer M-11, which is under repair.', aiBtn: 'See assets' },
  foreman: { label: 'Foreman', sub: 'Crew A', action: 'Log attendance', actionTo: 'attendance',
    kpis: [['Present today', '18', '2 absent', 'a'], ['OT hours', '24', '', ''], ['Purchases', '5', '2 pending', 'a'], ['Cash advances', '3', '', ''], ['Crew size', '20', '', '']],
    chartTitle: 'Attendance this period', legend: ['Expected', 'Present'], base: 20,
    gaugeTitle: 'Attendance rate', pct: 90, gaugeNote: '18 of 20 present', gstats: [['24h', 'overtime logged'], ['2', 'workers absent']],
    pipeTitle: 'Purchase requests', stages: [['Draft', 3], ['Pending', 5], ['Approved', 8], ['Ordered', 6], ['Received', 12]],
    attnTitle: 'Crew', rows: [['R. Dizon', 'R. Dizon', 'Open', 'absent', 'overdue'], ['A. Cruz', 'A. Cruz', 'Pending', '+2h OT', 'today'], ['J. Reyes', 'J. Reyes', 'Review', 'present', 'today']],
    ai: 'R. Dizon was absent 2 days. File a cash-advance note?', aiBtn: 'Open cash advance' },
  client: { label: 'Client', sub: 'Dela Cruz Residence', action: 'View billing', actionTo: 'billing',
    kpis: [['Overall progress', '52%', '+4%', 'g'], ['Contract value', '₱1.59M', '', ''], ['Paid so far', '₱890K', '+₱320K', 'g'], ['Balance', '₱698K', 'due Nov 20', 'a'], ['Days left', '52', '', '']],
    chartTitle: 'Progress vs plan', legend: ['Planned', 'Actual'], base: 30,
    gaugeTitle: 'Completion', pct: 52, gaugeNote: 'Week 12 of 24', gstats: [['52d', 'to turnover'], ['1', 'billing due soon']],
    pipeTitle: 'Milestones', stages: [['Foundation', 10], ['Columns', 8], ['Slab', 6], ['Walls', 3], ['Roofing', 1]],
    attnTitle: 'Billing', rows: [['Progress billing #2', 'Finance', 'Sent', 'Nov 20', 'today'], ['Progress billing #1', 'Finance', 'Pending', 'paid', ''], ['Change order #1', 'Admin', 'Review', '2d', 'overdue']],
    ai: 'Progress billing #2 is due Nov 20. Pay by GCash or bank.', aiBtn: 'View invoice' },
  documents: { label: 'Documents Officer', sub: 'Records', action: 'Upload document', actionTo: 'documents',
    kpis: [['Documents', '1,284', '+36', 'g'], ['Pending review', '14', '5 overdue', 'a'], ['Permits expiring', '6', '30 days', 'a'], ['Uploaded today', '9', '', ''], ['Approved MTD', '88', '+9%', 'g']],
    chartTitle: 'Uploads vs reviews', legend: ['Uploaded', 'Reviewed'], base: 14,
    gaugeTitle: 'Reviewed on time', pct: 74, gaugeNote: '66 of 89 within target', gstats: [['5h', 'until next due'], ['6', 'permits expire soon']],
    pipeTitle: 'Review pipeline', stages: [['Uploaded', 20], ['Screening', 14], ['Review', 14], ['Approved', 60], ['Expired', 6]],
    attnTitle: 'Needs review', rows: [['Building permit', 'Ana Reyes', 'Review', '2h', 'today'], ['Contract rev. 2', 'Jose Lim', 'Review', '1d', 'overdue'], ['Insurance cert.', 'Liza Cruz', 'Expired', '3d', 'overdue']],
    ai: '6 permits expire within 30 days. Draft renewal requests?', aiBtn: 'Review permits' },
  budget: { label: 'Budget Officer', sub: 'Cost control', action: 'New budget', actionTo: 'budgets',
    kpis: [['Total budget', '₱24.8M', '', ''], ['Spent', '₱11.2M', '45%', ''], ['Over budget', '2', 'projects', 'r'], ['Pending revisions', '4', '', 'a'], ['Savings', '₱1.2M', '+8%', 'g']],
    chartTitle: 'Budget vs actual', legend: ['Budget', 'Actual'], base: 60,
    gaugeTitle: 'Budget used', pct: 45, gaugeNote: '₱11.2M of ₱24.8M', gstats: [['2', 'projects over budget'], ['4', 'revisions to review']],
    pipeTitle: 'Revision pipeline', stages: [['Draft', 4], ['Review', 6], ['Approved', 12], ['Applied', 9], ['Rejected', 2]],
    attnTitle: 'Budget alerts', rows: [['Lim Warehouse', 'Mark Santos', 'Over', '104%', 'overdue'], ['Santos Clinic', 'Ana Reyes', 'Warning', '96%', 'today'], ['Dela Cruz Residence', 'Jose Lim', 'Pending', '50%', '']],
    ai: 'Lim Warehouse labor is 4% over. Propose a revision?', aiBtn: 'Open budgets' },
  asset: { label: 'Asset Officer', sub: 'Equipment', action: 'New asset', actionTo: 'assets',
    kpis: [['Total assets', '212', '+8', 'g'], ['Deployed', '147', '', ''], ['Under repair', '9', '2 new', 'a'], ['Due for service', '12', '', 'a'], ['Utilization', '69%', '+3%', 'g']],
    chartTitle: 'Utilization', legend: ['Available', 'In use'], base: 50,
    gaugeTitle: 'Utilization rate', pct: 69, gaugeNote: '147 of 212 in use', gstats: [['3d', 'next service due'], ['9', 'assets under repair']],
    pipeTitle: 'Maintenance pipeline', stages: [['Reported', 9], ['Diagnosed', 7], ['Parts', 4], ['Repair', 5], ['Tested', 3], ['Back', 14]],
    attnTitle: 'Equipment', rows: [['Concrete mixer M-11', 'Ben Ramos', 'Maintenance', '2d', 'overdue'], ['Generator G-05', 'Jose Lim', 'Pending', '1d', 'today'], ['Excavator EX-02', 'Mark Santos', 'Review', '5d', '']],
    ai: 'Mixer M-11 is needed for a pour on Nov 7. Prioritize repair.', aiBtn: 'Open maintenance' },
  hr: { label: 'HR Officer', sub: 'People', action: 'New employee', actionTo: 'employees',
    kpis: [['Employees', '186', '+7', 'g'], ['Present today', '171', '', ''], ['Leave requests', '8', '', 'a'], ['Payroll due', '3d', '', 'a'], ['Open positions', '5', '', '']],
    chartTitle: 'Headcount vs present', legend: ['Headcount', 'Present'], base: 80,
    gaugeTitle: 'Attendance rate', pct: 92, gaugeNote: '171 of 186 present', gstats: [['3d', 'until payroll'], ['8', 'leave requests open']],
    pipeTitle: 'Hiring pipeline', stages: [['Applied', 40], ['Screen', 22], ['Interview', 12], ['Offer', 5], ['Onboard', 3], ['Rejected', 7]],
    attnTitle: 'Requests', rows: [['M. Ruiz onboarding', 'Ana Reyes', 'Review', '1d', 'overdue'], ['L. Gomez leave', 'Liza Cruz', 'Pending', '4h', 'today'], ['P. Tan cash advance', 'Jose Lim', 'Pending', '9h', 'today']],
    ai: '8 leave requests are open. 3 conflict with the Nov 12 pour.', aiBtn: 'Review leaves' },
  finance: { label: 'Finance Officer', sub: 'Treasury', action: 'New invoice', actionTo: 'billing',
    kpis: [['Collected MTD', '₱3.4M', '+12%', 'g'], ['Receivables', '₱2.1M', '4 overdue', 'a'], ['Payables', '₱1.6M', '', ''], ['Cash balance', '₱5.8M', '', ''], ['Overdue invoices', '4', '-1', 'g']],
    chartTitle: 'Collected vs spent', legend: ['Collected', 'Spent'], base: 70,
    gaugeTitle: 'Collection rate', pct: 81, gaugeNote: '₱3.4M of ₱4.2M billed', gstats: [['2d', 'next payment due'], ['4', 'invoices overdue']],
    pipeTitle: 'Billing pipeline', stages: [['Draft', 6], ['Sent', 18], ['Viewed', 12], ['Partial', 7], ['Paid', 40], ['Overdue', 4]],
    attnTitle: 'Invoices', rows: [['INV-0412 Dela Cruz', 'Liza Cruz', 'Overdue', '7d', 'overdue'], ['INV-0415 Lim Corp', 'Ben Ramos', 'Sent', '2d', 'today'], ['INV-0418 Santos', 'Ana Reyes', 'Draft', '5h', 'today']],
    ai: 'INV-0412 is 7 days overdue. Send a reminder via email?', aiBtn: 'Send reminder' },
}
export const ROLE_KEYS = Object.keys(ROLES) as Role[]
