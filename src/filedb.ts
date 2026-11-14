import { isCloud, cloudClient } from './backend/client'
// Tiny IndexedDB wrapper so uploaded files (PDF, images, Office, DWG) survive reloads. Frontend-only demo storage.
const DB = 'tekton_files'
const ST = 'files'
const open = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(ST)
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})
export const putFile = async (id: string, blob: Blob) => {
  if (isCloud) {
    const { error } = await cloudClient().storage.from('erp-documents').upload(id, blob, { upsert: false, contentType: blob.type || 'application/octet-stream' })
    if (error && String((error as { statusCode?: string }).statusCode) !== '409') throw new Error(error.message)
    return
  }
  const db = await open()
  return new Promise<void>((res, rej) => { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(blob, id); t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}
export const getFile = async (id: string) => {
  if (isCloud) {
    const { data, error } = await cloudClient().storage.from('erp-documents').download(id)
    if (error) throw new Error(error.message)
    return data
  }
  const db = await open()
  return new Promise<Blob | undefined>((res, rej) => { const q = db.transaction(ST).objectStore(ST).get(id); q.onsuccess = () => res(q.result as Blob | undefined); q.onerror = () => rej(q.error) })
}
export const delFile = async (id: string) => {
  if (isCloud) {
    const { error } = await cloudClient().storage.from('erp-documents').remove([id])
    if (error) throw new Error(error.message)
    return
  }
  const db = await open()
  return new Promise<void>((res, rej) => { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).delete(id); t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}

export const listFiles = async () => {
  if (isCloud) throw new Error('Use Supabase backups for cloud data.')
  const db = await open()
  return new Promise<{ id: string; blob: Blob }[]>((resolve, reject) => {
    const tx = db.transaction(ST, 'readonly')
    const store = tx.objectStore(ST)
    const keys = store.getAllKeys()
    const values = store.getAll()
    tx.oncomplete = () => {
      db.close()
      resolve(keys.result.map((key, i) => ({ id: String(key), blob: values.result[i] as Blob })))
    }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Could not read uploaded files.")) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Could not read uploaded files.")) }
  })
}

export const deleteFileDatabase = () => new Promise<void>((resolve, reject) => {
  if (isCloud) { reject(new Error('Demo reset is unavailable in Supabase mode.')); return }
  const request = indexedDB.deleteDatabase(DB)
  request.onsuccess = () => resolve()
  request.onerror = () => reject(request.error ?? new Error("Could not remove uploaded files."))
  request.onblocked = () => reject(new Error("Close other Tekton ECA tabs, then try Reset again."))
})
