import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { api } from '../services/api'
import UploadProgress from '../components/UploadProgress'

const MAX_SIZE_MB = 500
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime']

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getDeviceInfo() {
  const ua = navigator.userAgent
  const platform = navigator.platform || ''
  const screen = `${window.screen.width}×${window.screen.height}`
  return {
    osVersion: `${platform} · ${screen}`,
    browser: ua,
    deviceModel: navigator.userAgentData?.platform || platform,
  }
}

// Icons
function VideoIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

function PinIcon({ color = '#16a34a' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function RetakeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
    </svg>
  )
}

export default function CapturePage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetEventId = searchParams.get('event_id')

  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [gps, setGps] = useState({ lat: null, lng: null, status: 'acquiring' })
  const [uploadState, setUploadState] = useState({ active: false, progress: 0, error: null })
  const videoInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  // Redirect if no session
  useEffect(() => {
    if (!session) navigate('/', { replace: true })
  }, [session])

  // Acquire GPS
  useEffect(() => {
    if (!navigator.geolocation) {
      setGps({ lat: null, lng: null, status: 'unavailable' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, status: 'acquired' }),
      () => setGps({ lat: null, lng: null, status: 'unavailable' }),
      { timeout: 10000, maximumAge: 60000 }
    )
  }, [])

  const handleFileSelected = (file) => {
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Unsupported file type. Please select a JPEG, PNG, HEIC, MP4, or MOV file.')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File too large. Maximum allowed size is ${MAX_SIZE_MB} MB.`)
      return
    }
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  const handleRetake = () => {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setUploadState({ active: false, progress: 0, error: null })
  }

  const handleUpload = async () => {
    if (!selectedFile || !session) return
    setUploadState({ active: true, progress: 0, error: null })

    const device = getDeviceInfo()
    const metadata = {
      clientTimestamp: new Date().toISOString(),
      gpsLat: gps.lat,
      gpsLng: gps.lng,
      ...device,
    }
    if (presetEventId) metadata.eventId = presetEventId

    try {
      const result = await api.uploadFile(
        selectedFile,
        session.sessionId,
        metadata,
        (pct) => setUploadState(s => ({ ...s, progress: pct }))
      )
      // Navigate to tag event page, passing upload result via router state
      navigate('/tag', {
        state: {
          assetId: result.asset_id,
          reportToken: result.report_token,
          sha256Hash: result.sha256_hash,
          presetEventId,
        },
      })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Upload failed. Please try again.'
      setUploadState({ active: false, progress: 0, error: msg })
    }
  }

  const isVideo = selectedFile?.type.startsWith('video/')

  return (
    <div className="page">
      {/* Top bar */}
      <div className="topbar">
        <button className="topbar-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div>
          <div className="topbar-title">Capture Evidence</div>
          <div className="topbar-sub">GPS + hash generated automatically</div>
        </div>
      </div>

      {/* Upload progress overlay */}
      {uploadState.active && (
        <UploadProgress
          progress={uploadState.progress}
          error={uploadState.error}
          onRetry={() => setUploadState({ active: false, progress: 0, error: null })}
        />
      )}

      {!selectedFile ? (
        /* ── Selection screen ── */
        <>
          <div className="capture-wrap">
            {/* Record Video */}
            <div
              className="capture-card capture-card-video"
              onClick={() => videoInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && videoInputRef.current?.click()}
            >
              <div className="capture-card-icon icon-bg-green">
                <VideoIcon />
              </div>
              <h3>Record Video</h3>
              <p>Opens camera in video mode</p>
            </div>

            <div className="or-divider">OR</div>

            {/* Select from Gallery */}
            <div
              className="capture-card capture-card-gallery"
              onClick={() => galleryInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && galleryInputRef.current?.click()}
            >
              <div className="capture-card-icon icon-bg-gray">
                <UploadIcon />
              </div>
              <h3>Select from Gallery</h3>
              <p>JPG, PNG, MP4, MOV</p>
            </div>
          </div>

          {/* Location status bar */}
          <div className={`location-bar${gps.status !== 'acquired' ? ' no-location' : ''}`}>
            <PinIcon color={gps.status === 'acquired' ? '#16a34a' : '#9ca3af'} />
            {gps.status === 'acquired'
              ? `Location acquired: ${gps.lat?.toFixed(4)}, ${gps.lng?.toFixed(4)}`
              : gps.status === 'acquiring'
              ? 'Acquiring location…'
              : 'Location unavailable'}
          </div>

          {/* Hidden file inputs */}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => handleFileSelected(e.target.files?.[0])}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime"
            style={{ display: 'none' }}
            onChange={e => handleFileSelected(e.target.files?.[0])}
          />
        </>
      ) : (
        /* ── Review screen ── */
        <div className="review-wrap">
          {/* Media preview */}
          <div className="preview-box">
            {isVideo ? (
              <video src={previewUrl} controls playsInline />
            ) : (
              <img src={previewUrl} alt="Preview" />
            )}
            <button className="preview-retake-btn" onClick={handleRetake} aria-label="Retake">
              <RetakeIcon />
            </button>
          </div>

          {/* File metadata */}
          <div className="file-meta">
            <div className="file-meta-row">
              <span className="file-meta-name">{selectedFile.name}</span>
              <span className="file-meta-size">{formatBytes(selectedFile.size)}</span>
            </div>
            {gps.lat != null && (
              <div className="file-meta-gps">
                <PinIcon />
                {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
              </div>
            )}
          </div>

          {/* Upload error */}
          {uploadState.error && (
            <p className="progress-error">{uploadState.error}</p>
          )}

          {/* Actions */}
          <div className="review-actions">
            <button className="btn btn-secondary" onClick={handleRetake}>Retake</button>
            <button className="btn btn-primary" onClick={handleUpload}>
              Secure Upload
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
