import test from 'node:test'
import assert from 'node:assert/strict'
import { projectReferences } from '../src/metrics.ts'

test('project reference breakdown includes checklist, workflow rows, and user assignments', () => {
  const data = {
    projects: [{ id: 'p1', code: 'P-001' }],
    checklist: [{ id: 'c1', project: 'P-001' }, { id: 'c2', project: 'P-001' }],
    documents: [{ id: 'd1', project: 'P-001' }],
    approvals: [{ id: 'a1', project: 'P-001' }],
    templates: [{ id: 't1', type: 'SAQ1' }],
  }
  const users = [
    { project: 'P-001', financeViewProject: undefined },
    { project: undefined, financeViewProject: 'P-001' },
    { project: undefined, financeViewProject: 'all' },
  ]
  assert.deepEqual(projectReferences(data, 'P-001', users), [
    { key: 'checklist', label: 'Site checklist', count: 2 },
    { key: 'documents', label: 'Documents', count: 1 },
    { key: 'approvals', label: 'Approvals', count: 1 },
    { key: 'user-access', label: 'User project / finance access', count: 2 },
  ])
})

test('a project with no child records or assigned user access can be deleted', () => {
  assert.deepEqual(projectReferences({ projects: [{ id: 'p1', code: 'P-001' }], tasks: [], templates: [{ id: 't1' }] }, 'P-001'), [])
})
