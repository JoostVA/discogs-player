import { useState, useEffect, useRef } from 'react'
import {
  createPlaylist,
  addRecordToPlaylist,
  removeItemFromPlaylist,
  isRecordInPlaylist,
} from '../services/playlists'

export default function AddToPlaylistPopover({ release, playlists, onPlaylistsChange, onClose }) {
  const [newName, setNewName] = useState('')
  const [showNewInput, setShowNewInput] = useState(false)
  const newInputRef = useRef(null)
  const containerRef = useRef(null)

  const info = release.basic_information
  const releaseId = info.id
  const instanceId = release.instance_id ?? info.id

  // Close on click outside
  useEffect(() => {
    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  useEffect(() => {
    if (showNewInput) {
      setTimeout(() => newInputRef.current?.focus(), 50)
    }
  }, [showNewInput])

  const playlistList = Object.values(playlists)

  function handleToggle(playlistId) {
    const inPlaylist = isRecordInPlaylist(playlistId, releaseId, instanceId)
    if (inPlaylist) {
      // Remove the most recent matching item
      const playlist = playlists[playlistId]
      const item = [...playlist.items].reverse().find(
        i => i.type === 'record' && i.releaseId === releaseId && i.instanceId === instanceId
      )
      if (item) removeItemFromPlaylist(playlistId, item.id)
    } else {
      addRecordToPlaylist(playlistId, release)
    }
    onPlaylistsChange()
  }

  function handleCreatePlaylist(e) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return
    const playlist = createPlaylist(trimmed)
    addRecordToPlaylist(playlist.id, release)
    onPlaylistsChange()
    setNewName('')
    setShowNewInput(false)
  }

  return (
    <div className="playlist-popover" ref={containerRef}>
      <div className="playlist-popover__title">Add to playlist</div>
      {playlistList.length === 0 && !showNewInput && (
        <p className="playlist-popover__empty">No playlists yet</p>
      )}
      {playlistList.map(playlist => {
        const checked = isRecordInPlaylist(playlist.id, releaseId, instanceId)
        return (
          <label key={playlist.id} className="playlist-popover__item">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => handleToggle(playlist.id)}
            />
            <span className="playlist-popover__name">{playlist.name}</span>
          </label>
        )
      })}
      {showNewInput ? (
        <form className="playlist-popover__new-form" onSubmit={handleCreatePlaylist}>
          <input
            ref={newInputRef}
            className="playlist-popover__new-input"
            type="text"
            placeholder="Playlist name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setShowNewInput(false) }}
          />
          <button type="submit" className="playlist-popover__new-save" disabled={!newName.trim()}>
            Add
          </button>
        </form>
      ) : (
        <button
          className="playlist-popover__new-btn"
          onClick={() => setShowNewInput(true)}
        >
          ＋ New playlist
        </button>
      )}
    </div>
  )
}
