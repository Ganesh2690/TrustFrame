import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'

const API_BASE = import.meta.env.VITE_API_URL || ''

function formatDateTime(isoStr) {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'UTC',
      hour12: false,
    }) + ' UTC'
  } catch {
    return isoStr
  }
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ShieldCheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

function useCopy(text, timeout = 2000) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), timeout)
    } catch {
      // Fallback
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), timeout)
    }
  }
  return [copied, copy]
}

export default function EvidenceReportPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reportUrl = `${window.location.origin}/reports/${token}`
  const [hashCopied, copyHash] = useCopy(report?.sha256_hash || '')
  const [linkCopied, copyLink] = useCopy(reportUrl)

  useEffect(() => {
    loadReport()
  }, [token])

  const loadReport = async () => {
    try {
      const data = await api.getReport(token)
      setReport(data)
    } catch (err) {
      setError(err.response?.status === 404 ? 'Report not found.' : 'Could not load report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TrustFrame Evidence Report',
          text: 'Cryptographically verified evidence report',
          url: reportUrl,
        })
        return
      } catch {
        // Fall through to clipboard copy
      }
    }
    copyLink()
  }

  const mediaUrl = report?.media_url
    ? (report.media_url.startsWith('http') ? report.media_url : `${API_BASE}${report.media_url}`)
    : null

  const isVideo = report?.mime_type?.startsWith('video/')

  if (loading) {
    return (
      <div className="page">
        <div className="topbar">
          <div className="topbar-title">Evidence Report</div>
        </div>
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <div className="topbar">
          <button className="topbar-back" onClick={() => navigate('/')} aria-label="Home">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div className="topbar-title">Evidence Report</div>
        </div>
        <div className="error-state">
          <h2>Report Unavailable</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Top bar */}
      <div className="topbar">
        <button className="topbar-back" onClick={() => navigate('/')} aria-label="Home">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div className="topbar-title">Evidence Report</div>
        <div className="topbar-right">
          <button className="share-fab" onClick={handleShare}>
            <ShareIcon /> Share
          </button>
        </div>
      </div>

      <div className="report-wrap">
        {/* Cryptographically Verified banner */}
        <div className="verified-banner">
          <span className="verified-banner-icon"><ShieldCheckIcon /></span>
          <div>
            <h3>Cryptographically Verified</h3>
            <p>This report contains cryptographic verification and metadata integrity protection.</p>
          </div>
        </div>

        {/* Media preview */}
        {mediaUrl && (
          <div className="media-preview-box">
            {isVideo ? (
              <video src={mediaUrl} controls playsInline />
            ) : (
              <img src={mediaUrl} alt={report.original_filename} />
            )}
          </div>
        )}

        {/* SHA-256 Hash */}
        <div className="hash-box">
          <div className="hash-box-header">
            <span className="hash-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
                <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
              </svg>
              SHA-256 HASH
            </span>
            <button
              className={`copy-btn${hashCopied ? ' copied' : ''}`}
              onClick={copyHash}
            >
              <CopyIcon /> {hashCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="hash-value">{report.sha256_hash}</div>
        </div>

        {/* Metadata card */}
        <div className="meta-card">
          {/* Captured at */}
          <div className="meta-row">
            <span className="meta-row-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </span>
            <div>
              <div className="meta-row-label">Captured At</div>
              <div className="meta-row-value">{formatDateTime(report.server_timestamp_utc)}</div>
            </div>
          </div>

          {/* GPS */}
          {report.gps_lat != null && (
            <div className="meta-row">
              <span className="meta-row-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </span>
              <div>
                <div className="meta-row-label">GPS Coordinates</div>
                <div className="meta-row-value">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${report.gps_lat}&mlon=${report.gps_lng}&zoom=16`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {report.gps_lat.toFixed(6)}, {report.gps_lng.toFixed(6)}
                    {' '}<ExternalLinkIcon />
                  </a>
                  {report.gps_address && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: 2 }}>
                      {report.gps_address}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Device Platform */}
          <div className="meta-row">
            <span className="meta-row-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
            </span>
            <div>
              <div className="meta-row-label">Device Platform</div>
              <div className="meta-row-value">{report.os_version || '—'}</div>
            </div>
          </div>

          {/* File info */}
          <div className="meta-row">
            <span className="meta-row-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
              </svg>
            </span>
            <div>
              <div className="meta-row-label">File</div>
              <div className="meta-row-value">
                {report.original_filename}
                {' · '}{formatBytes(report.file_size_bytes)}
                {report.width && report.height && ` · ${report.width}×${report.height}`}
                {report.duration_seconds && ` · ${report.duration_seconds.toFixed(1)}s`}
              </div>
            </div>
          </div>

          {/* Event context */}
          {report.event && (
            <div className="meta-row">
              <span className="meta-row-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
              </span>
              <div>
                <div className="meta-row-label">Event</div>
                <div className="meta-row-value">
                  {report.event.name}
                  {report.event.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: 2 }}>
                      {report.event.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Copy Shareable Link */}
        <div className="share-card" onClick={copyLink} role="button" tabIndex={0}>
          <div className="share-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </div>
          <div className="share-card-info">
            <h4>{linkCopied ? 'Link Copied!' : 'Copy Shareable Link'}</h4>
            <p>/reports/{token}?token=…</p>
          </div>
          <span className="share-card-arrow"><ExternalLinkIcon /></span>
        </div>

        {/* Tamper resistance notice */}
        <p className="tamper-notice">
          This media was hashed at the point of capture. Any modification to the original file
          will produce a different hash, making tampering immediately detectable.
          SHA-256: <strong>{report.sha256_hash.substring(0, 16)}…</strong>
        </p>

        {/* Chain of custody */}
        {report.custody_chain?.length > 0 && (
          <div className="chain-section">
            <div className="chain-section-header">Chain of Custody</div>
            {report.custody_chain.map(ce => (
              <div key={ce.id} className="chain-event">
                <div className="chain-dot" />
                <div>
                  <div className="chain-event-type">{ce.event_type}</div>
                  <div className="chain-event-time">{formatDateTime(ce.timestamp_utc)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
