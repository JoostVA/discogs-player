import { useState, useEffect, useRef } from 'react'
import { addTag, getTrackTags } from '../services/tags'

export default function TagInput({ releaseId, position, tags, allTags, onTagsChange }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const wrapRef = useRef(null)

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setValue('')
      setActiveIdx(-1)
    }
  }, [open])

  // Close on outside mousedown
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentTags = getTrackTags(tags, releaseId, position)

  // Suggestions: existing tags matching the input, minus already-applied ones
  const suggestions = allTags.filter(t =>
    !currentTags.includes(t) &&
    (value.trim() === '' || t.toLowerCase().includes(value.trim().toLowerCase()))
  )

  function handleAdd(tag) {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return
    addTag(releaseId, position, trimmed)
    onTagsChange()
    setValue('')
    setActiveIdx(-1)
    // Keep input open so user can add more tags
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        handleAdd(suggestions[activeIdx])
      } else if (value.trim()) {
        handleAdd(value)
      }
    }
  }

  return (
    <div className="tag-input-wrap" ref={wrapRef}>
      {open ? (
        <>
          <input
            ref={inputRef}
            className="tag-input__field"
            type="text"
            placeholder="Add tag…"
            value={value}
            onChange={e => { setValue(e.target.value); setActiveIdx(-1) }}
            onKeyDown={handleKeyDown}
          />
          {(suggestions.length > 0 || value.trim()) && (
            <div className="tag-input__suggestions">
              {suggestions.map((s, i) => (
                <div
                  key={s}
                  className={`tag-input__suggestion${i === activeIdx ? ' tag-input__suggestion--active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); handleAdd(s) }}
                >
                  {s}
                </div>
              ))}
              {value.trim() && !suggestions.some(s => s === value.trim().toLowerCase()) && (
                <div
                  className="tag-input__suggestion tag-input__suggestion--new"
                  onMouseDown={e => { e.preventDefault(); handleAdd(value) }}
                >
                  Create "{value.trim().toLowerCase()}"
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <button
          className="track-list__tag-add"
          onClick={e => { e.stopPropagation(); setOpen(true) }}
          title="Add tag"
        >
          ＋
        </button>
      )}
    </div>
  )
}
