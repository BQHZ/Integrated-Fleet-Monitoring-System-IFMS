import { useEffect, useState } from 'react'
import { adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser } from '../../auth/adminApi.js'
import Modal, { fieldStyle, labelStyle, primaryBtn, secondaryBtn, dangerBtn } from './Modal.jsx'

const EMPTY = { username: '', password: '', role: 'roc_dispatcher', site: 'MTBU', name: '' }

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)  // null | {mode:'create'|'edit', data:...}
  const [pwReset, setPwReset] = useState(null)  // {user, newPassword}

  const reload = async () => {
    setLoading(true)
    try {
      setUsers(await adminListUsers())
      setError(null)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [])

  const onSave = async (form) => {
    try {
      if (editing.mode === 'create') {
        await adminCreateUser(form)
      } else {
        const patch = { ...form }
        delete patch.username
        if (!patch.password) delete patch.password
        await adminUpdateUser(editing.data.id, patch)
      }
      setEditing(null)
      await reload()
    } catch (e) {
      alert(e.response?.data?.detail || e.message)
    }
  }

  const onToggleDisabled = async (u) => {
    if (!confirm(`${u.disabled ? 'Aktifkan' : 'Nonaktifkan'} user ${u.username}?`)) return
    try {
      await adminUpdateUser(u.id, { disabled: !u.disabled })
      reload()
    } catch (e) { alert(e.response?.data?.detail || e.message) }
  }

  const onDelete = async (u) => {
    if (!confirm(`Hapus user ${u.username} permanen?`)) return
    try {
      await adminDeleteUser(u.id)
      reload()
    } catch (e) { alert(e.response?.data?.detail || e.message) }
  }

  const onResetPassword = async () => {
    if (!pwReset.newPassword || pwReset.newPassword.length < 4) {
      alert('Password minimal 4 karakter')
      return
    }
    try {
      await adminUpdateUser(pwReset.user.id, { password: pwReset.newPassword })
      setPwReset(null)
      alert('Password berhasil di-reset')
    } catch (e) { alert(e.response?.data?.detail || e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>User Management</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Kelola akun super_admin & roc_dispatcher</div>
        </div>
        <button style={primaryBtn} onClick={() => setEditing({ mode: 'create', data: EMPTY })}>
          + Tambah User
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading && <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Memuat...</div>}
        {error && <div style={{ padding: 16, color: '#C41E3A' }}>Error: {error}</div>}
        {!loading && !error && (
          <table className="data-table">
            <thead><tr>
              <th>Username</th><th>Nama</th><th>Role</th><th>Site</th><th>Status</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ background: u.disabled ? '#FFF5F5' : undefined }}>
                  <td style={{ fontWeight: 700 }}>{u.username}</td>
                  <td>{u.name}</td>
                  <td>
                    <span style={{
                      background: u.role === 'super_admin' ? '#EDE9FE' : '#DBEAFE',
                      color: u.role === 'super_admin' ? '#5B21B6' : '#1D4ED8',
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    }}>{u.role === 'super_admin' ? 'SUPER ADMIN' : 'DISPATCHER'}</span>
                  </td>
                  <td style={{ fontSize: 12, color: '#64748B' }}>{u.site || '—'}</td>
                  <td>
                    {u.disabled ? (
                      <span style={{ color: '#C41E3A', fontSize: 12, fontWeight: 600 }}>Disabled</span>
                    ) : (
                      <span style={{ color: '#00875A', fontSize: 12, fontWeight: 600 }}>Active</span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button style={{ ...secondaryBtn, padding: '4px 8px', fontSize: 11 }}
                      onClick={() => setEditing({ mode: 'edit', data: { ...u, password: '' } })}>
                      Edit
                    </button>
                    <button style={{ ...secondaryBtn, padding: '4px 8px', fontSize: 11 }}
                      onClick={() => setPwReset({ user: u, newPassword: '' })}>
                      Reset PW
                    </button>
                    <button style={{ ...secondaryBtn, padding: '4px 8px', fontSize: 11 }}
                      onClick={() => onToggleDisabled(u)}>
                      {u.disabled ? 'Enable' : 'Disable'}
                    </button>
                    <button style={{ ...dangerBtn, padding: '4px 8px', fontSize: 11 }}
                      onClick={() => onDelete(u)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && <UserForm initial={editing.data} mode={editing.mode}
        onSave={onSave} onCancel={() => setEditing(null)} />}

      {pwReset && (
        <Modal title={`Reset Password — ${pwReset.user.username}`} onClose={() => setPwReset(null)}>
          <label style={labelStyle}>Password Baru
            <input autoFocus type="password" value={pwReset.newPassword}
              onChange={e => setPwReset({ ...pwReset, newPassword: e.target.value })}
              style={fieldStyle} />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={secondaryBtn} onClick={() => setPwReset(null)}>Batal</button>
            <button style={primaryBtn} onClick={onResetPassword}>Reset</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function UserForm({ initial, mode, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const update = (k, v) => setForm({ ...form, [k]: v })

  const submit = (e) => {
    e.preventDefault()
    if (mode === 'create' && (!form.username || !form.password)) {
      alert('Username dan password wajib')
      return
    }
    onSave(form)
  }

  return (
    <Modal title={mode === 'create' ? 'Tambah User Baru' : `Edit User — ${initial.username}`}
      onClose={onCancel}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={labelStyle}>Username
          <input value={form.username} onChange={e => update('username', e.target.value)}
            disabled={mode === 'edit'} style={fieldStyle} required />
        </label>
        <label style={labelStyle}>Nama Tampilan
          <input value={form.name} onChange={e => update('name', e.target.value)} style={fieldStyle} required />
        </label>
        <label style={labelStyle}>Role
          <select value={form.role} onChange={e => update('role', e.target.value)} style={fieldStyle}>
            <option value="super_admin">super_admin</option>
            <option value="roc_dispatcher">roc_dispatcher</option>
          </select>
        </label>
        <label style={labelStyle}>Site (kosongkan kalau super_admin)
          <select value={form.site || ''} onChange={e => update('site', e.target.value || null)} style={fieldStyle}>
            <option value="">— None —</option>
            <option value="MTBU">MTBU</option>
            <option value="ADRO">ADRO</option>
          </select>
        </label>
        {mode === 'create' && (
          <label style={labelStyle}>Password
            <input type="password" value={form.password}
              onChange={e => update('password', e.target.value)} style={fieldStyle} required />
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" style={secondaryBtn} onClick={onCancel}>Batal</button>
          <button type="submit" style={primaryBtn}>{mode === 'create' ? 'Buat' : 'Simpan'}</button>
        </div>
      </form>
    </Modal>
  )
}
