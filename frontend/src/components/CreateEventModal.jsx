import { useState } from 'react'
import { api } from '../services/api'

export default function CreateEventModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Event name is required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const newEvent = await api.createEvent(name.trim(), description.trim() || null)
      onCreated(newEvent)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 id="modal-title">New Event</h3>
        <form onSubmit={handleSave}>
          <div className="form-field">
            <label htmlFor="event-name">Event Name</label>
            <input
              id="event-name"
              type="text"
              placeholder="e.g. City Hall Protest"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-field">
            <label htmlFor="event-desc">Description (Optional)</label>
            <textarea
              id="event-desc"
              placeholder="Additional context…"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="progress-error" style={{ marginBottom: 12 }}>{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Saving…' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
