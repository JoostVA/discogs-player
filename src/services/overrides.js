const LS_KEY = 'yt_overrides'

export function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

export function saveOverride(overrideKey, videoId) {
  const all = loadOverrides()
  all[overrideKey] = videoId
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

export function removeOverride(overrideKey) {
  const all = loadOverrides()
  delete all[overrideKey]
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

export function makeOverrideKey(releaseId, track) {
  return `${releaseId}_${track.position || ''}_${track.title}`
}

export function extractVideoId(input) {
  if (!input) return null
  const s = input.trim()
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = s.match(p)
    if (m) return m[1]
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  return null
}
