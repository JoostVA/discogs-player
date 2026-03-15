import { useState, useCallback } from 'react'
import Settings from './components/Settings'
import CollectionBrowser from './components/CollectionBrowser'
import RecordDetail from './components/RecordDetail'
import PlaylistPanel from './components/PlaylistPanel'
import Player from './components/Player'
import { loadOverrides } from './services/overrides'
import { loadPlaylists } from './services/playlists'

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
  const [showPlaylist, setShowPlaylist] = useState(false)

  function handleOverrideChange() {
    setOverrides(loadOverrides())
  }

  function handlePlaylistsChange() {
    setPlaylists(loadPlaylists())
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

  const handlePlay = useCallback((track, albumInfo) => {
    setCurrentTrack(track)
    setCurrentAlbumInfo(albumInfo)
    setIsPlaying(true)
  }, [])

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
        />
      )}
    </div>
  )
}
