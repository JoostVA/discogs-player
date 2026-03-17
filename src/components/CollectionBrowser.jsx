import { useState, useEffect, useMemo, useRef } from 'react'
import { streamCollection } from '../services/discogs'
import { getReleaseTags } from '../services/tags'
import RecordCard from './RecordCard'
import TagFilter from './TagFilter'

const PAGE_SIZE = 25

const SORT_OPTIONS = [
  { value: 'artist',  label: 'Artist' },
  { value: 'title',   label: 'Title' },
  { value: 'year',    label: 'Year' },
  { value: 'label',   label: 'Label' },
  { value: 'added',   label: 'Date Added' },
]

function sortReleases(releases, sortBy, sortOrder) {
  const sorted = [...releases]
  sorted.sort((a, b) => {
    const ia = a.basic_information
    const ib = b.basic_information
    let cmp = 0
    if (sortBy === 'year') {
      cmp = (ia.year ?? 0) - (ib.year ?? 0)
    } else if (sortBy === 'artist') {
      const va = ia.artists?.[0]?.name?.replace(/\s*\(\d+\)$/, '').toLowerCase() ?? ''
      const vb = ib.artists?.[0]?.name?.replace(/\s*\(\d+\)$/, '').toLowerCase() ?? ''
      cmp = va < vb ? -1 : va > vb ? 1 : 0
    } else if (sortBy === 'title') {
      const va = ia.title?.toLowerCase() ?? ''
      const vb = ib.title?.toLowerCase() ?? ''
      cmp = va < vb ? -1 : va > vb ? 1 : 0
    } else if (sortBy === 'label') {
      const va = ia.labels?.[0]?.name?.toLowerCase() ?? ''
      const vb = ib.labels?.[0]?.name?.toLowerCase() ?? ''
      cmp = va < vb ? -1 : va > vb ? 1 : 0
    } else if (sortBy === 'added') {
      const va = a.date_added ?? ''
      const vb = b.date_added ?? ''
      cmp = va < vb ? -1 : va > vb ? 1 : 0
    }
    return sortOrder === 'asc' ? cmp : -cmp
  })
  return sorted
}

/** Read cached tracklist titles from sessionStorage (best-effort) */
function getCachedTracks(releaseId) {
  try {
    const cached = sessionStorage.getItem(`discogs_release_${releaseId}`)
    if (!cached) return []
    const data = JSON.parse(cached)
    return data.tracklist?.map(t => t.title?.toLowerCase() ?? '') ?? []
  } catch {
    return []
  }
}

// ── Multi-select style dropdown ───────────────────────────────
function StyleMultiSelect({ options, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const [styleSearch, setStyleSearch] = useState('')
  const searchRef = useRef(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) {
      setStyleSearch('')
      return
    }
    // Auto-focus search input when dropdown opens
    setTimeout(() => searchRef.current?.focus(), 0)

    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle(style) {
    const next = new Set(selected)
    if (next.has(style)) next.delete(style)
    else next.add(style)
    onChange(next)
  }

  const label =
    selected.size === 0 ? 'All'
    : selected.size === 1 ? [...selected][0]
    : `${selected.size} styles`

  const visibleOptions = styleSearch
    ? options.filter(s => s.toLowerCase().includes(styleSearch.toLowerCase()))
    : options

  return (
    <div className={`style-ms${open ? ' style-ms--open' : ''}`} ref={ref}>
      <button
        className={`style-ms__trigger${selected.size > 0 ? ' style-ms__trigger--active' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className="style-ms__label">{label}</span>
        <span className="style-ms__arrow">▾</span>
      </button>

      {open && (
        <div className="style-ms__dropdown">
          <div className="style-ms__search-wrap">
            <input
              ref={searchRef}
              className="style-ms__search"
              type="text"
              placeholder="Search styles…"
              value={styleSearch}
              onChange={e => setStyleSearch(e.target.value)}
              onMouseDown={e => e.stopPropagation()}
            />
            {styleSearch && (
              <button
                className="style-ms__search-clear"
                onMouseDown={e => { e.stopPropagation(); setStyleSearch('') }}
                tabIndex={-1}
              >
                ✕
              </button>
            )}
          </div>

          {selected.size > 0 && (
            <button
              className="style-ms__clear"
              onClick={() => onChange(new Set())}
            >
              ✕ Clear selection
            </button>
          )}
          <div className="style-ms__list">
            {visibleOptions.length === 0 && (
              <p className="style-ms__no-results">No styles found</p>
            )}
            {visibleOptions.map(s => (
              <label key={s} className={`style-ms__item${selected.has(s) ? ' style-ms__item--checked' : ''}`}>
                <span className={`style-ms__checkbox${selected.has(s) ? ' style-ms__checkbox--checked' : ''}`}>
                  {selected.has(s) ? '✓' : ''}
                </span>
                <input
                  type="checkbox"
                  checked={selected.has(s)}
                  onChange={() => toggle(s)}
                  className="style-ms__hidden-input"
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function CollectionBrowser({ username, token, activeReleaseId, onSelectRelease, onSettingsClick, playlists, onPlaylistsChange, showPlaylist, onTogglePlaylist, tags, onTagsChange }) {
  const [allReleases, setAllReleases] = useState([])
  const [loading, setLoading]   = useState(false)
  const [loadDone, setLoadDone] = useState(false)
  const [error, setError]       = useState('')
  const [page, setPage]         = useState(1)

  // Controls
  const [sortBy, setSortBy]         = useState('artist')
  const [sortOrder, setSortOrder]   = useState('asc')
  const [filterStyles, setFilterStyles] = useState(new Set()) // multi-select
  const [filterYear, setFilterYear] = useState('')
  const [filterTags, setFilterTags] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Random picker
  const [showRandom, setShowRandom] = useState(false)
  const [randomStyle, setRandomStyle] = useState('')
  const [randomYear, setRandomYear]   = useState('')
  const randomRef = useRef(null)

  // Load full collection, streaming pages in
  useEffect(() => {
    setLoading(true)
    setLoadDone(false)
    setError('')
    setAllReleases([])
    let cancelled = false

    streamCollection(username, token, (batch, done) => {
      if (cancelled) return
      setAllReleases(batch)
      if (done) { setLoading(false); setLoadDone(true) }
    }).catch(err => {
      if (!cancelled) { setError(err.message); setLoading(false) }
    })

    return () => { cancelled = true }
  }, [username, token])

  // Close random picker on outside click
  useEffect(() => {
    if (!showRandom) return
    function handler(e) {
      if (randomRef.current && !randomRef.current.contains(e.target)) setShowRandom(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showRandom])

  // Unique styles + years
  const allStyles = useMemo(() => {
    const set = new Set()
    allReleases.forEach(r => r.basic_information.styles?.forEach(s => set.add(s)))
    return [...set].sort()
  }, [allReleases])

  const allYears = useMemo(() => {
    const set = new Set()
    allReleases.forEach(r => { if (r.basic_information.year) set.add(r.basic_information.year) })
    return [...set].sort((a, b) => b - a)
  }, [allReleases])

  // All tags that appear on any release in the current collection
  const allTagOptions = useMemo(() => {
    const set = new Set()
    allReleases.forEach(r =>
      getReleaseTags(tags ?? {}, r.basic_information.id).forEach(t => set.add(t))
    )
    return [...set].sort()
  }, [allReleases, tags])

  // Filter → sort
  const filteredSorted = useMemo(() => {
    let result = allReleases
    if (filterStyles.size > 0)
      result = result.filter(r =>
        r.basic_information.styles?.some(s => filterStyles.has(s))
      )
    if (filterYear)
      result = result.filter(r => r.basic_information.year === Number(filterYear))
    if (filterTags.size > 0)
      result = result.filter(r => {
        const rt = new Set(getReleaseTags(tags ?? {}, r.basic_information.id))
        return [...filterTags].every(t => rt.has(t))  // AND logic
      })
    return sortReleases(result, sortBy, sortOrder)
  }, [allReleases, filterStyles, filterYear, filterTags, tags, sortBy, sortOrder])

  // Search within filtered+sorted results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return filteredSorted
    return filteredSorted.filter(r => {
      const info = r.basic_information
      if (info.artists?.some(a => a.name.replace(/\s*\(\d+\)$/, '').toLowerCase().includes(q))) return true
      if (info.title?.toLowerCase().includes(q)) return true
      if (info.labels?.some(l => l.name?.toLowerCase().includes(q))) return true
      // Check sessionStorage-cached tracklists (populated as user browses)
      if (getCachedTracks(info.id).some(t => t.includes(q))) return true
      return false
    })
  }, [filteredSorted, searchQuery])

  // Reset to page 1 whenever filter/sort/search changes
  useEffect(() => { setPage(1) }, [filterStyles, filterYear, filterTags, sortBy, sortOrder, searchQuery])

  // Client-side pagination
  const totalPages   = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE))
  const currentPage  = Math.min(page, totalPages)
  const pageReleases = searchResults.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const isFiltered = filterStyles.size > 0 || filterYear || filterTags.size > 0
  const isSearching = searchQuery.trim().length > 0

  function handlePickRandom() {
    let pool = allReleases
    if (randomStyle) pool = pool.filter(r => r.basic_information.styles?.includes(randomStyle))
    if (randomYear)  pool = pool.filter(r => r.basic_information.year === Number(randomYear))
    if (!pool.length) return
    onSelectRelease(pool[Math.floor(Math.random() * pool.length)])
    setShowRandom(false)
  }

  // Count display
  const displayCount = isSearching || isFiltered
    ? `${searchResults.length} of ${allReleases.length}`
    : allReleases.length

  return (
    <div className="collection">
      {/* ── Header ── */}
      <header className="collection__header">
        <div className="collection__header-left">
          <h2 className="collection__title">Vinyl Collection</h2>
          {allReleases.length > 0 && (
            <span className="collection__count">
              {displayCount} records{loading ? '…' : ''}
            </span>
          )}
        </div>
        <div className="collection__header-right">
          {/* ⇄ Random picker */}
          <div className="random-picker-wrap" ref={randomRef}>
            <button
              className={`btn-icon${showRandom ? ' btn-icon--active' : ''}`}
              onClick={() => setShowRandom(v => !v)}
              title="Pick a random record"
            >
              ⇄
            </button>
            {showRandom && (
              <div className="random-picker">
                <p className="random-picker__title">Random Record</p>
                <div className="random-picker__field">
                  <label className="random-picker__label">Style</label>
                  <select
                    className="collection__select"
                    value={randomStyle}
                    onChange={e => setRandomStyle(e.target.value)}
                  >
                    <option value="">Any style</option>
                    {allStyles.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="random-picker__field">
                  <label className="random-picker__label">Year</label>
                  <select
                    className="collection__select"
                    value={randomYear}
                    onChange={e => setRandomYear(e.target.value)}
                  >
                    <option value="">Any year</option>
                    {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <button
                  className="random-picker__btn"
                  onClick={handlePickRandom}
                  disabled={allReleases.length === 0}
                >
                  ⇄ Pick a Record
                </button>
              </div>
            )}
          </div>
          <button
            className={`btn-icon${showPlaylist ? ' btn-icon--active' : ''}`}
            onClick={onTogglePlaylist}
            title="Playlists"
          >
            ♫
          </button>
          <button className="btn-icon" onClick={onSettingsClick} title="Settings">⚙</button>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="collection__toolbar">
        <div className="collection__toolbar-group">
          <span className="collection__toolbar-label">Sort</span>
          <select
            className="collection__select"
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setSortOrder('asc') }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            className="btn-sort-order"
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Switch to descending' : 'Switch to ascending'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <div className="collection__toolbar-sep" />

        <div className="collection__toolbar-group">
          <span className="collection__toolbar-label">Style</span>
          <StyleMultiSelect
            options={allStyles}
            selected={filterStyles}
            onChange={setFilterStyles}
          />
        </div>

        <div className="collection__toolbar-group">
          <span className="collection__toolbar-label">Year</span>
          <select
            className="collection__select"
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
          >
            <option value="">All</option>
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="collection__toolbar-group">
          <span className="collection__toolbar-label">Tags</span>
          <TagFilter
            options={allTagOptions}
            selected={filterTags}
            onChange={setFilterTags}
            tags={tags ?? {}}
            onTagsChange={onTagsChange}
          />
        </div>

        {isFiltered && (
          <button
            className="collection__clear-filters"
            onClick={() => { setFilterStyles(new Set()); setFilterYear(''); setFilterTags(new Set()) }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── Search bar ── */}
      <div className="collection__search-bar">
        <div className="collection__search-wrap">
          <span className="collection__search-icon">⌕</span>
          <input
            className="collection__search-input"
            type="text"
            placeholder="Search artists, releases, labels, tracks…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="collection__search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button className="btn-text" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {loading && allReleases.length === 0 ? (
        <div className="spinner-wrap">
          <div className="spinner" />
        </div>
      ) : (
        <div className="collection__grid">
          {pageReleases.map((release, idx) => (
            <RecordCard
              key={`${release.instance_id ?? release.id}_${idx}`}
              release={release}
              isActive={release.id === activeReleaseId}
              onClick={onSelectRelease}
              playlists={playlists}
              onPlaylistsChange={onPlaylistsChange}
              tags={tags}
            />
          ))}
          {pageReleases.length === 0 && !loading && (
            <p className="empty-state" style={{ gridColumn: '1 / -1' }}>
              No records match your filters.
            </p>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn-page"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ← Prev
          </button>
          <span className="pagination__info">Page {currentPage} of {totalPages}</span>
          <button
            className="btn-page"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
