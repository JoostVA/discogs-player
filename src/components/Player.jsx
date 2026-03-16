import { useState, useEffect, useRef } from 'react'
import { searchVideos, formatDuration, parseTrackDuration } from '../services/youtube'
import {
  loadOverrides,
  saveOverride,
  removeOverride,
  makeOverrideKey,
  extractVideoId,
} from '../services/overrides'

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Ccircle cx='24' cy='24' r='24' fill='%23222'/%3E%3Ccircle cx='24' cy='24' r='14' fill='%23111'/%3E%3Ccircle cx='24' cy='24' r='3' fill='%23333'/%3E%3C/svg%3E"

function buildQuery(track, albumInfo) {
  const trackArtist = track.artists
    ?.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ')
    || albumInfo?.artist || ''
  return [trackArtist, track.title, albumInfo?.title, albumInfo?.year]
    .filter(Boolean)
    .join(' ')
}

// ── Singleton: load the YouTube IFrame API script once ────────
let ytApiReadyPromise = null
function loadYTApi() {
  if (ytApiReadyPromise) return ytApiReadyPromise
  if (window.YT?.Player) {
    ytApiReadyPromise = Promise.resolve()
    return ytApiReadyPromise
  }
  ytApiReadyPromise = new Promise(resolve => {
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
    window.onYouTubeIframeAPIReady = resolve
  })
  return ytApiReadyPromise
}

export default function Player({ track, albumInfo, ytKey, isPlaying, overrides, onOverrideChange, onEnded }) {
  const [videoId, setVideoId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isOverridden, setIsOverridden] = useState(false)

  // Picker state
  const [showPicker, setShowPicker] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerResults, setPickerResults] = useState([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState('')
  const [pasteValue, setPasteValue] = useState('')
  const [pasteError, setPasteError] = useState('')

  const ytPlayerRef = useRef(null)      // YT.Player instance
  const playerContainerRef = useRef(null) // div that YT renders its iframe into
  const prevTrackRef = useRef(null)
  const pickerRef = useRef(null)
  const queryInputRef = useRef(null)
  const hasStartedRef = useRef(false)   // true once YT fires "playing" (state 1)
  const onEndedRef = useRef(onEnded)    // always points to latest onEnded callback

  const overrideKey = track && albumInfo?.releaseId
    ? makeOverrideKey(albumInfo.releaseId, track)
    : null

  // ── Auto-search when track changes ──────────────────────────
  useEffect(() => {
    if (!track || !ytKey) return

    const trackKey = `${track.title}_${albumInfo?.artist}`
    if (prevTrackRef.current === trackKey) return
    prevTrackRef.current = trackKey

    setShowPicker(false)
    setVideoId(null)
    setError('')
    setLoading(true)

    const savedOverrides = loadOverrides()
    const overriddenId = overrideKey ? savedOverrides[overrideKey] : null

    if (overriddenId) {
      setVideoId(overriddenId)
      setIsOverridden(true)
      setLoading(false)
      return
    }

    setIsOverridden(false)

    const query = buildQuery(track, albumInfo)
    const trackDurationSec = parseTrackDuration(track.duration)

    searchVideos(query, ytKey, trackDurationSec)
      .then(results => {
        if (results.length) setVideoId(results[0].videoId)
        else setError('No video found.')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [track, albumInfo, ytKey, overrideKey])

  // ── Sync isOverridden when overrides change externally ───────
  useEffect(() => {
    if (!overrideKey) return
    setIsOverridden(!!overrides?.[overrideKey])
  }, [overrides, overrideKey])

  // ── Keep onEndedRef current ──────────────────────────────────
  useEffect(() => { onEndedRef.current = onEnded }, [onEnded])

  // ── Preload the YT IFrame API on mount ───────────────────────
  useEffect(() => { loadYTApi() }, [])

  // ── Create / update YT player when videoId changes ───────────
  useEffect(() => {
    if (!videoId) {
      ytPlayerRef.current?.stopVideo?.()
      return
    }

    hasStartedRef.current = false
    let cancelled = false

    loadYTApi().then(() => {
      if (cancelled || !playerContainerRef.current) return

      if (ytPlayerRef.current?.loadVideoById) {
        // Player already exists — just swap the video
        ytPlayerRef.current.loadVideoById(videoId)
      } else {
        // Create a fresh player inside the container div
        ytPlayerRef.current = new window.YT.Player(playerContainerRef.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, rel: 0 },
          events: {
            onStateChange: (e) => {
              if (e.data === 1) hasStartedRef.current = true   // playing
              if (e.data === 0 && hasStartedRef.current) {    // ended
                hasStartedRef.current = false
                onEndedRef.current?.()
              }
            },
            onError: () => setError('Video could not be loaded.'),
          },
        })
      }
    })

    return () => { cancelled = true }
  }, [videoId])

  // ── Destroy YT player on unmount ────────────────────────────
  useEffect(() => {
    return () => {
      ytPlayerRef.current?.destroy?.()
      ytPlayerRef.current = null
    }
  }, [])

  // ── Play / pause via YT Player API ───────────────────────────
  useEffect(() => {
    const player = ytPlayerRef.current
    if (!player?.playVideo) return
    if (isPlaying) player.playVideo()
    else player.pauseVideo()
  }, [isPlaying, videoId])

  // ── Close picker on click-outside ───────────────────────────
  useEffect(() => {
    if (!showPicker) return
    function handleMouseDown(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [showPicker])

  // ── Picker: open ─────────────────────────────────────────────
  function handlePickerOpen() {
    const query = buildQuery(track, albumInfo)
    setPickerQuery(query)
    setPasteValue('')
    setPasteError('')
    setPickerResults([])
    setPickerError('')
    setShowPicker(true)
    doPickerSearch(query)
    setTimeout(() => queryInputRef.current?.focus(), 50)
  }

  // ── Picker: fetch results ────────────────────────────────────
  async function doPickerSearch(query) {
    if (!query.trim()) return
    setPickerLoading(true)
    setPickerError('')
    setPickerResults([])
    try {
      const trackDurationSec = parseTrackDuration(track?.duration)
      const results = await searchVideos(query.trim(), ytKey, trackDurationSec)
      setPickerResults(results)
      if (!results.length) setPickerError('No results found.')
    } catch (err) {
      setPickerError(err.message)
    } finally {
      setPickerLoading(false)
    }
  }

  // ── Picker: select a result ──────────────────────────────────
  function handlePickResult(vid) {
    saveOverride(overrideKey, vid)
    onOverrideChange()
    setVideoId(vid)
    setIsOverridden(true)
    setShowPicker(false)
    prevTrackRef.current = null
  }

  // ── Picker: paste URL ────────────────────────────────────────
  function handlePasteSave() {
    const vid = extractVideoId(pasteValue)
    if (!vid) { setPasteError('Invalid YouTube URL or ID.'); return }
    handlePickResult(vid)
  }

  // ── Revert to auto-search ────────────────────────────────────
  function handleRevert() {
    removeOverride(overrideKey)
    onOverrideChange()
    setIsOverridden(false)
    prevTrackRef.current = null
    setVideoId(null)
    setError('')
    setLoading(true)

    const query = buildQuery(track, albumInfo)
    const trackDurationSec = parseTrackDuration(track?.duration)

    searchVideos(query, ytKey, trackDurationSec)
      .then(results => {
        if (results.length) setVideoId(results[0].videoId)
        else setError('No video found.')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  if (!track) return null

  const artist = albumInfo?.artist ?? ''
  const coverUrl = albumInfo?.coverUrl || PLACEHOLDER
  const position = track.position ? `${track.position} · ` : ''
  const trackDurationSec = parseTrackDuration(track?.duration)

  return (
    <div className="player-bar">
      {/* ── Left: track info ── */}
      <div className="player-bar__info">
        <img
          className="player-bar__cover"
          src={coverUrl}
          alt={albumInfo?.title ?? ''}
          onError={e => { e.currentTarget.src = PLACEHOLDER }}
        />
        <div className="player-bar__meta">
          {artist && <span className="player-bar__artist">{artist}</span>}
          <span className="player-bar__track">
            {position}{track.title}
          </span>
          {albumInfo?.title && (
            <span className="player-bar__album">
              {albumInfo.title}{albumInfo.year ? ` · ${albumInfo.year}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Center: video ── */}
      <div className="player-bar__video-wrap">
        {loading && (
          <div className="player-bar__status">
            <div className="spinner spinner--small" />
          </div>
        )}
        {error && !loading && (
          <div className="player-bar__status player-bar__status--error">{error}</div>
        )}
        {/* Container is always in DOM so playerContainerRef stays stable */}
        <div
          ref={playerContainerRef}
          className="player-bar__yt-container"
          style={{ visibility: (loading || error || !videoId) ? 'hidden' : 'visible' }}
        />
      </div>

      {/* ── Right: override section ── */}
      <div className="player-bar__override" ref={pickerRef}>

        {/* Search picker (floats above the player bar) */}
        {showPicker && (
          <div className="player-search-picker">
            <div className="player-search-picker__header">
              <input
                ref={queryInputRef}
                className="player-search-picker__query-input"
                value={pickerQuery}
                onChange={e => setPickerQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') doPickerSearch(pickerQuery)
                  if (e.key === 'Escape') setShowPicker(false)
                }}
                placeholder="Search YouTube…"
              />
              <button
                className="player-search-picker__search-btn"
                onClick={() => doPickerSearch(pickerQuery)}
                disabled={pickerLoading}
                title="Search"
              >
                {pickerLoading ? '…' : '⌕'}
              </button>
              <button
                className="player-search-picker__close-btn"
                onClick={() => setShowPicker(false)}
                title="Cancel"
              >✕</button>
            </div>

            <div className="player-search-picker__results">
              {pickerLoading && (
                <div className="player-search-picker__loading">
                  <div className="spinner spinner--small" />
                </div>
              )}
              {pickerError && !pickerLoading && (
                <div className="player-search-picker__error">{pickerError}</div>
              )}
              {!pickerLoading && pickerResults.map(result => {
                const diff = trackDurationSec != null && result.durationSeconds != null
                  ? Math.abs(result.durationSeconds - trackDurationSec)
                  : null
                const isDurationMatch = diff != null && diff <= 15

                return (
                  <button
                    key={result.videoId}
                    className={`player-search-picker__result${isDurationMatch ? ' player-search-picker__result--match' : ''}`}
                    onClick={() => handlePickResult(result.videoId)}
                    title={result.title}
                  >
                    {result.thumbnail
                      ? <img className="player-search-picker__thumb" src={result.thumbnail} alt="" />
                      : <div className="player-search-picker__thumb player-search-picker__thumb--placeholder" />
                    }
                    <div className="player-search-picker__result-info">
                      <div className="player-search-picker__result-title">{result.title}</div>
                      <div className="player-search-picker__result-meta">{result.channelTitle}</div>
                    </div>
                    {result.durationSeconds != null && (
                      <span className={`player-search-picker__result-duration${isDurationMatch ? ' player-search-picker__result-duration--match' : ''}`}>
                        {formatDuration(result.durationSeconds)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="player-search-picker__paste">
              <input
                className="player-search-picker__paste-input"
                type="text"
                placeholder="Or paste YouTube URL…"
                value={pasteValue}
                onChange={e => { setPasteValue(e.target.value); setPasteError('') }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handlePasteSave()
                  if (e.key === 'Escape') setShowPicker(false)
                }}
              />
              <button className="player-search-picker__paste-save" onClick={handlePasteSave}>
                Use
              </button>
              {pasteError && (
                <span className="player-search-picker__paste-error">{pasteError}</span>
              )}
            </div>
          </div>
        )}

        <span className="player-bar__override-hint">
          {isOverridden ? '✎ Custom video' : 'Wrong video?'}
        </span>
        <div className="player-bar__override-actions">
          <button
            className={`player__replace-btn${isOverridden ? ' player__replace-btn--active' : ''}`}
            onClick={handlePickerOpen}
          >
            Replace
          </button>
          {isOverridden && (
            <button className="player__revert-btn" onClick={handleRevert}>
              ↺ Auto-pick
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
