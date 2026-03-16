import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { fetchRelease } from '../services/discogs'
import {
  loadPlaylists,
  savePlaylists,
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
  addSectionToPlaylist,
  removeItemFromPlaylist,
  reorderItems,
  setItemSelectedTrack,
} from '../services/playlists'
import { makeOverrideKey } from '../services/overrides'

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23222'/%3E%3Ccircle cx='20' cy='20' r='12' fill='%23111'/%3E%3Ccircle cx='20' cy='20' r='2' fill='%23333'/%3E%3C/svg%3E"

// ── Sortable item wrapper ─────────────────────────────────────
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : 'auto',
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  )
}

// ── Inline editable text ──────────────────────────────────────
function InlineEdit({ value, onSave, className }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  function startEdit() {
    setDraft(value)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`inline-edit-input ${className ?? ''}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        onClick={e => e.stopPropagation()}
      />
    )
  }

  return (
    <span className={`inline-edit-text ${className ?? ''}`} onDoubleClick={startEdit} title="Double-click to rename">
      {value}
    </span>
  )
}

// ── Expanded tracklist for a playlist record item ─────────────
function PlaylistTrackList({ item, token, currentTrack, isPlaying, overrides, onPlay, onTogglePlay, selectedTrack, onSelectTrack }) {
  const [tracks, setTracks] = useState(null)
  const [loading, setLoading] = useState(false)

  const { releaseId, snapshot } = item
  const artist = snapshot.artists?.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ') ?? ''
  const title = snapshot.title ?? ''
  const year = snapshot.year ?? null
  const coverUrl = snapshot.cover_image && !snapshot.cover_image.includes('spacer.gif')
    ? snapshot.cover_image
    : PLACEHOLDER

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`discogs_release_${releaseId}`)
      if (cached) {
        const data = JSON.parse(cached)
        setTracks(data.tracklist?.filter(t => t.type_ !== 'index') ?? [])
        return
      }
    } catch {}

    setLoading(true)
    fetchRelease(releaseId, token)
      .then(data => setTracks(data.tracklist?.filter(t => t.type_ !== 'index') ?? []))
      .catch(() => setTracks([]))
      .finally(() => setLoading(false))
  }, [releaseId, token])

  if (loading) {
    return (
      <div className="playlist-tracklist__loading">
        <div className="spinner spinner--small" />
      </div>
    )
  }

  if (!tracks?.length) return null

  return (
    <ol className="playlist-tracklist">
      {tracks.map((track, idx) => {
        if (track.type_ === 'heading') {
          return (
            <li key={idx} className="playlist-tracklist__heading">{track.title}</li>
          )
        }
        const isCurrentTrack =
          currentTrack?.position === track.position &&
          currentTrack?.title === track.title
        const isTrackPlaying = isCurrentTrack && isPlaying
        const hasOverride = overrides && makeOverrideKey(releaseId, track) in overrides
        const isSelected =
          selectedTrack?.position === track.position &&
          selectedTrack?.title === track.title

        return (
          <li
            key={idx}
            className={[
              'playlist-tracklist__item',
              isCurrentTrack ? 'playlist-tracklist__item--playing' : '',
              isSelected ? 'playlist-tracklist__item--selected' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="playlist-tracklist__pos">
              {track.position || idx + 1}
            </span>
            <button
              className="playlist-tracklist__play-btn"
              onClick={() => isCurrentTrack
                ? onTogglePlay()
                : onPlay(track, { artist, title, coverUrl, year, releaseId })
              }
              title={isTrackPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
            >
              {isTrackPlaying ? '⏸' : '▶'}
            </button>
            <span className="playlist-tracklist__title">
              {track.title}
              {hasOverride && <span className="track-list__override-badge" title="Custom video set">✎</span>}
            </span>
            {track.duration && (
              <span className="playlist-tracklist__duration">{track.duration}</span>
            )}
            <button
              className={`playlist-tracklist__select-btn${isSelected ? ' playlist-tracklist__select-btn--active' : ''}`}
              onClick={() => onSelectTrack(isSelected ? null : track)}
              title={isSelected ? 'Deselect track for set' : 'Select track for set'}
            >
              {isSelected ? '★' : '☆'}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

// ── Playlist list view ────────────────────────────────────────
function PlaylistListView({ playlists, onOpen, onPlaylistsChange, onClose }) {
  const [newName, setNewName] = useState('')
  const [showInput, setShowInput] = useState(false)
  const inputRef = useRef(null)

  const playlistList = Object.values(playlists)

  useEffect(() => {
    if (showInput) setTimeout(() => inputRef.current?.focus(), 50)
  }, [showInput])

  function handleCreate(e) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return
    const pl = createPlaylist(trimmed)
    onPlaylistsChange()
    setNewName('')
    setShowInput(false)
    onOpen(pl.id)
  }

  return (
    <div className="playlist-panel">
      <div className="playlist-panel__header">
        <h3 className="playlist-panel__title">Playlists</h3>
        <button className="playlist-panel__close" onClick={onClose} title="Close playlists">✕</button>
      </div>

      <div className="playlist-panel__body">
        {playlistList.length === 0 && !showInput && (
          <p className="playlist-panel__empty">No playlists yet. Create one below.</p>
        )}
        {playlistList.map(pl => {
          const recordCount = pl.items.filter(i => i.type === 'record').length
          return (
            <button
              key={pl.id}
              className="playlist-list__item"
              onClick={() => onOpen(pl.id)}
            >
              <span className="playlist-list__name">{pl.name}</span>
              <span className="playlist-list__count">{recordCount} record{recordCount !== 1 ? 's' : ''}</span>
              <span className="playlist-list__arrow">›</span>
            </button>
          )
        })}
      </div>

      <div className="playlist-panel__footer">
        {showInput ? (
          <form className="playlist-new-form" onSubmit={handleCreate}>
            <input
              ref={inputRef}
              className="playlist-new-input"
              type="text"
              placeholder="Playlist name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setShowInput(false); setNewName('') } }}
            />
            <button type="submit" className="playlist-new-save" disabled={!newName.trim()}>Create</button>
            <button type="button" className="playlist-new-cancel" onClick={() => { setShowInput(false); setNewName('') }}>✕</button>
          </form>
        ) : (
          <button className="playlist-add-btn" onClick={() => setShowInput(true)}>
            ＋ New playlist
          </button>
        )}
      </div>
    </div>
  )
}

// ── Playlist detail view ──────────────────────────────────────
function PlaylistDetailView({ playlist, playlists, currentTrack, isPlaying, token, ytKey, overrides, onPlay, onTogglePlay, onPlaylistsChange, onBack }) {
  const [expandedId, setExpandedId] = useState(null)
  const [newSectionName, setNewSectionName] = useState('')
  const [showSectionInput, setShowSectionInput] = useState(false)
  const sectionInputRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    if (showSectionInput) setTimeout(() => sectionInputRef.current?.focus(), 50)
  }, [showSectionInput])

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const items = playlist.items
    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    reorderItems(playlist.id, arrayMove(items, oldIdx, newIdx))
    onPlaylistsChange()
  }

  function handleRemove(itemId) {
    removeItemFromPlaylist(playlist.id, itemId)
    onPlaylistsChange()
    if (expandedId === itemId) setExpandedId(null)
  }

  function handleAddSection(e) {
    e.preventDefault()
    const trimmed = newSectionName.trim()
    if (!trimmed) return
    addSectionToPlaylist(playlist.id, trimmed)
    onPlaylistsChange()
    setNewSectionName('')
    setShowSectionInput(false)
  }

  function handleDelete() {
    if (!window.confirm(`Delete playlist "${playlist.name}"?`)) return
    deletePlaylist(playlist.id)
    onPlaylistsChange()
    onBack()
  }

  function handleRename(newName) {
    renamePlaylist(playlist.id, newName)
    onPlaylistsChange()
  }

  function handleExport() {
    const lines = []
    lines.push(playlist.name)
    lines.push('='.repeat(playlist.name.length))
    lines.push(`Exported: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`)
    lines.push('')

    let recordNum = 0
    for (const item of playlist.items) {
      if (item.type === 'section') {
        lines.push('')
        lines.push(`── ${item.title} ──`)
        lines.push('')
      } else {
        recordNum++
        const artist = item.snapshot.artists?.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ') ?? 'Unknown'
        const title = item.snapshot.title ?? 'Unknown'
        const year = item.snapshot.year ? ` (${item.snapshot.year})` : ''
        lines.push(`${recordNum}. ${artist} — ${title}${year}`)
        if (item.selectedTrack) {
          const pos = item.selectedTrack.position ? `${item.selectedTrack.position} · ` : ''
          lines.push(`   ▶ ${pos}${item.selectedTrack.title}`)
        }
      }
    }

    lines.push('')
    lines.push('─'.repeat(40))
    lines.push(`Total: ${recordNum} record${recordNum !== 1 ? 's' : ''}`)

    const text = lines.join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${playlist.name.replace(/[^a-z0-9\s\-_]/gi, '').trim().replace(/\s+/g, '_') || 'playlist'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const items = playlist.items

  // Compute per-item record numbers (sections don't count)
  let recordCounter = 0
  const numberedItems = items.map((item, itemIdx) => ({
    item,
    itemIdx,
    num: item.type === 'record' ? ++recordCounter : null,
  }))

  return (
    <div className="playlist-panel">
      <div className="playlist-panel__header">
        <button className="playlist-panel__back" onClick={onBack} title="Back to playlists">←</button>
        <InlineEdit
          value={playlist.name}
          onSave={handleRename}
          className="playlist-panel__title-edit"
        />
        <button className="playlist-panel__export" onClick={handleExport} title="Export as text file">↓</button>
        <button className="playlist-panel__delete" onClick={handleDelete} title="Delete playlist">🗑</button>
      </div>

      <div className="playlist-panel__body">
        {items.length === 0 && (
          <p className="playlist-panel__empty">
            No records yet. Add records from the collection or record detail.
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {numberedItems.map(({ item, itemIdx, num }) => (
              <SortableItem key={item.id} id={item.id}>
                {({ dragHandleProps }) => (
                  item.type === 'section'
                    ? <SectionRow
                        item={item}
                        dragHandleProps={dragHandleProps}
                        onRemove={() => handleRemove(item.id)}
                        onRename={newTitle => {
                          const all = loadPlaylists()
                          const pl = all[playlist.id]
                          if (!pl) return
                          const found = pl.items.find(x => x.id === item.id)
                          if (found) { found.title = newTitle; savePlaylists(all); onPlaylistsChange() }
                        }}
                      />
                    : <RecordRow
                        item={item}
                        num={num}
                        dragHandleProps={dragHandleProps}
                        isExpanded={expandedId === item.id}
                        onToggleExpand={() => setExpandedId(id => id === item.id ? null : item.id)}
                        onRemove={() => handleRemove(item.id)}
                        currentTrack={currentTrack}
                        isPlaying={isPlaying}
                        token={token}
                        overrides={overrides}
                        onPlay={(track, albumInfo) => onPlay(track, albumInfo, {
                          type: 'playlist',
                          playlistId: playlist.id,
                          currentItemIndex: itemIdx,
                        })}
                        onTogglePlay={onTogglePlay}
                        onSelectTrack={track => {
                          setItemSelectedTrack(playlist.id, item.id, track)
                          onPlaylistsChange()
                        }}
                      />
                )}
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="playlist-panel__footer">
        {showSectionInput ? (
          <form className="playlist-new-form" onSubmit={handleAddSection}>
            <input
              ref={sectionInputRef}
              className="playlist-new-input"
              type="text"
              placeholder="Section name…"
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setShowSectionInput(false); setNewSectionName('') } }}
            />
            <button type="submit" className="playlist-new-save" disabled={!newSectionName.trim()}>Add</button>
            <button type="button" className="playlist-new-cancel" onClick={() => { setShowSectionInput(false); setNewSectionName('') }}>✕</button>
          </form>
        ) : (
          <button className="playlist-add-btn" onClick={() => setShowSectionInput(true)}>
            ＋ Add section
          </button>
        )}
      </div>
    </div>
  )
}

// ── Section row ───────────────────────────────────────────────
function SectionRow({ item, dragHandleProps, onRemove, onRename }) {
  return (
    <div className="playlist-item playlist-item--section">
      <span className="drag-handle" {...dragHandleProps}>⠿</span>
      <InlineEdit value={item.title} onSave={onRename} className="playlist-item__section-title" />
      <button className="playlist-item__remove" onClick={onRemove} title="Remove section">✕</button>
    </div>
  )
}

// ── Record row ────────────────────────────────────────────────
function RecordRow({ item, num, dragHandleProps, isExpanded, onToggleExpand, onRemove, currentTrack, isPlaying, token, overrides, onPlay, onTogglePlay, onSelectTrack }) {
  const { snapshot, selectedTrack } = item
  const artist = snapshot.artists?.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ') ?? 'Unknown Artist'
  const title = snapshot.title ?? 'Unknown Title'
  const coverUrl = snapshot.cover_image && !snapshot.cover_image.includes('spacer.gif')
    ? snapshot.cover_image
    : PLACEHOLDER

  return (
    <div className={`playlist-item playlist-item--record${isExpanded ? ' playlist-item--expanded' : ''}`}>
      <div className="playlist-item__row">
        <span className="drag-handle" {...dragHandleProps}>⠿</span>
        {num != null && <span className="playlist-item__num">{num}</span>}
        <img
          className="playlist-item__thumb"
          src={coverUrl}
          alt={`${artist} — ${title}`}
          onError={e => { e.currentTarget.src = PLACEHOLDER }}
        />
        <button
          className="playlist-item__info"
          onClick={onToggleExpand}
          title={isExpanded ? 'Collapse' : 'Expand tracks'}
        >
          <span className="playlist-item__artist">{artist}</span>
          <span className="playlist-item__title">{title}</span>
          {!isExpanded && selectedTrack && (
            <span className="playlist-item__selected-track">
              {selectedTrack.position ? `${selectedTrack.position} · ` : ''}{selectedTrack.title}
            </span>
          )}
        </button>
        <button
          className={`playlist-item__expand-btn${isExpanded ? ' playlist-item__expand-btn--open' : ''}`}
          onClick={onToggleExpand}
          title={isExpanded ? 'Collapse' : 'Show tracks'}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
        <button className="playlist-item__remove" onClick={onRemove} title="Remove from playlist">✕</button>
      </div>

      {isExpanded && (
        <div className="playlist-item__tracks">
          <PlaylistTrackList
            item={item}
            token={token}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            overrides={overrides}
            onPlay={onPlay}
            onTogglePlay={onTogglePlay}
            selectedTrack={selectedTrack}
            onSelectTrack={onSelectTrack}
          />
        </div>
      )}
    </div>
  )
}

// ── Root component ────────────────────────────────────────────
export default function PlaylistPanel({ playlists, currentTrack, isPlaying, token, ytKey, overrides, onPlay, onTogglePlay, onClose, onPlaylistsChange }) {
  const [activePlaylistId, setActivePlaylistId] = useState(null)

  const activePlaylist = activePlaylistId ? playlists[activePlaylistId] : null

  // If the active playlist was deleted, go back to list
  useEffect(() => {
    if (activePlaylistId && !playlists[activePlaylistId]) {
      setActivePlaylistId(null)
    }
  }, [playlists, activePlaylistId])

  if (activePlaylist) {
    return (
      <PlaylistDetailView
        playlist={activePlaylist}
        playlists={playlists}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        token={token}
        ytKey={ytKey}
        overrides={overrides}
        onPlay={onPlay}
        onTogglePlay={onTogglePlay}
        onPlaylistsChange={onPlaylistsChange}
        onBack={() => setActivePlaylistId(null)}
      />
    )
  }

  return (
    <PlaylistListView
      playlists={playlists}
      onOpen={setActivePlaylistId}
      onPlaylistsChange={onPlaylistsChange}
      onClose={onClose}
    />
  )
}
