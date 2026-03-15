const BASE_URL = 'https://www.googleapis.com/youtube/v3'

// Parse ISO 8601 duration (PT6M23S) → seconds
function parseIsoDuration(iso) {
  if (!iso) return null
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return null
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0)
}

// Parse Discogs track duration ("6:23" or "1:06:23") → seconds
export function parseTrackDuration(str) {
  if (!str) return null
  const parts = str.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

// Format seconds → "m:ss" or "h:mm:ss"
export function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// Fetch top 5 results enriched with durations.
// Results are sorted by duration proximity when trackDurationSeconds is provided.
// Shape: [{ videoId, title, channelTitle, thumbnail, durationSeconds }]
export async function searchVideos(query, apiKey, trackDurationSeconds = null) {
  const cacheKey = `yt_search5_${query}`
  const cached = sessionStorage.getItem(cacheKey)
  let results

  if (cached) {
    results = JSON.parse(cached)
  } else {
    // Step 1: text search
    const searchParams = new URLSearchParams({
      key: apiKey,
      q: query,
      type: 'video',
      part: 'snippet',
      maxResults: '5',
    })
    const searchRes = await fetch(`${BASE_URL}/search?${searchParams}`)
    if (!searchRes.ok) {
      const err = await searchRes.json().catch(() => ({}))
      throw new Error(err.error?.message || `YouTube API error: ${searchRes.status}`)
    }
    const searchData = await searchRes.json()
    const items = searchData.items ?? []

    if (!items.length) {
      sessionStorage.setItem(cacheKey, JSON.stringify([]))
      return []
    }

    // Step 2: fetch durations via videos.list (cheap: ~1 quota unit)
    const videoIds = items.map(i => i.id?.videoId).filter(Boolean).join(',')
    const detailParams = new URLSearchParams({ key: apiKey, id: videoIds, part: 'contentDetails' })
    const detailRes = await fetch(`${BASE_URL}/videos?${detailParams}`)
    const detailData = detailRes.ok ? await detailRes.json() : { items: [] }

    const durationMap = {}
    for (const v of detailData.items ?? []) {
      durationMap[v.id] = parseIsoDuration(v.contentDetails?.duration)
    }

    results = items
      .filter(item => item.id?.videoId)
      .map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url
          || item.snippet.thumbnails?.default?.url
          || null,
        durationSeconds: durationMap[item.id.videoId] ?? null,
      }))

    sessionStorage.setItem(cacheKey, JSON.stringify(results))
  }

  // Sort by duration proximity (best match first) when reference is known
  if (trackDurationSeconds != null && results.length > 1) {
    results = [...results].sort((a, b) => {
      const da = a.durationSeconds != null
        ? Math.abs(a.durationSeconds - trackDurationSeconds) : Infinity
      const db = b.durationSeconds != null
        ? Math.abs(b.durationSeconds - trackDurationSeconds) : Infinity
      return da - db
    })
  }

  return results
}

// Convenience wrapper: returns best single result videoId (or null)
export async function searchVideo(query, apiKey, trackDurationSeconds = null) {
  const results = await searchVideos(query, apiKey, trackDurationSeconds)
  return results.length ? results[0].videoId : null
}
