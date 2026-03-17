import { useState, useEffect, useRef } from 'react'
import {
  getAllTags, getTagUsageCount,
  renameTagGlobally, deleteTagGlobally,
  DOT_COLORS, getTagColor, setTagColor,
} from '../services/tags'

export default function TagFilter({ options, selected, onChange, tags, onTagsChange, tagColors }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('list')   // 'list' | 'manager'
  const [search, setSearch] = useState('')
  const [renamingTag, setRenamingTag] = useState(null)  // tag string being renamed
  const [renameValue, setRenameValue] = useState('')
  const [coloringTag, setColoringTag] = useState(null)  // tag whose color is being changed
  const searchRef = useRef(null)
  const renameRef = useRef(null)
  const ref = useRef(null)

  // Reset internal state when dropdown closes
  useEffect(() => {
    if (!open) {
      setView('list')
      setSearch('')
      setRenamingTag(null)
      setRenameValue('')
      setColoringTag(null)
      return
    }
    setTimeout(() => searchRef.current?.focus(), 0)

    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingTag !== null) setTimeout(() => renameRef.current?.focus(), 0)
  }, [renamingTag])

  function toggle(tag) {
    const next = new Set(selected)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    onChange(next)
  }

  const label =
    selected.size === 0 ? 'All'
    : selected.size === 1 ? [...selected][0]
    : `${selected.size} tags`

  const visibleOptions = search
    ? options.filter(s => s.toLowerCase().includes(search.toLowerCase()))
    : options

  // Manager: show all tags across entire collection
  const allTagsList = getAllTags(tags)

  function handleRenameConfirm(oldTag) {
    const newTag = renameValue.trim().toLowerCase()
    if (!newTag || newTag === oldTag) { setRenamingTag(null); return }
    renameTagGlobally(tags, oldTag, newTag)
    // If old tag was selected in filter, swap it for new tag
    if (selected.has(oldTag)) {
      const next = new Set(selected)
      next.delete(oldTag)
      next.add(newTag)
      onChange(next)
    }
    onTagsChange()
    setRenamingTag(null)
  }

  function handleDelete(tag) {
    deleteTagGlobally(tags, tag)
    if (selected.has(tag)) {
      const next = new Set(selected)
      next.delete(tag)
      onChange(next)
    }
    onTagsChange()
  }

  function handleColorChange(tag, color) {
    setTagColor(tag, color)
    setColoringTag(null)
    onTagsChange()
  }

  return (
    <div className={`tag-ms${open ? ' tag-ms--open' : ''}`} ref={ref}>
      <button
        className={`tag-ms__trigger${selected.size > 0 ? ' tag-ms__trigger--active' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className="tag-ms__label">{label}</span>
        <span className="tag-ms__arrow">▾</span>
      </button>

      {open && (
        <div className="tag-ms__dropdown">
          {view === 'list' ? (
            <>
              <div className="tag-ms__search-wrap">
                <input
                  ref={searchRef}
                  className="tag-ms__search"
                  type="text"
                  placeholder="Search tags…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                />
                {search && (
                  <button
                    className="tag-ms__search-clear"
                    onMouseDown={e => { e.stopPropagation(); setSearch('') }}
                    tabIndex={-1}
                  >
                    ✕
                  </button>
                )}
              </div>

              {selected.size > 0 && (
                <button className="tag-ms__clear" onClick={() => onChange(new Set())}>
                  ✕ Clear selection
                </button>
              )}

              <div className="tag-ms__list">
                {visibleOptions.length === 0 && (
                  <p className="tag-ms__no-results">
                    {options.length === 0 ? 'No tags yet' : 'No tags found'}
                  </p>
                )}
                {visibleOptions.map(s => (
                  <label key={s} className={`tag-ms__item${selected.has(s) ? ' tag-ms__item--checked' : ''}`}>
                    <span className={`tag-ms__checkbox${selected.has(s) ? ' tag-ms__checkbox--checked' : ''}`}>
                      {selected.has(s) ? '✓' : ''}
                    </span>
                    <input
                      type="checkbox"
                      checked={selected.has(s)}
                      onChange={() => toggle(s)}
                      className="tag-ms__hidden-input"
                    />
                    <span
                      className="tag-dot tag-dot--sm"
                      style={{ background: getTagColor(tagColors, s) }}
                    />
                    {s}
                  </label>
                ))}
              </div>

              <div className="tag-ms__separator" />
              <button
                className="tag-ms__manage-btn"
                onClick={() => setView('manager')}
              >
                ⚙ Manage tags
              </button>
            </>
          ) : (
            /* ── Tag Manager view ── */
            <>
              <div className="tag-manager__header">
                <button className="tag-manager__back" onClick={() => setView('list')}>←</button>
                <span className="tag-manager__title">Manage Tags</span>
              </div>

              <div className="tag-manager__list">
                {allTagsList.length === 0 && (
                  <p className="tag-ms__no-results">No tags yet</p>
                )}
                {allTagsList.map(tag => (
                  <div key={tag} className="tag-manager__item">
                    {/* Color dot / inline palette */}
                    {coloringTag === tag ? (
                      <div className="tag-manager__color-palette">
                        {DOT_COLORS.map(color => (
                          <button
                            key={color}
                            className="tag-dot-swatch"
                            style={{ background: color }}
                            onClick={() => handleColorChange(tag, color)}
                            title="Set color"
                          />
                        ))}
                        <button
                          className="tag-manager__btn"
                          onClick={() => setColoringTag(null)}
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          className="tag-dot tag-dot--sm tag-dot--clickable"
                          style={{ background: getTagColor(tagColors, tag) }}
                          onClick={() => setColoringTag(tag)}
                          title="Change color"
                        />
                        {renamingTag === tag ? (
                          <>
                            <input
                              ref={renameRef}
                              className="tag-manager__rename-input"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameConfirm(tag)
                                if (e.key === 'Escape') setRenamingTag(null)
                              }}
                              onBlur={() => handleRenameConfirm(tag)}
                            />
                            <button
                              className="tag-manager__btn"
                              onMouseDown={e => { e.preventDefault(); handleRenameConfirm(tag) }}
                              title="Confirm rename"
                            >
                              ✓
                            </button>
                            <button
                              className="tag-manager__btn"
                              onMouseDown={e => { e.preventDefault(); setRenamingTag(null) }}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="tag-manager__name">{tag}</span>
                            <span className="tag-manager__count">{getTagUsageCount(tags, tag)}</span>
                            <button
                              className="tag-manager__btn"
                              onClick={() => { setRenamingTag(tag); setRenameValue(tag) }}
                              title="Rename tag"
                            >
                              ✎
                            </button>
                            <button
                              className="tag-manager__btn tag-manager__btn--delete"
                              onClick={() => handleDelete(tag)}
                              title="Delete tag globally"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
