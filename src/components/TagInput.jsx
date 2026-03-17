import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { addTag, getTrackTags, DOT_COLORS, setTagColor, autoAssignColor } from '../services/tags'

export default function TagInput({ releaseId, position, tags, allTags, onTagsChange }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  const [ddPos, setDdPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef(null)
  const wrapRef = useRef(null)
  const dropdownRef = useRef(null)

  // Compute viewport-relative position for the portal dropdown
  const updatePos = useCallback(() => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setDdPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }, [])

  useEffect(() => {
    if (open) {
      updatePos()
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setValue('')
      setActiveIdx(-1)
    }
  }, [open, updatePos])

  // Close on outside mousedown (checks both input wrap and portal dropdown)
  useEffect(() => {
    if (!open) return
    function handler(e) {
      const inWrap = wrapRef.current?.contains(e.target)
      const inDropdown = dropdownRef.current?.contains(e.target)
      if (!inWrap && !inDropdown) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Reposition on scroll / resize
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  const currentTags = getTrackTags(tags, releaseId, position)

  const suggestions = allTags.filter(t =>
    !currentTags.includes(t) &&
    (value.trim() === '' || t.toLowerCase().includes(value.trim().toLowerCase()))
  )

  const trimmedNew = value.trim().toLowerCase()
  const isNewTag = trimmedNew && !allTags.includes(trimmedNew) && !currentTags.includes(trimmedNew)

  function handleAdd(tag, color = null) {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return
    const isNew = !allTags.includes(trimmed)
    addTag(releaseId, position, trimmed)
    if (isNew) {
      if (color) {
        setTagColor(trimmed, color)
      } else {
        autoAssignColor(trimmed)
      }
    }
    onTagsChange()
    setValue('')
    setActiveIdx(-1)
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

  const dropdown = (suggestions.length > 0 || isNewTag) && (
    <div
      ref={dropdownRef}
      className="tag-input__suggestions"
      style={{ position: 'fixed', top: ddPos.top, left: ddPos.left }}
    >
      {suggestions.map((s, i) => (
        <div
          key={s}
          className={`tag-input__suggestion${i === activeIdx ? ' tag-input__suggestion--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); handleAdd(s) }}
        >
          {s}
        </div>
      ))}
      {isNewTag && (
        <div
          className="tag-input__suggestion tag-input__suggestion--new"
          onMouseDown={e => { e.preventDefault(); handleAdd(value) }}
        >
          <span className="tag-input__create-label">Create "{trimmedNew}"</span>
          <div
            className="tag-input__color-swatches"
            onMouseDown={e => e.stopPropagation()}
          >
            {DOT_COLORS.map(color => (
              <button
                key={color}
                className="tag-dot-swatch"
                style={{ background: color }}
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleAdd(value, color) }}
                title="Create with this color"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )

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
          {open && dropdown && createPortal(dropdown, document.body)}
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
