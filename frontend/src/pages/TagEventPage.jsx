import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { api } from '../services/api'
import CreateEventModal from '../components/CreateEventModal'

function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

export default function TagEventPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state || {}
  const { assetId, reportToken, presetEventId } = state

  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState(presetEventId || null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session || !assetId) {
      navigate('/', { replace: true })
      return
    }
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      const data = await api.listEvents()
      setEvents(data.events || [])
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }

  const handleEventCreated = (newEvent) => {
    setEvents(prev => [newEvent, ...prev])
    setSelectedEventId(newEvent.event_code)
    setShowModal(false)
  }

  const handleContinue = async () => {
    if (!selectedEventId) return
    setSubmitting(true)
    setError('')
    try {
      await api.associateEvent(assetId, selectedEventId)
    } catch (err) {
      setError('Could not tag event. Your upload is still saved.')
    } finally {
      setSubmitting(false)
      navigate(`/reports/${reportToken}`)
    }
  }

  const handleSkip = () => {
    navigate(`/reports/${reportToken}`)
  }

  return (
    <div className="page">
      {/* Top bar */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#16a34a' }}><TagIcon /></span>
          <div>
            <div className="topbar-title">Tag an Event</div>
            <div className="topbar-sub">Optional — group related evidence</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="tag-wrap">
        {/* Create New Event card */}
        <button
          className="create-event-card"
          onClick={() => setShowModal(true)}
          type="button"
        >
          <div className="create-icon"><PlusIcon /></div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <h4>Create New Event</h4>
            <p>Add a name and description</p>
          </div>
          <span className="create-event-chevron">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </span>
        </button>

        {/* Existing Events */}
        <div className="section-label">Existing Events</div>

        {loading ? (
          <div className="loading-center" style={{ padding: '32px 0' }}>
            <div className="spinner" />
          </div>
        ) : events.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
            No events yet. Create one above to group your evidence.
          </p>
        ) : (
          events.map(ev => (
            <button
              key={ev.id}
              className={`event-radio-item${selectedEventId === ev.event_code ? ' selected' : ''}`}
              onClick={() => setSelectedEventId(
                selectedEventId === ev.event_code ? null : ev.event_code
              )}
              type="button"
            >
              <div className="radio-circle">
                <span className="radio-check"><CheckIcon /></span>
              </div>
              <div className="event-radio-info">
                <h4>{ev.name}</h4>
                {ev.description && <p>{ev.description}</p>}
              </div>
            </button>
          ))
        )}

        {error && <p className="progress-error">{error}</p>}

        {/* Bottom padding so fixed actions don't overlap */}
        <div style={{ height: 130 }} />
      </div>

      {/* Fixed action area */}
      <div className="tag-actions">
        {selectedEventId ? (
          <button
            className="btn btn-primary"
            onClick={handleContinue}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Continue with Selected'}
            {!submitting && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            )}
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={handleSkip} style={{ color: 'var(--gray-500)' }}>
            Skip for now
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        )}
      </div>

      {/* Create Event Modal */}
      {showModal && (
        <CreateEventModal
          onClose={() => setShowModal(false)}
          onCreated={handleEventCreated}
        />
      )}
    </div>
  )
}
