import React, { useState } from 'react';
import { Film, User } from 'lucide-react';
import type { VideoItem } from '../types';
import { formatCount, formatDuration, formatRelativeTime, isSafeMediaUrl } from '../utils/format';
import { useApp } from '../contexts/AppContext';

interface VideoCardProps {
  video: VideoItem;
  onWatch: (videoId: string) => void;
  onCreatorClick?: (creatorId: string) => void;
  compact?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onWatch,
  onCreatorClick,
  compact = false,
}) => {
  const { t, language } = useApp();
  const [thumbError, setThumbError] = useState(false);

  const hasThumb = !thumbError && isSafeMediaUrl(video.thumbnailUrl);

  return (
    <article className="group flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => onWatch(video.id)}
        className={`relative w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-white ${
          video.isShort && !compact ? 'aspect-[9/16] max-h-80' : 'aspect-video'
        }`}
      >
        {hasThumb ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            onError={() => setThumbError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-600 p-4">
            <Film className="w-8 h-8 mb-1.5" />
            <span className="text-xs font-medium line-clamp-1 text-center">{video.title}</span>
          </div>
        )}
        <span className="absolute bottom-2 end-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-mono tabular-nums font-medium">
          {formatDuration(video.duration)}
        </span>
      </button>

      <div className="flex items-start gap-2.5">
        {!compact && (
          <button
            type="button"
            onClick={() => onCreatorClick && onCreatorClick(video.creatorId)}
            aria-label={video.creatorName}
            className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center mt-0.5"
          >
            {isSafeMediaUrl(video.creatorPhotoURL) ? (
              <img
                src={video.creatorPhotoURL}
                alt={video.creatorName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-4 h-4 text-neutral-500" />
            )}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onWatch(video.id)}
            className="text-start w-full"
          >
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 line-clamp-2 leading-snug group-hover:underline">
              {video.title}
            </h3>
          </button>

          <button
            type="button"
            onClick={() => onCreatorClick && onCreatorClick(video.creatorId)}
            className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors block truncate text-start"
          >
            {video.creatorName}
          </button>

          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            <span>
              {formatCount(video.viewsCount)} {t.views}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatRelativeTime(video.createdAt, language)}</span>
          </div>
        </div>
      </div>
    </article>
  );
};
