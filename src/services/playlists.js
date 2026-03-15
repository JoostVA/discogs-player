const LS_KEY = 'discogs_playlists'

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function loadPlaylists() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

export function savePlaylists(playlists) {
  localStorage.setItem(LS_KEY, JSON.stringify(playlists))
}

export function createPlaylist(name) {
  const all = loadPlaylists()
  const id = generateId()
  const playlist = { id, name, items: [] }
  all[id] = playlist
  savePlaylists(all)
  return playlist
}

export function deletePlaylist(playlistId) {
  const all = loadPlaylists()
  delete all[playlistId]
  savePlaylists(all)
}

export function renamePlaylist(playlistId, newName) {
  const all = loadPlaylists()
  if (!all[playlistId]) return
  all[playlistId].name = newName
  savePlaylists(all)
}

export function addRecordToPlaylist(playlistId, release) {
  const all = loadPlaylists()
  if (!all[playlistId]) return
  const info = release.basic_information
  all[playlistId].items.push({
    type: 'record',
    id: generateId(),
    releaseId: info.id,
    instanceId: release.instance_id ?? info.id,
    snapshot: info,
  })
  savePlaylists(all)
}

export function addSectionToPlaylist(playlistId, title) {
  const all = loadPlaylists()
  if (!all[playlistId]) return
  all[playlistId].items.push({
    type: 'section',
    id: generateId(),
    title,
  })
  savePlaylists(all)
}

export function removeItemFromPlaylist(playlistId, itemId) {
  const all = loadPlaylists()
  if (!all[playlistId]) return
  all[playlistId].items = all[playlistId].items.filter(item => item.id !== itemId)
  savePlaylists(all)
}

export function reorderItems(playlistId, newItemsArray) {
  const all = loadPlaylists()
  if (!all[playlistId]) return
  all[playlistId].items = newItemsArray
  savePlaylists(all)
}

export function setItemSelectedTrack(playlistId, itemId, track) {
  const all = loadPlaylists()
  const pl = all[playlistId]
  if (!pl) return
  const item = pl.items.find(i => i.id === itemId)
  if (!item || item.type !== 'record') return
  if (track === null) {
    delete item.selectedTrack
  } else {
    item.selectedTrack = { position: track.position, title: track.title }
  }
  savePlaylists(all)
}

export function isRecordInPlaylist(playlistId, releaseId, instanceId) {
  const all = loadPlaylists()
  const playlist = all[playlistId]
  if (!playlist) return false
  return playlist.items.some(
    item => item.type === 'record' && item.releaseId === releaseId && item.instanceId === instanceId
  )
}
