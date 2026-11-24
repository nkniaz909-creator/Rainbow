import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Share2,
  Flag,
  ChevronUp,
  ChevronDown,
  User,
  Upload,
  X,
  Send,
  Loader2,
} from 'lucide-react';
import type { VideoItem, CommentItem } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchPublicVideos,
  toggleVideoReaction,
  getUserVideoReaction,
  isFollowingUser,
  toggleFollowUser,
  fetchComments,
  addComment,
  recordVideoView,
} from '../services/firestoreService';
import { ReportModal } from '../components/ReportModal';
import { LoadingScreen } from '../components/LoadingScreen';
import { formatCount, isSafeMediaUrl } from '../utils/format';

interface ShortsPageProps {
  onCreatorClick: (userId: string) => void;
  onUploadClick: () => void;
  onSignInClick: () => void;
}

export const ShortsPage: React.FC<ShortsPageProps> = ({
  onCreatorClick,
  onUploadClick,
  onSignInClick,
}) => {
  const { t, shortsAutoplay, dataSaver, showToast } = useApp();
  const { firebaseUser, profile } = useAuth();

  const [shorts, setShorts] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null);
  const [followingCreator, setFollowingCreator] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState('');
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const viewedSet = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetchPublicVideos({ isShort: true, sortBy: 'latest', pageSize: 20 })
      .then((res) => setShorts(res.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const currentShort = shorts[activeIndex] || null;

  useEffect(() => {
    if (!currentShort) return;
    setDescExpanded(false);
    setPaused(!shortsAutoplay);

    if (!viewedSet.current.has(currentShort.id)) {
      viewedSet.current.add(currentShort.id);
      recordVideoView(currentShort.id, firebaseUser?.uid);
    }

    // Play active video, pause others
    Object.entries(videoRefs.current).forEach(([id, el]) => {
      if (!el) return;
      if (id === currentShort.id) {
        if (shortsAutoplay) {
          el.play().catch(() => setPaused(true));
        }
      } else {
        el.pause();
        el.currentTime = 0;
      }
    });

    if (firebaseUser) {
      getUserVideoReaction(currentShort.id, firebaseUser.uid).then(setReaction);
      isFollowingUser(firebaseUser.uid, currentShort.creatorId).then(setFollowingCreator);
    } else {
      setReaction(null);
      setFollowingCreator(false);
    }
  }, [activeIndex, currentShort, shortsAutoplay, firebaseUser]);

  useEffect(() => {
    if (commentsOpen && currentShort) {
      fetchComments('videos', currentShort.id).then(setComments);
    }
  }, [commentsOpen, currentShort]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || el.clientHeight === 0) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    if (idx !== activeIndex && idx >= 0 && idx < shorts.length) {
      setActiveIndex(idx);
    }
  };

  const scrollToIndex = (idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(shorts.length - 1, idx));
    el.scrollTo({ top: clamped * el.clientHeight, behavior: 'smooth' });
  };

  const togglePlay = (id: string) => {
    const el = videoRefs.current[id];
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  };

  const handleReaction = async (type: 'like' | 'dislike') => {
    if (!firebaseUser || !profile) {
      onSignInClick();
      return;
    }
    if (!currentShort) return;
    const next = await toggleVideoReaction(
      currentShort.id,
      firebaseUser.uid,
      type,
      profile,
      currentShort.creatorId
    );
    setReaction(next);
    setShorts((prev) =>
      prev.map((v) => {
        if (v.id !== currentShort.id) return v;
        let likes = v.likesCount;
        let dislikes = v.dislikesCount;
        if (reaction === 'like') likes = Math.max(0, likes - 1);
        if (reaction === 'dislike') dislikes = Math.max(0, dislikes - 1);
        if (next === 'like') likes += 1;
        if (next === 'dislike') dislikes += 1;
        return { ...v, likesCount: likes, dislikesCount: dislikes };
      })
    );
  };

  const handleFollow = async () => {
    if (!firebaseUser || !profile) {
      onSignInClick();
      return;
    }
    if (!currentShort || currentShort.creatorId === firebaseUser.uid) return;
    const next = await toggleFollowUser(profile, currentShort.creatorId);
    setFollowingCreator(next);
  };

  const handleShare = async () => {
    if (!currentShort) return;
    const url = `${window.location.origin}/?v=${currentShort.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: currentShort.title, url });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    showToast(t.linkCopied, 'success');
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) {
      onSignInClick();
      return;
    }
    if (!currentShort || !commentText.trim()) return;
    const created = await addComment({
      parentCollection: 'videos',
      parentId: currentShort.id,
      author: profile,
      text: commentText,
      ownerId: currentShort.creatorId,
    });
    setComments((prev) => [...prev, created]);
    setCommentText('');
  };

  if (loading) {
    return <LoadingScreen visible fullscreen={false} label={t.loading} />;
  }

  if (shorts.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-10">
          <h2 className="text-lg font-bold mb-2">{t.noShortsYet}</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            {t.noShortsDesc}
          </p>
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-semibold"
          >
            <Upload className="w-4 h-4" />
            <span>{t.upload}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-7rem)] lg:h-[calc(100vh-3.5rem)] w-full flex items-center justify-center bg-black overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full max-w-[440px] overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {shorts.map((item, idx) => (
          <div
            key={item.id}
            className="relative h-full w-full snap-start flex items-center justify-center bg-black"
          >
            <video
              ref={(el) => {
                videoRefs.current[item.id] = el;
              }}
              src={item.videoUrl}
              loop
              playsInline
              muted={muted}
              preload={dataSaver ? 'metadata' : 'auto'}
              onClick={() => togglePlay(item.id)}
              onWaiting={() => idx === activeIndex && setBuffering(true)}
              onPlaying={() => idx === activeIndex && setBuffering(false)}
              className="w-full h-full object-cover cursor-pointer"
            />

            {idx === activeIndex && buffering && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
            )}

            {idx === activeIndex && paused && !buffering && (
              <button
                type="button"
                onClick={() => togglePlay(item.id)}
                className="absolute inset-0 flex items-center justify-center bg-black/20"
              >
                <span className="w-16 h-16 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <Play className="w-7 h-7 ms-0.5" />
                </span>
              </button>
            )}

            {/* Top Mute / Play controls */}
            <div className="absolute top-4 end-4 flex items-center gap-2 z-10">
              <button
                type="button"
                onClick={() => togglePlay(item.id)}
                className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
              >
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Bottom Creator & Description Overlay */}
            <div className="absolute inset-x-0 bottom-0 p-4 pt-16 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white pe-16">
              <div className="flex items-center gap-2.5 mb-2">
                <button
                  type="button"
                  onClick={() => onCreatorClick(item.creatorId)}
                  className="flex items-center gap-2 text-start"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-700 flex items-center justify-center shrink-0">
                    {isSafeMediaUrl(item.creatorPhotoURL) ? (
                      <img
                        src={item.creatorPhotoURL}
                        alt={item.creatorName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-semibold truncate max-w-[140px]">
                    @{item.creatorUsername}
                  </span>
                </button>

                {item.creatorId !== firebaseUser?.uid && (
                  <button
                    type="button"
                    onClick={handleFollow}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      followingCreator
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-black'
                    }`}
                  >
                    {followingCreator ? t.unfollow : t.follow}
                  </button>
                )}
              </div>

              <h3 className="text-sm font-semibold line-clamp-2">{item.title}</h3>
              {item.description && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-1 text-xs text-white/80 text-start"
                >
                  <span className={descExpanded ? '' : 'line-clamp-1'}>
                    {item.description}
                  </span>
                </button>
              )}
            </div>

            {/* Right Action Rail */}
            <div className="absolute end-3 bottom-6 flex flex-col items-center gap-4 text-white z-10">
              <button
                type="button"
                onClick={() => handleReaction('like')}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm ${
                    reaction === 'like' ? 'bg-white text-black' : 'bg-black/50 text-white'
                  }`}
                >
                  <ThumbsUp className="w-5 h-5" />
                </span>
                <span className="text-[11px] font-mono tabular-nums">
                  {formatCount(item.likesCount)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleReaction('dislike')}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm ${
                    reaction === 'dislike' ? 'bg-white text-black' : 'bg-black/50 text-white'
                  }`}
                >
                  <ThumbsDown className="w-5 h-5" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCommentsOpen(true)}
                className="flex flex-col items-center gap-1"
              >
                <span className="w-11 h-11 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                  <MessageSquare className="w-5 h-5" />
                </span>
                <span className="text-[11px] font-mono tabular-nums">
                  {formatCount(item.commentsCount)}
                </span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex flex-col items-center gap-1"
              >
                <span className="w-11 h-11 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                  <Share2 className="w-5 h-5" />
                </span>
                <span className="text-[11px]">{t.share}</span>
              </button>

              <button
                type="button"
                onClick={() => setReportTargetId(item.id)}
                aria-label={t.report}
                className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Prev/Next Scroll Controls */}
      <div className="hidden md:flex flex-col gap-2 ms-4">
        <button
          type="button"
          onClick={() => scrollToIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollToIndex(activeIndex + 1)}
          disabled={activeIndex >= shorts.length - 1}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Comments Drawer */}
      {commentsOpen && currentShort && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full sm:max-w-md h-[70vh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold">{t.comments}</h3>
              <button
                type="button"
                onClick={() => setCommentsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-8">{t.noResults}</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="text-sm">
                    <span className="font-semibold text-xs">{c.authorName}</span>
                    <p className="text-neutral-700 dark:text-neutral-300 text-xs mt-0.5">{c.text}</p>
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={handlePostComment}
              className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t.writeComment}
                className="flex-1 h-9 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs outline-none"
              />
              <button
                type="submit"
                className="w-9 h-9 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      <ReportModal
        open={Boolean(reportTargetId)}
        onClose={() => setReportTargetId(null)}
        targetType="video"
        targetId={reportTargetId || ''}
      />
    </div>
  );
};
