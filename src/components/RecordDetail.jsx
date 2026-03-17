import { useState, useEffect, useMemo } from 'react'
import { fetchRelease } from '../services/discogs'
import { makeOverrideKey } from '../services/overrides'
import { countryFlag } from '../utils/countryFlag'
import TrackList from './TrackList'
import AddToPlaylistPopover from './AddToPlaylistPopover'

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Ccircle cx='150' cy='150' r='150' fill='%23222'/%3E%3Ccircle cx='150' cy='150' r='90' fill='%23111'/%3E%3Ccircle cx='150' cy='150' r='12' fill='%23333'/%3E%3C/svg%3E"

export default function RecordDetail({
  release, token, currentTrack,
  overrides, isPlaying, onPlay, onTogglePlay, onClose,
  playlists, onPlaylistsChange,
  tags, onTagsChange,
}) {
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPlaylistPopover, setShowPlaylistPopover] = useState(false)

  const info = release.basic_information
  const releaseId = info.id
  const artist = info.artists?.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ') ?? 'Unknown Artist'
  const title = info.title ?? 'Unknown Title'
  const year = info.year || null
  const coverUrl = info.cover_image && !info.cover_image.includes('spacer.gif')
    ? info.cover_image
    : PLACEHOLDER

  useEffect(() => {
    setDetails(null)
    setError('')
    setLoading(true)

    fetchRelease(releaseId, token)
      .then(data => setDetails(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [releaseId, token])

  const tracks = details?.tracklist?.filter(t => t.type_ !== 'index') ?? []

  const label = details?.labels?.[0]
    ? [details.labels[0].name, details.labels[0].catno].filter(Boolean).join(' – ')
    : null
  const country = details?.country ?? null

  const overrideKeys = useMemo(() => {
    if (!overrides) return new Set()
    return new Set(
      tracks
        .filter(t => overrides[makeOverrideKey(releaseId, t)])
        .map(t => makeOverrideKey(releaseId, t))
    )
  }, [overrides, tracks, releaseId])

  return (
    <div className="record-detail">
      <div className="record-detail__header">
        <img
          className="record-detail__cover"
          src={coverUrl}
          alt={`${artist} — ${title}`}
          onError={e => { e.currentTarget.src = PLACEHOLDER }}
        />
        <div className="record-detail__meta">
          <p className="record-detail__artist">{artist}</p>
          <h2 className="record-detail__title">{title}</h2>
          {year && <p className="record-detail__year">{year}</p>}
          {label && <p className="record-detail__label">🏷 {label}</p>}
          {country && (
            <p className="record-detail__country">
              {countryFlag(country)
                ? <span className="record-detail__flag">{countryFlag(country)}</span>
                : <span className="record-detail__flag record-detail__flag--pin">📍</span>
              }
              {country}
            </p>
          )}
          {details?.genres?.length > 0 && (
            <p className="record-detail__genres">{details.genres.join(' · ')}</p>
          )}
          {details?.styles?.length > 0 && (
            <p className="record-detail__styles">{details.styles.join(' · ')}</p>
          )}
          {playlists !== undefined && (
            <div style={{ position: 'relative', marginTop: '4px' }}>
              <button
                className="record-detail__add-playlist-btn"
                onClick={() => setShowPlaylistPopover(p => !p)}
                title="Add to playlist"
              >
                ♫ Add to playlist
              </button>
              {showPlaylistPopover && (
                <AddToPlaylistPopover
                  release={release}
                  playlists={playlists}
                  onPlaylistsChange={onPlaylistsChange}
                  onClose={() => setShowPlaylistPopover(false)}
                />
              )}
            </div>
          )}
        </div>
        <button className="record-detail__close" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="record-detail__tracks">
        {loading && (
          <div className="spinner-wrap">
            <div className="spinner" />
          </div>
        )}
        {error && (
          <p className="error-banner">{error}</p>
        )}
        {!loading && !error && tracks.length === 0 && (
          <p className="empty-state">No tracks found for this release.</p>
        )}
        {tracks.length > 0 && (
          <TrackList
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            overrideKeys={overrideKeys}
            releaseId={releaseId}
            onPlay={(track, idx) => onPlay(
              track,
              { artist, title, coverUrl, year, releaseId },
              { type: 'record', releaseId, currentIndex: idx },
            )}
            onTogglePlay={onTogglePlay}
            tags={tags}
            onTagsChange={onTagsChange}
          />
        )}
      </div>
    </div>
  )
}
