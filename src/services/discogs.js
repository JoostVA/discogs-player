const BASE_URL = 'https://api.discogs.com'

function getHeaders(token) {
  return {
    Authorization: `Discogs token=${token}`,
    'User-Agent': 'DiscogsVinylPlayer/1.0',
  }
}

export async function fetchCollection(username, token, page = 1, perPage = 25) {
  const url = `${BASE_URL}/users/${username}/collection/folders/0/releases?per_page=${perPage}&page=${page}&sort=artist&sort_order=asc`
  const res = await fetch(url, { headers: getHeaders(token) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Discogs error: ${res.status}`)
  }
  return res.json()
}

/**
 * Streams the full collection page by page (100/page), calling onBatch after
 * each page with the cumulative array so far and a done flag.
 * Caches the complete result in sessionStorage keyed by username.
 */
export async function streamCollection(username, token, onBatch) {
  const cacheKey = `discogs_coll_all_${username}`
  const cached = sessionStorage.getItem(cacheKey)
  if (cached) {
    try { onBatch(JSON.parse(cached), true); return } catch {}
  }

  const all = []
  let page = 1
  let pages = 1
  do {
    const url = `${BASE_URL}/users/${username}/collection/folders/0/releases?per_page=100&page=${page}`
    const res = await fetch(url, { headers: getHeaders(token) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `Discogs error: ${res.status}`)
    }
    const data = await res.json()
    all.push(...(data.releases ?? []))
    pages = data.pagination?.pages ?? 1
    onBatch([...all], page >= pages)
    page++
  } while (page <= pages)

  sessionStorage.setItem(cacheKey, JSON.stringify(all))
}

export function clearCollectionCache(username) {
  sessionStorage.removeItem(`discogs_coll_all_${username}`)
}

export async function fetchRelease(releaseId, token) {
  const cacheKey = `discogs_release_${releaseId}`
  const cached = sessionStorage.getItem(cacheKey)
  if (cached) return JSON.parse(cached)

  const url = `${BASE_URL}/releases/${releaseId}`
  const res = await fetch(url, { headers: getHeaders(token) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Discogs error: ${res.status}`)
  }
  const data = await res.json()
  sessionStorage.setItem(cacheKey, JSON.stringify(data))
  return data
}
