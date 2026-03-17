const LS_KEY = 'discogs_tags'

export function loadTags() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

export function saveTags(tags) {
  localStorage.setItem(LS_KEY, JSON.stringify(tags))
}

/** Tags on a specific track */
export function getTrackTags(tags, releaseId, position) {
  return tags[releaseId]?.[position] ?? []
}

/** All unique tags across every track on a release */
export function getReleaseTags(tags, releaseId) {
  const byRelease = tags[releaseId]
  if (!byRelease) return []
  const set = new Set()
  Object.values(byRelease).forEach(arr => arr.forEach(t => set.add(t)))
  return [...set].sort()
}

/** All unique tags across the entire collection, sorted */
export function getAllTags(tags) {
  const set = new Set()
  Object.values(tags).forEach(byRelease =>
    Object.values(byRelease).forEach(arr => arr.forEach(t => set.add(t)))
  )
  return [...set].sort()
}

/** How many track-entries have this tag (for the manager UI) */
export function getTagUsageCount(tags, tag) {
  let count = 0
  Object.values(tags).forEach(byRelease =>
    Object.values(byRelease).forEach(arr => { if (arr.includes(tag)) count++ })
  )
  return count
}

/** Add a tag to a track. No-op if already present. */
export function addTag(releaseId, position, tag) {
  const tags = loadTags()
  const key = String(releaseId)
  if (!tags[key]) tags[key] = {}
  if (!tags[key][position]) tags[key][position] = []
  if (!tags[key][position].includes(tag)) tags[key][position].push(tag)
  saveTags(tags)
  return tags
}

/** Remove a tag from a track. Cleans up empty objects. */
export function removeTag(releaseId, position, tag) {
  const tags = loadTags()
  const key = String(releaseId)
  if (!tags[key]?.[position]) return tags
  tags[key][position] = tags[key][position].filter(t => t !== tag)
  if (tags[key][position].length === 0) delete tags[key][position]
  if (Object.keys(tags[key]).length === 0) delete tags[key]
  saveTags(tags)
  return tags
}

/** Rename a tag globally across all tracks */
export function renameTagGlobally(tags, oldTag, newTag) {
  const updated = {}
  Object.entries(tags).forEach(([releaseId, byRelease]) => {
    updated[releaseId] = {}
    Object.entries(byRelease).forEach(([position, arr]) => {
      const next = arr.map(t => t === oldTag ? newTag : t)
      // deduplicate in case newTag already existed on this track
      updated[releaseId][position] = [...new Set(next)]
    })
  })
  saveTags(updated)
  return updated
}

/** Delete a tag globally from all tracks */
export function deleteTagGlobally(tags, tag) {
  const updated = {}
  Object.entries(tags).forEach(([releaseId, byRelease]) => {
    const newByRelease = {}
    Object.entries(byRelease).forEach(([position, arr]) => {
      const next = arr.filter(t => t !== tag)
      if (next.length > 0) newByRelease[position] = next
    })
    if (Object.keys(newByRelease).length > 0) updated[releaseId] = newByRelease
  })
  saveTags(updated)
  return updated
}
