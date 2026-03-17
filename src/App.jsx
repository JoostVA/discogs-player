import { useState, useCallback, useRef } from 'react'
import Settings from './components/Settings'
import CollectionBrowser from './components/CollectionBrowser'
import RecordDetail from './components/RecordDetail'
import PlaylistPanel from './components/PlaylistPanel'
import Player from './components/Player'
import { loadOverrides } from './services/overrides'
import { loadPlaylists } from './services/playlists'
import { loadTags } from './services/tags'

const LS_USERNAME = 'discogs_username'
const LS_TOKEN = 'discogs_token'
const LS_YT_KEY = 'youtube_api_key'

function loadCredentials() {
  return {
    username: localStorage.getItem(LS_USERNAME) ?? '',
    token: localStorage.getItem(LS_TOKEN) ?? '',
    ytKey: localStorage.getItem(LS_YT_KEY) ?? '',
  }
}

function hasCredentials({ username, token, ytKey }) {
  return username && token && ytKey
}

export default function App() {
  const [creds, setCreds] = useState(loadCredentials)
  const [showSettings, setShowSettings] = useState(!hasCredentials(loadCredentials()))
  const [selectedRelease, setSelectedRelease] = useState(null)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [currentAlbumInfo, setCurrentAlbumInfo] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [overrides, setOverrides] = useState(loadOverrides)
  const [playlists, setPlaylists] = useState(loadPlaylists)
  const [tags, setTags] = useState(loadTags)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [playContext, setPlayContext] = useState(null)

  // Keep stable refs for values needed inside handleTrackEnd without
  // forcing it to be recreated on every state change
  const playContextRef = useRef(null)
  const currentAlbumInfoRef = useRef(null)
  const playlistsRef = useRef(playlists)
  playContextRef.current = playContext
  currentAlbumInfoRef.current = currentAlbumInfo
  playlistsRef.current = playlists

  function handleOverrideChange() {
    setOverrides(loadOverrides())
  }

  function handlePlaylistsChange() {
    setPlaylists(loadPlaylists())
  }

  function handleTagsChange() {
    setTags(loadTags())
  }

  function handleSaveSettings(newCreds) {
    localStorage.setItem(LS_USERNAME, newCreds.username)
    localStorage.setItem(LS_TOKEN, newCreds.token)
    localStorage.setItem(LS_YT_KEY, newCreds.ytKey)
    setCreds(newCreds)
    setShowSettings(false)
  }

  function handleSelectRelease(release) {
    setSelectedRelease(release)
  }

  function handleCloseDetail() {
    setSelectedRelease(null)
  }

  const handlePlay = useCallback((track, albumInfo, context = null) => {
    setCurrentTrack(track)
    setCurrentAlbumInfo(albumInfo)
    setIsPlaying(true)
    setPlayContext(context)
  }, [])

  // Called by Player when the YouTube video ends naturally
  const handleTrackEnd = useCallback(() => {
    const ctx = playContextRef.current
    if (!ctx) return

    if (ctx.type === 'record') {
      const { releaseId, currentIndex } = ctx
      try {
        const cached = sessionStorage.getItem(`discogs_release_${releaseId}`)
        if (!cached) return
        const data = JSON.parse(cached)
        const tracks = data.tracklist?.filter(t => t.type_ !== 'index') ?? []
        let nextIdx = currentIndex + 1
        // skip any heading rows
        while (nextIdx < tracks.length && tracks[nextIdx].type_ === 'heading') nextIdx++
        if (nextIdx < tracks.length) {
          handlePlay(tracks[nextIdx], currentAlbumInfoRef.current, {
            type: 'record', releaseId, currentIndex: nextIdx,
          })
        }
      } catch {}
      return
    }

    if (ctx.type === 'playlist') {
      const { playlistId, currentItemIndex } = ctx
      const pl = playlistsRef.current[playlistId]
      if (!pl) return
      for (let i = currentItemIndex + 1; i < pl.items.length; i++) {
        const item = pl.items[i]
        if (item.type === 'record' && item.selectedTrack) {
          const snap = item.snapshot
          const artist = snap.artists?.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ') ?? ''
          const albumInfo = {
            artist,
            title: snap.title ?? '',
            coverUrl: snap.cover_image && !snap.cover_image.includes('spacer.gif')
              ? snap.cover_image : null,
            year: snap.year ?? null,
            releaseId: item.releaseId,
          }
          handlePlay(item.selectedTrack, albumInfo, {
            type: 'playlist', playlistId, currentItemIndex: i,
          })
          return
        }
      }
    }
  }, [handlePlay])

  const handleTogglePlay = useCallback(() => {
    setIsPlaying(p => !p)
  }, [])

  if (showSettings) {
    return (
      <Settings
        onSave={handleSaveSettings}
        initialValues={creds}
      />
    )
  }

  return (
    <div className="app-layout">
      <div className="app-main">
        <CollectionBrowser
          username={creds.username}
          token={creds.token}
          activeReleaseId={selectedRelease?.id}
          onSelectRelease={handleSelectRelease}
          onSettingsClick={() => setShowSettings(true)}
          playlists={playlists}
          onPlaylistsChange={handlePlaylistsChange}
          showPlaylist={showPlaylist}
          onTogglePlaylist={() => setShowPlaylist(p => !p)}
          tags={tags}
          onTagsChange={handleTagsChange}
        />

        {selectedRelease && (
          <RecordDetail
            release={selectedRelease}
            token={creds.token}
            currentTrack={currentTrack}
            overrides={overrides}
            onPlay={handlePlay}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onClose={handleCloseDetail}
            playlists={playlists}
            onPlaylistsChange={handlePlaylistsChange}
            tags={tags}
            onTagsChange={handleTagsChange}
          />
        )}

        {showPlaylist && (
          <PlaylistPanel
            playlists={playlists}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            token={creds.token}
            ytKey={creds.ytKey}
            overrides={overrides}
            onPlay={handlePlay}
            onTogglePlay={handleTogglePlay}
            onClose={() => setShowPlaylist(false)}
            onPlaylistsChange={handlePlaylistsChange}
          />
        )}
      </div>

      {currentTrack && (
        <Player
          track={currentTrack}
          albumInfo={currentAlbumInfo}
          ytKey={creds.ytKey}
          isPlaying={isPlaying}
          overrides={overrides}
          onOverrideChange={handleOverrideChange}
          onEnded={handleTrackEnd}
        />
      )}
    </div>
  )
}
