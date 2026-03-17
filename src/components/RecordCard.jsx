import { useState } from 'react'
import AddToPlaylistPopover from './AddToPlaylistPopover'
import { getReleaseTags } from '../services/tags'

const MAX_CHIPS = 3

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23222'/%3E%3Ccircle cx='100' cy='100' r='60' fill='%23111'/%3E%3Ccircle cx='100' cy='100' r='8' fill='%23333'/%3E%3C/svg%3E"

export default function RecordCard({ release, isActive, onClick, playlists, onPlaylistsChange, tags }) {
  const [showPopover, setShowPopover] = useState(false)
  const cardTags = getReleaseTags(tags ?? {}, release.basic_information.id)

  const info = release.basic_information
  const artist = info.artists?.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ') ?? 'Unknown Artist'
  const title = info.title ?? 'Unknown Title'
  const year = info.year || null
  const coverUrl = info.cover_image && !info.cover_image.includes('spacer.gif')
    ? info.cover_image
    : PLACEHOLDER

  function handleAddClick(e) {
    e.stopPropagation()
    setShowPopover(p => !p)
  }

  return (
    <div className={`record-card${isActive ? ' record-card--active' : ''}`}>
      <button
        className="record-card__main"
        onClick={() => onClick(release)}
        title={`${artist} — ${title}`}
      >
        <div className="record-card__cover-wrap">
          <img
            className="record-card__cover"
            src={coverUrl}
            alt={`${artist} — ${title}`}
            loading="lazy"
            onError={e => { e.currentTarget.src = PLACEHOLDER }}
          />
          <div className="record-card__overlay">
            <span className="record-card__play-icon">▶</span>
          </div>
        </div>
        <div className="record-card__info">
          <span className="record-card__artist">{artist}</span>
          <span className="record-card__title">{title}</span>
          {year && <span className="record-card__year">{year}</span>}
        </div>
      </button>

      {cardTags.length > 0 && (
        <div className="record-card__tags">
          {cardTags.slice(0, MAX_CHIPS).map(t => (
            <span className="tag-chip" key={t}>{t}</span>
          ))}
          {cardTags.length > MAX_CHIPS && (
            <span className="record-card__tags-more">+{cardTags.length - MAX_CHIPS}</span>
          )}
        </div>
      )}

      {playlists !== undefined && (
        <button
          className="add-to-playlist-btn"
          onClick={handleAddClick}
          title="Add to playlist"
        >
          ＋
        </button>
      )}

      {showPopover && playlists !== undefined && (
        <AddToPlaylistPopover
          release={release}
          playlists={playlists}
          onPlaylistsChange={onPlaylistsChange}
          onClose={() => setShowPopover(false)}
        />
      )}
    </div>
  )
}
