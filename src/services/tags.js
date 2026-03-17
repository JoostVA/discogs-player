const LS_KEY = 'discogs_tags'
const LS_COLORS_KEY = 'discogs_tag_colors'

export const DOT_COLORS = [
  '#e63946', // red
  '#f4a261', // orange
  '#ffd166', // yellow
  '#06d6a0', // green
  '#4cc9f0', // cyan
  '#4895ef', // blue
  '#9b5de5', // purple
  '#f72585', // pink
  '#c0c0c0', // silver
]

export function loadTagColors() {
  try { return JSON.parse(localStorage.getItem(LS_COLORS_KEY) || '{}') } catch { return {} }
}

export function saveTagColors(colors) {
  localStorage.setItem(LS_COLORS_KEY, JSON.stringify(colors))
}

export function getTagColor(tagColors, tag) {
  return tagColors?.[tag] ?? DOT_COLORS[0]
}

export function setTagColor(tag, color) {
  const colors = loadTagColors()
  colors[tag] = color
  saveTagColors(colors)
  return colors
}

export function deleteTagColor(tag) {
  const colors = loadTagColors()
  delete colors[tag]
  saveTagColors(colors)
  return colors
}

export function renameTagColor(oldTag, newTag) {
  const colors = loadTagColors()
  if (colors[oldTag] !== undefined) {
    colors[newTag] = colors[oldTag]
    delete colors[oldTag]
    saveTagColors(colors)
  }
  return colors
}

export function autoAssignColor(tag) {
  const tags = loadTags()
  const existingCount = getAllTags(tags).length
  const color = DOT_COLORS[existingCount % DOT_COLORS.length]
  return setTagColor(tag, color)
}

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

/** Rename a tag globally across all tracks (also migrates the color) */
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
  renameTagColor(oldTag, newTag)
  return updated
}

/** Delete a tag globally from all tracks (also removes the color) */
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
  deleteTagColor(tag)
  return updated
}
