export default function UploadProgress({ progress, error, onRetry }) {
  return (
    <div className="progress-overlay">
      {!error ? (
        <>
          <div className="progress-title">Securing your evidence…</div>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-pct">{progress}% — Computing SHA-256 hash</div>
        </>
      ) : (
        <>
          <p className="progress-error">{error}</p>
          <button className="btn btn-secondary" onClick={onRetry} style={{ maxWidth: 200 }}>
            Try Again
          </button>
        </>
      )}
    </div>
  )
}
