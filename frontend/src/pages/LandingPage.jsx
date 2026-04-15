import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

// Shield icon SVG
function ShieldIcon({ size = 36, color = '#16a34a' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

export default function LandingPage() {
  const { session, startSession } = useSession()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('event_id')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStart = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await startSession(name.trim(), phone.trim())
      const dest = eventId ? `/capture?event_id=${eventId}` : '/capture'
      navigate(dest)
    } catch (err) {
      setError('Could not start session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCapture = () => {
    const dest = eventId ? `/capture?event_id=${eventId}` : '/capture'
    navigate(dest)
  }

  return (
    <div className="page" style={{ position: 'relative' }}>
      {/* Map-like background */}
      <div className="landing-bg" aria-hidden="true">
        <div className="road-overlay">
          <div className="road-h" style={{ top: '18%' }} />
          <div className="road-h" style={{ top: '34%' }} />
          <div className="road-h" style={{ top: '52%' }} />
          <div className="road-h" style={{ top: '70%' }} />
          <div className="road-h" style={{ top: '84%' }} />
          <div className="road-v" style={{ left: '15%' }} />
          <div className="road-v" style={{ left: '38%' }} />
          <div className="road-v" style={{ left: '62%' }} />
          <div className="road-v" style={{ left: '80%' }} />
        </div>
      </div>

      {/* Header */}
      <nav className="topbar" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}>
        <span className="topbar-logo">
          <ShieldIcon size={20} />
          TrustFrame
        </span>
        <button
          className="btn-ghost btn btn-sm"
          style={{ width: 'auto', marginLeft: 'auto' }}
          onClick={() => navigate('/admin')}
          title="Admin"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
        </button>
      </nav>

      {/* Main content */}
      <div className="page-center" style={{ position: 'relative', zIndex: 1 }}>
        <div className="landing-content">
          {/* Hero */}
          <div className="hero-area">
            <div className="shield-icon-wrap">
              <ShieldIcon size={36} />
              <span className="shield-dot" />
            </div>
            <h1 className="hero-title">Tamper-Proof<br />Evidence, Now</h1>
            <p className="hero-sub">
              Record what matters. Your footage is sealed the moment it leaves
              your hands — making it court-ready from the start.
            </p>
          </div>

          {/* Session form OR capture CTA */}
          {session ? (
            <div style={{ width: '100%' }}>
              <button className="btn btn-primary" onClick={handleCapture}>
                Capture or Upload
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
              <p className="session-hint" style={{ marginTop: 10 }}>
                Session active — no login required
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: '24px' }}>
              <div className="card-label">Start Your Session</div>
              <div className="card-sub">Optional — helps link your reports</div>
              <form onSubmit={handleStart}>
                <div className="form-field">
                  <label htmlFor="name">Full Name (Optional)</label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="phone">Phone Number (Optional)</label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
                {error && <p className="progress-error" style={{ marginBottom: 12 }}>{error}</p>}
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Starting…' : 'Start Secure Session'}
                  {!loading && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
