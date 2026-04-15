import { useState, useEffect } from 'react'
import { api } from '../services/api'

function formatDateTime(isoStr) {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'UTC', hour12: false,
    })
  } catch { return isoStr }
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function truncateHash(hash) {
  if (!hash) return '—'
  return `${hash.substring(0, 12)}…${hash.substring(hash.length - 8)}`
}

const APP_QR_URL = `${import.meta.env.VITE_API_URL || ''}/api/app-entry-qrcode`

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [stats, setStats] = useState(null)
  const [uploads, setUploads] = useState([])
  const [events, setEvents] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('uploads')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setAuthError('')
    try {
      const s = await api.adminStats(secret)
      setStats(s)
      setAuthed(true)
      loadAll(secret)
    } catch {
      setAuthError('Invalid admin credentials.')
    } finally {
      setLoading(false)
    }
  }

  const loadAll = async (s) => {
    const [u, ev, r] = await Promise.all([
      api.adminUploads(s),
      api.adminEvents(s),
      api.adminReports(s),
    ])
    setUploads(u)
    setEvents(ev)
    setReports(r)
  }

  if (!authed) {
    return (
      <div className="page">
        <div className="topbar">
          <div className="topbar-title">Admin Panel</div>
        </div>
        <div className="admin-login">
          <div className="card">
            <div className="card-label">Admin Access</div>
            <div className="card-sub">Enter your admin secret to continue</div>
            <form onSubmit={handleLogin}>
              <div className="form-field">
                <label htmlFor="secret">Admin Secret</label>
                <input
                  id="secret"
                  type="password"
                  placeholder="••••••••"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {authError && <p className="progress-error" style={{ marginBottom: 12 }}>{authError}</p>}
              <button className="btn btn-primary" type="submit" disabled={loading || !secret}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-title">Admin Panel</div>
        <div className="topbar-right" style={{ display: 'flex', gap: 8 }}>
          <a href={APP_QR_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            App QR
          </a>
        </div>
      </div>

      <div className="admin-wrap">
        {/* Stats */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <h2>{stats.total_uploads}</h2>
              <p>Total Uploads</p>
            </div>
            <div className="stat-card">
              <h2>{stats.total_events}</h2>
              <p>Events</p>
            </div>
            <div className="stat-card">
              <h2>{stats.total_reports}</h2>
              <p>Reports</p>
            </div>
            <div className="stat-card">
              <h2>{stats.total_sessions}</h2>
              <p>Sessions</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[['uploads', 'Uploads'], ['events', 'Events'], ['reports', 'Reports']].map(([key, label]) => (
            <button
              key={key}
              className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Uploads table */}
        {tab === 'uploads' && (
          <div className="admin-section">
            <h2>Recent Uploads ({uploads.length})</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Hash</th>
                    <th>Size</th>
                    <th>Type</th>
                    <th>GPS</th>
                    <th>Event</th>
                    <th>Session</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.original_filename}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {truncateHash(u.sha256_hash)}
                      </td>
                      <td>{formatBytes(u.file_size_bytes)}</td>
                      <td><span className="badge badge-gray">{u.mime_type?.split('/')[1]}</span></td>
                      <td>
                        {u.gps_lat != null
                          ? `${u.gps_lat.toFixed(4)}, ${u.gps_lng.toFixed(4)}`
                          : '—'}
                      </td>
                      <td>
                        {u.event_name
                          ? <span className="badge badge-green">{u.event_name}</span>
                          : '—'}
                      </td>
                      <td>{u.session_display_name || '—'}</td>
                      <td>{formatDateTime(u.server_timestamp_utc)}</td>
                    </tr>
                  ))}
                  {uploads.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>No uploads yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Events table */}
        {tab === 'events' && (
          <div className="admin-section">
            <h2>Events ({events.length})</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Contributions</th>
                    <th>QR Code</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id}>
                      <td style={{ fontWeight: 500 }}>{ev.name}</td>
                      <td><span className="badge badge-gray">{ev.event_code}</span></td>
                      <td style={{ color: 'var(--gray-400)' }}>{ev.description || '—'}</td>
                      <td>{ev.asset_count}</td>
                      <td>
                        <a
                          href={`${import.meta.env.VITE_API_URL || ''}/api/events/${ev.event_code}/qrcode`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--green-600)', fontWeight: 500 }}
                        >
                          View QR
                        </a>
                      </td>
                      <td>{formatDateTime(ev.created_at)}</td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>No events yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reports table */}
        {tab === 'reports' && (
          <div className="admin-section">
            <h2>Evidence Reports ({reports.length})</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Report Link</th>
                    <th>Views</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id}>
                      <td>{r.asset_filename || '—'}</td>
                      <td>
                        <a
                          href={`/reports/${r.report_url_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--green-600)', fontFamily: 'monospace', fontSize: '0.75rem' }}
                        >
                          {r.report_url_token.substring(0, 16)}…
                        </a>
                      </td>
                      <td>{r.view_count}</td>
                      <td>{formatDateTime(r.created_at)}</td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>No reports yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
