import type { Role } from './roles'

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'project' | 'employee' | 'code'
export interface Field { k: string; label: string; type: FieldType; options?: string[]; hidden?: boolean }
export interface ModuleDef { key: string; title: string; fields: Field[]; seed: Record<string, string>[] }

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
/** spec: "key:type@Label,key:select(A|B),~hidden:text"  (project = FK to projects.code, employee = FK to employees.name) */
const parse = (spec: string): Field[] => spec.split(',').map(raw => {
  const hidden = raw.startsWith('~')
  const [kt, label] = raw.replace('~', '').split('@')
  const [k, t] = kt.split(':')
  const m = /^select\((.*)\)$/.exec(t)
  const base = { k, label: label ?? cap(k), hidden }
  return m ? { ...base, type: 'select' as const, options: m[1].split('|') } : { ...base, type: t as FieldType }
})
const def = (key: string, title: string, spec: string, rows: string[][]): ModuleDef => {
  const fields = parse(spec)
  return { key, title, fields, seed: rows.map(r => Object.fromEntries(fields.map((f, i) => [f.k, r[i] ?? '']))) }
}

export const MONEY = new Set(['amount', 'budget', 'actual', 'gross', 'deductions', 'rate'])
const CAT = 'select(Materials|Labor|Equipment|Other)'

// Checklist rows as in the team's sheets: [section, document, key?, OUT, OUT key?].
// A row can hold a document, an OUT, or both: the OUT sits on the same row as the document that releases it (CD -> MOC, DDD -> BP).
type R = [string, string, boolean, string, boolean]
const H = 'SAQ1 - Site Hunting', BILL = 'BILLING', PERMIT = 'SAQ2 - Permitting', CMEs = 'CME', ENERGY = 'ENERGIZATION', POST = 'SAQ2 - POSTCON'
const row = (s: string, l: string, key = false, out = '', outKey = false): R => [s, l, key, out, outKey]
const SAQ1: R[] = [
  row(H, 'NP from Client', true), row(H, 'PRE VAL', true), row(H, 'SAQR', true), row(H, 'TSSR', true), row(H, 'Social Awareness'),
  row(H, 'CD', false, 'MOC'), row(H, 'Prop Docs', false, 'Barangay Clearance'), row(BILL, ''),
]
const SAQ2: R[] = [
  row(BILL, ''),
  row(PERMIT, 'PROP DOCS'), row(PERMIT, 'LA'), row(PERMIT, 'BP FORMS'), row(PERMIT, 'ZONNING APPLICATION'), row(PERMIT, 'BP APPLICATION'), row(PERMIT, 'CAAP'), row(PERMIT, 'CNC'), row(PERMIT, 'LOT SEG'), row(PERMIT, 'SBT'), row(PERMIT, 'DDD', false, 'BP'),
  row(CMEs, 'DP', true), row(CMEs, 'LOGBOOK'), row(CMEs, 'NTP'), row(CMEs, 'INSURANCE'), row(CMEs, 'Surety & Performance'), row(CMEs, 'TOWER FOUNDATION', true), row(CMEs, 'Mill Cert'), row(CMEs, 'Rebars testing'), row(CMEs, 'Checklist Excav'), row(CMEs, 'RFTI - Photocopy', true), row(CMEs, 'Checklist'),
  row(ENERGY, 'MOA - client', true), row(ENERGY, 'CFEI', true), row(ENERGY, 'COO', true), row(ENERGY, 'APPLICATION', true), row(ENERGY, 'Materials'), row(ENERGY, 'Job Order'), row(ENERGY, '', false, 'Installation'),
  row(POST, 'Tax Dec Site'), row(POST, 'COC - LGU'), row(POST, 'Warrant Bond'), row(POST, '', false, 'FAC'), row(POST, '', false, 'HAND OVER', true),
]
const OTHER = ['CME', 'COLOC', 'RELOC']
const SECS = ['Permitting', 'CME', 'Energization', 'Post-con', 'Billing']
const tplRow = (type: string, r: R, i: number) => [type, r[0], r[1], r[2] ? 'yes' : 'no', r[3], r[4] ? 'yes' : 'no', String(i + 1)]
const TEMPLATE_ROWS: string[][] = [
  ...SAQ1.map((r, i) => tplRow('SAQ1', r, i)), ...SAQ2.map((r, i) => tplRow('SAQ2', r, i)),
  ...OTHER.flatMap(t => SECS.map((s, i) => tplRow(t, row(s, ''), i))),
]
const seedChecklist = (code: string, rows: R[], done: string[], out: string[], date: string): string[][] =>
  rows.map((r, i) => {
    const d = !!r[1] && done.includes(r[1]), o = !!r[3] && out.includes(r[3])
    return [code, r[0], r[1], r[2] ? 'yes' : 'no', d ? 'Done' : 'Pending', d ? date : '', '', r[3], r[4] ? 'yes' : 'no', o ? 'Out' : 'Pending', o ? date : '', String(i + 1)]
  })

const list: ModuleDef[] = [
  def('projects', 'Projects', 'code:code@Site ID,name:text@Site Name,client:text@Client,type:select(SAQ1|SAQ2|CME|COLOC|RELOC)@Project type,site:text@Site Address,poNumber:text@P.O. Number,budget:number@Budget,status:select(Planning|Ongoing|Delayed|Completed|Archived)@Status,~statusBeforeArchive:text',
    [['P-001', 'Dela Cruz 2-Storey Residence', 'Dela Cruz', 'SAQ2', 'Quezon City', '', '1303280', 'Ongoing'], ['P-002', 'Lim Warehouse', 'Lim Corp', 'SAQ2', 'Cavite', '', '3200000', 'Delayed'],
     ['P-003', 'Santos Clinic', 'Santos', 'SAQ1', 'Pasig', '', '2100000', 'Ongoing'], ['P-004', 'Reyes Townhouse', 'Reyes', 'COLOC', 'Makati', '', '1800000', 'Planning']]),
  def('checklist', 'Site checklist', 'project:project,section:text,label:text,key:select(no|yes),status:select(Pending|Done),date:date,remarks:text,out:text,outKey:select(no|yes),outStatus:select(Pending|Out),outDate:date,order:number',
    [...seedChecklist('P-001', SAQ2, ['PROP DOCS', 'LA', 'BP FORMS', 'ZONNING APPLICATION', 'BP APPLICATION', 'CAAP', 'CNC', 'LOT SEG', 'SBT', 'DDD', 'DP', 'LOGBOOK', 'NTP', 'INSURANCE', 'Surety & Performance', 'TOWER FOUNDATION', 'Mill Cert'], ['BP'], '2026-10-05'),
     ...seedChecklist('P-002', SAQ2, ['PROP DOCS', 'LA', 'BP FORMS', 'ZONNING APPLICATION', 'BP APPLICATION', 'CAAP'], [], '2026-09-25'),
     ...seedChecklist('P-003', SAQ1, ['NP from Client', 'PRE VAL', 'SAQR', 'TSSR', 'Social Awareness', 'CD'], ['MOC'], '2026-09-18')]),
  def('templates', 'Checklist templates', 'type:select(SAQ1|SAQ2|CME|COLOC|RELOC)@Type,section:text,label:text@Document,~key:select(no|yes)@Key (red),out:text@OUT,~outKey:select(no|yes)@OUT key (red),order:number', TEMPLATE_ROWS),
  def('progress', 'Progress', 'project:project,milestone:text,percent:number,date:date',
    [['P-001', 'Foundation', '100', '2026-08-30'], ['P-001', 'Columns and beams', '100', '2026-10-01'], ['P-001', '2nd floor slab', '60', '2026-11-05'], ['P-001', 'Walls and roofing', '0', ''], ['P-001', 'Finishing', '0', ''],
     ['P-002', 'Foundation', '100', '2026-09-10'], ['P-002', 'Columns', '70', '2026-11-01'], ['P-002', 'Slab', '20', '2026-11-05'], ['P-002', 'Walls', '0', ''],
     ['P-003', 'Foundation', '100', '2026-08-20'], ['P-003', 'Structure', '100', '2026-10-15'], ['P-003', 'Finishing', '40', '2026-11-05'], ['P-004', 'Site prep', '60', '2026-11-04'], ['P-004', 'Foundation', '0', '']]),
  def('tasks', 'Tasks', 'task:text,project:project,crew:text,due:date,status:select(Todo|Ongoing|Done)',
    [['Rebar tying, 2F slab', 'P-001', 'Crew A', '2026-11-08', 'Ongoing'], ['Concrete pour', 'P-001', 'Crew C', '2026-11-12', 'Todo'], ['Excavation', 'P-001', 'Crew A', '2026-10-01', 'Done'],
     ['Wall framing', 'P-002', 'Crew B', '2026-11-10', 'Ongoing'], ['Roof trusses', 'P-002', 'Crew D', '2026-11-15', 'Todo'], ['Slab pour', 'P-003', 'Crew C', '2026-11-09', 'Done'], ['Site clearing', 'P-004', 'Crew A', '2026-11-08', 'Ongoing']]),
  def('attendance', 'Attendance', 'worker:employee,project:project,date:date,days:number,ot:number,status:select(Pending|Approved)',
    [['J. Reyes', 'P-001', '2026-11-06', '1', '0', 'Approved'], ['A. Cruz', 'P-001', '2026-11-06', '1', '2', 'Approved'], ['P. Tan', 'P-001', '2026-11-06', '1', '1', 'Pending'],
     ['L. Gomez', 'P-002', '2026-11-06', '1', '0', 'Approved'], ['M. Ruiz', 'P-002', '2026-11-06', '1', '1', 'Pending']]),
  def('deliveries', 'Deliveries', 'item:text,supplier:text,project:project,eta:date,status:select(Expected|Received|Delayed)',
    [['Hollow blocks 500pcs', 'BlockCo', 'P-001', '2026-11-07', 'Expected'], ['Steel bars', 'SteelAsia', 'P-002', '2026-11-08', 'Delayed']]),
  def('incidents', 'Incidents', 'report:text,project:project,severity:select(Low|Medium|High),date:date,status:select(Open|Closed)',
    [['Loose scaffolding plank', 'P-001', 'Medium', '2026-11-05', 'Open'], ['Missing PPE on site', 'P-002', 'Low', '2026-11-04', 'Open']]),
  def('purchases', 'Purchases', 'item:text,project:project,supplier:text,amount:number,status:select(Pending|Approved|Received|Rejected)',
    [['Cement 50 bags', 'P-001', 'Holcim Depot', '19500', 'Received'], ['Steel bars 12mm', 'P-001', 'SteelAsia', '84000', 'Pending'], ['Hollow blocks', 'P-002', 'BlockCo', '32000', 'Pending'],
     ['Rebar 16mm', 'P-002', 'SteelAsia', '310000', 'Approved'], ['Paint', 'P-003', 'ColorMart', '45000', 'Approved']]),
  def('approvals', 'Approvals', 'request:text,by:text,type:select(Purchase|Budget|Leave|Transfer|Cash advance|Password reset),status:select(Pending|Approved|Rejected),~module:text,~refId:text',
    [['Budget revision P-003', 'Jose Lim', 'Budget', 'Pending', '', ''], ['Transfer: Generator G-05', 'Ben Ramos', 'Transfer', 'Pending', 'transfers', 'transfers-0'], ['Leave: L. Gomez', 'Maria Santos', 'Leave', 'Pending', 'leaves', 'leaves-0'],
     ['Purchase: Steel bars 12mm', 'Mark Santos', 'Purchase', 'Pending', 'purchases', 'purchases-1'], ['Purchase: Cement 50 bags', 'Mark Santos', 'Purchase', 'Approved', 'purchases', 'purchases-0']]),
  def('budgets', 'Budgets', `project:project,category:${CAT},budget:number`,
    [['P-001', 'Materials', '700000'], ['P-001', 'Labor', '500000'], ['P-002', 'Labor', '400000'], ['P-002', 'Materials', '1500000'], ['P-003', 'Materials', '1100000'], ['P-004', 'Materials', '900000']]),
  def('expenses', 'Expenses', `item:text,project:project,category:${CAT},amount:number,date:date`,
    [['Foundation labor', 'P-001', 'Labor', '180000', '2026-07-30'], ['Steel', 'P-002', 'Materials', '240000', '2026-08-25'], ['Cement', 'P-001', 'Materials', '95000', '2026-09-15'], ['Labor Oct', 'P-001', 'Labor', '291649', '2026-10-31'],
     ['Labor Oct', 'P-002', 'Labor', '420000', '2026-10-31'], ['Permits', 'P-003', 'Other', '35000', '2026-10-12'], ['Site prep', 'P-004', 'Labor', '48000', '2026-10-28'], ['Hauling', 'P-001', 'Other', '6500', '2026-11-02'], ['Mixer rental', 'P-002', 'Equipment', '12000', '2026-11-04']]),
  def('billing', 'Billing', 'invoice:text,project:project,amount:number,due:date,status:select(Draft|Sent|Paid|Overdue)',
    [['INV-0401', 'P-001', '476000', '2026-09-01', 'Paid'], ['INV-0412', 'P-001', '414000', '2026-10-30', 'Overdue'], ['INV-0420', 'P-001', '320000', '2026-11-20', 'Sent'], ['INV-0410', 'P-002', '900000', '2026-10-15', 'Paid'],
     ['INV-0415', 'P-002', '414000', '2026-11-20', 'Sent'], ['INV-0418', 'P-003', '420000', '2026-11-12', 'Sent'], ['INV-0409', 'P-004', '98000', '2026-10-25', 'Overdue'], ['INV-0421', 'P-004', '150000', '2026-11-30', 'Draft']]),
  def('payments', 'Payments', 'client:text,project:project,amount:number,date:date,method:select(GCash|Bank|Cash|Check)',
    [['Dela Cruz', 'P-001', '150000', '2026-07-10', 'Bank'], ['Dela Cruz', 'P-001', '476000', '2026-09-01', 'Bank'], ['Lim Corp', 'P-002', '300000', '2026-08-12', 'GCash'], ['Lim Corp', 'P-002', '900000', '2026-10-15', 'GCash'],
     ['Santos', 'P-003', '210000', '2026-10-20', 'Bank'], ['Reyes', 'P-004', '60000', '2026-10-05', 'Cash']]),
  def('employees', 'Employees', 'name:text,position:text,rate:number,hired:date,project:project,status:select(Active|On leave|Resigned)',
    [['J. Reyes', 'Mason', '750', '2024-02-10', 'P-001', 'Active'], ['A. Cruz', 'Carpenter', '800', '2023-06-01', 'P-001', 'Active'], ['R. Dizon', 'Laborer', '600', '2025-01-15', 'P-001', 'Active'],
     ['P. Tan', 'Mason', '750', '2024-08-20', 'P-001', 'Active'], ['L. Gomez', 'Laborer', '600', '2025-03-03', 'P-002', 'Active'], ['M. Ruiz', 'Electrician', '900', '2026-11-01', 'P-002', 'Active'],
     ['Maria Santos', 'HR Officer', '1500', '2022-04-11', '', 'Active'], ['Liza Cruz', 'Finance Officer', '1500', '2021-09-01', '', 'Active']]),
  def('payroll', 'Payroll', 'employee:employee,period:text,gross:number,deductions:number,status:select(Draft|Approved|Paid)',
    [['J. Reyes', 'Nov 1-15', '9000', '1200', 'Draft'], ['A. Cruz', 'Nov 1-15', '10500', '900', 'Approved']]),
  def('leaves', 'Leaves', 'employee:employee,type:select(Vacation|Sick|Emergency),from:date,to:date,status:select(Pending|Approved|Rejected)',
    [['L. Gomez', 'Vacation', '2026-11-10', '2026-11-12', 'Pending']]),
  def('cashadvance', 'Cash advance', 'worker:employee,amount:number,date:date,status:select(Pending|Approved|Released|Rejected)',
    [['R. Dizon', '1500', '2026-11-05', 'Pending'], ['J. Reyes', '2000', '2026-11-03', 'Released']]),
  def('documents', 'Documents', 'title:text,project:project,type:select(Permit|Contract|Plan|Certificate),expires:date,status:select(Review|Approved|Returned|Expired)',
    [['Building permit', 'P-001', 'Permit', '2027-03-01', 'Approved'], ['Contract', 'P-001', 'Contract', '', 'Approved'], ['Structural plans', 'P-001', 'Plan', '', 'Approved'], ['Insurance cert.', 'P-001', 'Certificate', '2026-11-20', 'Review'],
     ['Building permit', 'P-002', 'Permit', '2027-01-15', 'Approved'], ['Contract rev. 2', 'P-002', 'Contract', '', 'Review'], ['Insurance cert.', 'P-002', 'Certificate', '2026-12-05', 'Approved'],
     ['Contract', 'P-003', 'Contract', '', 'Approved'], ['Excavation plan', 'P-003', 'Plan', '', 'Review'], ['Contract', 'P-004', 'Contract', '', 'Approved']]),
  def('permits', 'Permits', 'permit:text,project:project,agency:text,expires:date,status:select(Pending|Active|Expiring)',
    [['Excavation permit', 'P-001', 'City Hall', '2026-12-01', 'Expiring'], ['Electrical permit', 'P-002', 'LGU', '2027-06-01', 'Active']]),
  def('assets', 'Assets', 'asset:text,code:text,site:text,condition:select(Good|Fair|Repair),status:select(Deployed|Available|Maintenance)',
    [['Excavator', 'EX-02', 'Cavite', 'Good', 'Deployed'], ['Concrete mixer', 'M-11', 'Quezon City', 'Repair', 'Maintenance'], ['Generator', 'G-05', 'Pasig', 'Good', 'Deployed'],
     ['Loader', 'L-03', 'Makati', 'Fair', 'Available'], ['Scaffolding set', 'S-01', 'Quezon City', 'Good', 'Deployed']]),
  def('transfers', 'Transfers', 'asset:text,from:text,to:text,date:date,status:select(Pending|Approved|Done|Rejected)',
    [['Generator G-05', 'Pasig', 'Quezon City', '2026-11-07', 'Pending'], ['Scaffolding set', 'Quezon City', 'Cavite', '2026-11-01', 'Done']]),
]
export const MODULES: Record<string, ModuleDef> = Object.fromEntries(list.map(m => [m.key, m]))

export const SPECIAL_TITLES: Record<string, string> = {
  overview: 'Overview', sitedocs: 'Site documents', 'finance-view': 'Finance (View Only)', reports: 'Reports', audit: 'Audit log', users: 'Users & Roles', settings: 'Settings',
}
export const titleOf = (k: string) => SPECIAL_TITLES[k] ?? MODULES[k]?.title ?? k

export const NAV: Record<Role, string[]> = {
  admin: ['overview', 'projects', 'progress', 'tasks', 'attendance', 'deliveries', 'incidents', 'purchases', 'approvals', 'budgets', 'expenses', 'billing', 'payments', 'payroll', 'employees', 'leaves', 'cashadvance', 'documents', 'sitedocs', 'permits', 'templates', 'assets', 'transfers', 'reports', 'audit', 'users', 'settings'],
  assistant_manager: ['overview', 'projects', 'progress', 'approvals', 'tasks', 'incidents', 'sitedocs', 'reports'],
  site_supervisor: ['overview', 'progress', 'tasks', 'attendance', 'deliveries', 'incidents'],
  foreman: ['overview', 'attendance', 'purchases', 'cashadvance'],
  client: ['overview', 'progress', 'billing', 'documents'],
  documents: ['overview', 'sitedocs', 'documents', 'permits', 'templates'],
  budget: ['overview', 'budgets', 'expenses', 'approvals'],
  asset: ['overview', 'assets', 'transfers'],
  hr: ['overview', 'employees', 'attendance', 'payroll', 'leaves'],
  finance: ['overview', 'billing', 'payments', 'expenses', 'payroll'],
}
export const READ_ONLY: Role[] = ['client']
export const can = (role: Role, page: string) => NAV[role].includes(page)

/** Who may change the status column inline. Missing key = anyone who can edit the module. */
export const STATUS_EDITORS: Record<string, Role[]> = {
  attendance: ['admin', 'hr', 'site_supervisor', 'assistant_manager'],
  approvals: [],
}
/** Creating a Pending record in these modules also raises an approval request linked by (module, refId). */
export const AUTO_APPROVAL: Record<string, { type: string; label: (r: Record<string, string>) => string }> = {
  purchases: { type: 'Purchase', label: r => `Purchase: ${r.item}` },
  transfers: { type: 'Transfer', label: r => `Transfer: ${r.asset}` },
  cashadvance: { type: 'Cash advance', label: r => `Cash advance: ${r.worker}` },
}
export const OPTIONAL_PROJECT = ['employees']

/** Sidebar sections. Roles with a short menu (7 items or fewer) get a flat list instead. */
export const GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Operations', keys: ['projects', 'progress', 'tasks', 'deliveries', 'incidents'] },
  { label: 'Finance', keys: ['purchases', 'approvals', 'budgets', 'expenses', 'billing', 'payments', 'cashadvance'] },
  { label: 'People', keys: ['employees', 'attendance', 'leaves', 'payroll'] },
  { label: 'Documents & assets', keys: ['sitedocs', 'documents', 'permits', 'templates', 'assets', 'transfers'] },
  { label: 'Administration', keys: ['reports', 'audit', 'users', 'settings'] },
]

/** Modules that exist for data only (no menu page, hidden from Reports). */
export const INTERNAL = ['checklist']
