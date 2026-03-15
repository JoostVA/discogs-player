import { useState, useRef } from 'react'

const LS_PLAYLISTS = 'discogs_playlists'
const LS_OVERRIDES = 'yt_overrides'

export default function Settings({ onSave, initialValues = {} }) {
  const [username, setUsername] = useState(initialValues.username ?? '')
  const [token, setToken] = useState(initialValues.token ?? '')
  const [ytKey, setYtKey] = useState(initialValues.ytKey ?? '')
  const [error, setError] = useState('')

  const [importPreview, setImportPreview] = useState(null) // { playlistCount, overrideCount, raw }
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef(null)

  function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !token.trim() || !ytKey.trim()) {
      setError('All fields are required.')
      return
    }
    setError('')
    onSave({ username: username.trim(), token: token.trim(), ytKey: ytKey.trim() })
  }

  // ── Export ────────────────────────────────────────────────────
  function handleExport() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      playlists: JSON.parse(localStorage.getItem(LS_PLAYLISTS) || '{}'),
      overrides: JSON.parse(localStorage.getItem(LS_OVERRIDES) || '{}'),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vinyl-player-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Import: read file ─────────────────────────────────────────
  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    setImportPreview(null)

    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.playlists && !data.overrides) {
          setImportError('Invalid file: no recognisable data found.')
          return
        }
        const playlistCount = Object.keys(data.playlists ?? {}).length
        const overrideCount = Object.keys(data.overrides ?? {}).length
        setImportPreview({ playlistCount, overrideCount, raw: data })
      } catch {
        setImportError('Could not parse file. Make sure it is a valid export.')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // allow re-selecting the same file
  }

  // ── Import: apply ─────────────────────────────────────────────
  function handleApplyImport() {
    if (!importPreview) return
    const { raw } = importPreview
    if (raw.playlists) localStorage.setItem(LS_PLAYLISTS, JSON.stringify(raw.playlists))
    if (raw.overrides) localStorage.setItem(LS_OVERRIDES, JSON.stringify(raw.overrides))
    window.location.reload()
  }

  return (
    <div className="settings-overlay">
      <div className="settings-card">
        <h1 className="settings-title">Vinyl Player</h1>
        <p className="settings-subtitle">Connect your accounts to get started</p>

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="field-group">
            <label className="field-label">Discogs Username</label>
            <input
              className="field-input"
              type="text"
              placeholder="your_discogs_username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="field-group">
            <label className="field-label">
              Discogs Personal Access Token
              <a
                className="field-help-link"
                href="https://www.discogs.com/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get token
              </a>
            </label>
            <input
              className="field-input"
              type="password"
              placeholder="Your Discogs token"
              value={token}
              onChange={e => setToken(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="field-group">
            <label className="field-label">
              YouTube Data API Key
              <a
                className="field-help-link"
                href="https://console.developers.google.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get key
              </a>
            </label>
            <input
              className="field-input"
              type="password"
              placeholder="Your YouTube API key"
              value={ytKey}
              onChange={e => setYtKey(e.target.value)}
              autoComplete="off"
            />
          </div>

          {error && <p className="field-error">{error}</p>}

          <button className="btn-primary" type="submit">
            Open My Collection
          </button>
        </form>

        {/* ── Data transfer ── */}
        <div className="settings-data">
          <h3 className="settings-data__title">Data</h3>
          <p className="settings-data__desc">
            Export your playlists and video overrides to transfer them to another device,
            or keep as a backup.
          </p>

          <div className="settings-data__actions">
            <button type="button" className="btn-secondary" onClick={handleExport}>
              ↓ Export data
            </button>
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              ↑ Import data
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
          </div>

          {importError && (
            <p className="settings-data__error">{importError}</p>
          )}

          {importPreview && (
            <div className="settings-data__preview">
              <p className="settings-data__preview-text">
                Found <strong>{importPreview.playlistCount}</strong> playlist{importPreview.playlistCount !== 1 ? 's' : ''} and{' '}
                <strong>{importPreview.overrideCount}</strong> video override{importPreview.overrideCount !== 1 ? 's' : ''}.
                This will replace your current data.
              </p>
              <div className="settings-data__preview-btns">
                <button type="button" className="btn-primary settings-data__apply" onClick={handleApplyImport}>
                  Apply &amp; Reload
                </button>
                <button type="button" className="btn-secondary" onClick={() => setImportPreview(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="settings-note">
          Your credentials are stored only in your browser's local storage and never sent anywhere except directly to Discogs and Google APIs.
        </p>
      </div>
    </div>
  )
}
