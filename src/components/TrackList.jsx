import { makeOverrideKey } from '../services/overrides'
import { getTrackTags, removeTag, getAllTags, getTagColor } from '../services/tags'
import TagInput from './TagInput'

export default function TrackList({ tracks, currentTrack, isPlaying, overrideKeys, releaseId, onPlay, onTogglePlay, tags, onTagsChange, tagColors }) {
  const headings = tracks.filter(t => t.type_ === 'heading')
  const hasHeadings = headings.length > 0
  const tagsEnabled = tags !== undefined && onTagsChange !== undefined

  function handleRemoveTag(position, tag) {
    removeTag(releaseId, position, tag)
    onTagsChange()
  }

  return (
    <ol className="track-list">
      {tracks.map((track, idx) => {
        if (track.type_ === 'heading') {
          return (
            <li key={idx} className="track-list__heading">
              {track.title}
            </li>
          )
        }

        const isCurrentTrack =
          currentTrack?.position === track.position &&
          currentTrack?.title === track.title
        const isTrackPlaying = isCurrentTrack && isPlaying

        const hasOverride = releaseId && overrideKeys
          ? overrideKeys.has(makeOverrideKey(releaseId, track))
          : false

        const trackTags = tagsEnabled
          ? getTrackTags(tags, releaseId, track.position)
          : []

        return (
          <li
            key={idx}
            className={`track-list__item${isCurrentTrack ? ' track-list__item--playing' : ''}`}
          >
            <div className="track-list__row">
              <span className="track-list__position">
                {track.position || (hasHeadings ? '' : idx + 1)}
              </span>
              <button
                className="track-list__play-btn"
                onClick={() => isCurrentTrack ? onTogglePlay?.() : onPlay(track, idx)}
                title={isTrackPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
              >
                {isTrackPlaying ? '⏸' : '▶'}
              </button>
              <span className="track-list__title">
                {track.title}
                {hasOverride && (
                  <span className="track-list__override-badge" title="Custom video set">✎</span>
                )}
              </span>
              {track.duration && (
                <span className="track-list__duration">{track.duration}</span>
              )}
            </div>

            {tagsEnabled && (
              <div className="track-list__tags">
                {trackTags.map(tag => (
                  <span className="tag-chip" key={tag}>
                    <span
                      className="tag-dot tag-dot--sm"
                      style={{ background: getTagColor(tagColors, tag) }}
                    />
                    {tag}
                    <button
                      className="tag-chip__remove"
                      onClick={e => { e.stopPropagation(); handleRemoveTag(track.position, tag) }}
                      title={`Remove tag "${tag}"`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <TagInput
                  releaseId={releaseId}
                  position={track.position}
                  tags={tags}
                  allTags={getAllTags(tags)}
                  onTagsChange={onTagsChange}
                />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
