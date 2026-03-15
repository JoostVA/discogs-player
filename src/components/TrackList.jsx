import { makeOverrideKey } from '../services/overrides'

export default function TrackList({ tracks, currentTrack, isPlaying, overrideKeys, releaseId, onPlay, onTogglePlay }) {
  const headings = tracks.filter(t => t.type_ === 'heading')
  const hasHeadings = headings.length > 0

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

        return (
          <li
            key={idx}
            className={`track-list__item${isCurrentTrack ? ' track-list__item--playing' : ''}`}
          >
            <span className="track-list__position">
              {track.position || (hasHeadings ? '' : idx + 1)}
            </span>
            <button
              className="track-list__play-btn"
              onClick={() => isCurrentTrack ? onTogglePlay?.() : onPlay(track)}
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
          </li>
        )
      })}
    </ol>
  )
}
