import { useRef, useState } from 'react'
import { useStore } from '../store'
import { ROLES } from '../roles'
import { Avatar, Ic, PasswordInput, Strength } from '../ui'
import { toAvatar } from '../image'
import { Btn, useAction, useToast } from '../ux'

export function ProfilePage() {
  const { me, updateName, changePassword, setAvatar } = useStore()
  const toast = useToast()
  const a1 = useAction(), a2 = useAction(), a3 = useAction()
  const file = useRef<HTMLInputElement>(null)
  const [photoErr, setPhotoErr] = useState('')
  const [name, setName] = useState(me?.name ?? '')
  const [nameErr, setNameErr] = useState('')
  const [cur, setCur] = useState(''), [nw, setNw] = useState(''), [cf, setCf] = useState('')
  const [pwErr, setPwErr] = useState('')
  if (!me) return null
  const saveName = () => {
    if (!name.trim()) return setNameErr('Name cannot be empty.')
    setNameErr('')
    void a1.run(() => updateName(name.trim()), 'Profile updated')
  }
  const pick = async (f?: File) => {
    if (!f) return
    setPhotoErr('')
    let url = ''
    try { url = await toAvatar(f) } catch (e) { return setPhotoErr(e instanceof Error ? e.message : 'Could not read that image.') }
    void a3.run(() => setAvatar(url), 'Profile photo updated')
  }
  const savePw = async () => {
    if (nw !== cf) return setPwErr('New passwords do not match.')
    setPwErr('')
    const res = { e: null as string | null }
    const ok = await a2.run(() => { res.e = changePassword(cur, nw) })
    if (!ok) return
    if (res.e) return setPwErr(res.e)
    setCur(''); setNw(''); setCf(''); toast.success('Password changed')
  }
  return (
    <>
      <h1>My profile</h1><p className="muted">Iyong account details at password.</p>
      <div className="g21">
        <div className="card form">
          <div className="avup">
            <button type="button" className="avbig" onClick={() => file.current?.click()} aria-label="Change profile photo" title="Change photo"><Avatar name={me.name} src={me.avatar} size={96} /><span className="avcam"><Ic k="camera" s={15} /></span></button>
            <div className="avinfo">
              <span className="chip">{ROLES[me.role].label}</span>
              <div className="row"><Btn className="sm" busy={a3.pending} onClick={() => file.current?.click()}>{me.avatar ? 'Change photo' : 'Upload photo'}</Btn>
                {me.avatar && <button className="ghost sm" disabled={a3.pending} onClick={() => void a3.run(() => setAvatar(''), 'Profile photo removed')}>Remove</button>}</div>
              <span className="muted hint">JPG, PNG or WebP · cropped to a square · max 8 MB</span>
              {photoErr && <span className="formerr">{photoErr}</span>}
            </div>
            <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          <label><span className="muted">Full name</span><input value={name} onChange={e => setName(e.target.value)} /></label>
          <label><span className="muted">Email</span><input value={me.email} readOnly /></label>
          <label><span className="muted">Assigned project</span><input value={me.project ?? 'All projects'} readOnly /></label>
          <div className="row"><Btn busy={a1.pending} onClick={saveName}>Save changes</Btn>{nameErr && <span className="formerr">{nameErr}</span>}</div>
        </div>
        <div className="card form">
          <h3>Change password</h3>
          <label><span className="muted">Current password</span><PasswordInput autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} /></label>
          <label><span className="muted">New password</span><PasswordInput autoComplete="new-password" value={nw} onChange={e => setNw(e.target.value)} />{nw && <Strength v={nw} />}</label>
          <label><span className="muted">Confirm new password</span><PasswordInput autoComplete="new-password" value={cf} onChange={e => setCf(e.target.value)} /></label>
          <div className="row"><Btn busy={a2.pending} onClick={savePw}>Update password</Btn>{pwErr && <span className="formerr">{pwErr}</span>}</div>
        </div>
      </div>
    </>
  )
}
