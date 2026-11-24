import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Share2,
  Flag,
  User,
  SkipForward,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import type { VideoItem, CommentItem, UserProfile } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchVideoById,
  fetchPublicVideos,
  fetchUserProfile,
  recordVideoView,
  toggleVideoReaction,
  getUserVideoReaction,
  toggleSaveVideo,
  isVideoSaved,
  isFollowingUser,
  toggleFollowUser,
  fetchComments,
  addComment,
  deleteComment,
} from '../services/firestoreService';
import { LoadingScreen } from '../components/LoadingScreen';
import { VideoCard } from '../components/VideoCard';
import { ReportModal } from '../components/ReportModal';
import { formatCount, formatDuration, formatRelativeTime, isSafeMediaUrl } from '../utils/format';

interface WatchPageProps {
  videoId: string;
  onWatch: (id: string) => void;
  onCreatorClick: (userId: string) => void;
  onSignInClick: () => void;
}

export const WatchPage: React.FC<WatchPageProps> = ({
  videoId,
  onWatch,
  onCreatorClick,
  onSignInClick,
}) => {
  const { t, language, autoplay, setAutoplay, dataSaver, showToast } = useApp();
  const { firebaseUser, profile } = useAuth();

  const [video, setVideo] = useState<VideoItem | null>(null);
  const [creator, setCreator] = useState<UserProfile | null>(null);
  const [related, setRelated] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState<'Auto' | 'HD' | 'Data Saver'>(
    dataSaver ? 'Data Saver' : 'Auto'
  );

  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [reportInfo, setReportInfo] = useState<{
    open: boolean;
    type: 'video' | 'comment';
    id: string;
    parentId?: string;
  }>({ open: false, type: 'video', id: '' });

  const playerWrapRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const viewRecordedFor = useRef<string>('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPlaying(false);
    setCurrentTime(0);

    Promise.all([
      fetchVideoById(videoId),
      fetchPublicVideos({ sortBy: 'recommended', pageSize: 10 }),
      fetchComments('videos', videoId),
    ])
      .then(async ([vid, rel, cmts]) => {
        if (!active) return;
        setVideo(vid);
        setRelated(rel.items.filter((v) => v.id !== videoId));
        setComments(cmts);

        if (vid) {
          const c = await fetchUserProfile(vid.creatorId);
          if (active) setCreator(c);

          if (viewRecordedFor.current !== vid.id) {
            viewRecordedFor.current = vid.id;
            recordVideoView(vid.id, firebaseUser?.uid);
          }

          if (firebaseUser) {
            const [rx, sv, fl] = await Promise.all([
              getUserVideoReaction(vid.id, firebaseUser.uid),
              isVideoSaved(vid.id, firebaseUser.uid),
              isFollowingUser(firebaseUser.uid, vid.creatorId),
            ]);
            if (active) {
              setReaction(rx);
              setSaved(sv);
              setFollowing(fl);
            }
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [videoId, firebaseUser]);

  const togglePlay = () => {
    const el = videoElRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (videoElRef.current) {
      videoElRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    setMuted(val === 0);
    if (videoElRef.current) {
      videoElRef.current.volume = val;
      videoElRef.current.muted = val === 0;
    }
  };

  const handleSpeedChange = (nextSpeed: number) => {
    setSpeed(nextSpeed);
    if (videoElRef.current) {
      videoElRef.current.playbackRate = nextSpeed;
    }
  };

  const handleFullscreen = () => {
    const el = playerWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  const handleReaction = async (type: 'like' | 'dislike') => {
    if (!firebaseUser || !profile) {
      onSignInClick();
      return;
    }
    if (!video) return;
    const prev = reaction;
    const next = await toggleVideoReaction(
      video.id,
      firebaseUser.uid,
      type,
      profile,
      video.creatorId
    );
    setReaction(next);
    setVideo((v) => {
      if (!v) return v;
      let likes = v.likesCount;
      let dislikes = v.dislikesCount;
      if (prev === 'like') likes = Math.max(0, likes - 1);
      if (prev === 'dislike') dislikes = Math.max(0, dislikes - 1);
      if (next === 'like') likes += 1;
      if (next === 'dislike') dislikes += 1;
      return { ...v, likesCount: likes, dislikesCount: dislikes };
    });
  };

  const handleSave = async () => {
    if (!firebaseUser) {
      onSignInClick();
      return;
    }
    if (!video) return;
    const next = await toggleSaveVideo(video.id, firebaseUser.uid);
    setSaved(next);
    showToast(next ? t.saved : t.save, 'success');
  };

  const handleFollow = async () => {
    if (!firebaseUser || !profile) {
      onSignInClick();
      return;
    }
    if (!video || video.creatorId === firebaseUser.uid) return;
    const next = await toggleFollowUser(profile, video.creatorId);
    setFollowing(next);
    setCreator((c) =>
      c ? { ...c, followersCount: Math.max(0, c.followersCount + (next ? 1 : -1)) } : c
    );
  };

  const handleShare = async () => {
    if (!video) return;
    const url = `${window.location.origin}/?v=${video.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: video.title, url });
        return;
      } catch {
        // fallback
      }
    }
    await navigator.clipboard.writeText(url);
    showToast(t.linkCopied, 'success');
  };

  const handleAddComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    if (!firebaseUser || !profile) {
      onSignInClick();
      return;
    }
    if (!video) return;
    const txt = parentId ? replyText : commentText;
    if (!txt.trim()) return;

    const created = await addComment({
      parentCollection: 'videos',
      parentId: video.id,
      author: profile,
      text: txt,
      replyToId: parentId,
      ownerId: video.creatorId,
    });
    setComments((prev) => [...prev, created]);
    setVideo((v) => (v ? { ...v, commentsCount: v.commentsCount + 1 } : v));
    if (parentId) {
      setReplyText('');
      setReplyingTo(null);
    } else {
      setCommentText('');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!video) return;
    await deleteComment('videos', video.id, commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
    setVideo((v) => (v ? { ...v, commentsCount: Math.max(0, v.commentsCount - 1) } : v));
  };

  if (loading) {
    return <LoadingScreen visible fullscreen={false} label={t.loading} />;
  }

  if (!video) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-sm text-neutral-500">{t.noResults}</p>
      </div>
    );
  }

  const nextVideo = related[0] || null;
  const topComments = comments.filter((c) => !c.parentId);
  const repliesByParent = comments.reduce<Record<string, CommentItem[]>>((acc, c) => {
    if (c.parentId) {
      acc[c.parentId] = acc[c.parentId] || [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Column */}
      <div className="lg:col-span-8 space-y-4">
        {/* Custom Video Player */}
        <div
          ref={playerWrapRef}
          className="relative rounded-2xl overflow-hidden bg-black border border-neutral-200 dark:border-neutral-800 group"
        >
          <video
            ref={videoElRef}
            src={video.videoUrl}
            poster={video.thumbnailUrl}
            preload={quality === 'Data Saver' ? 'metadata' : 'auto'}
            playsInline
            onClick={togglePlay}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || video.duration)}
            onEnded={() => {
              setPlaying(false);
              if (autoplay && nextVideo) {
                onWatch(nextVideo.id);
              }
            }}
            className="w-full aspect-video object-contain bg-black cursor-pointer"
          />

          {/* Controls Bar */}
          <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pt-6 pb-3 text-white space-y-2">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 accent-white cursor-pointer"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? 'Pause' : 'Play'}
                  className="p-1.5 rounded-lg hover:bg-white/15"
                >
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                {nextVideo && (
                  <button
                    type="button"
                    onClick={() => onWatch(nextVideo.id)}
                    aria-label={t.upNext}
                    className="p-1.5 rounded-lg hover:bg-white/15"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const nextMute = !muted;
                      setMuted(nextMute);
                      if (videoElRef.current) videoElRef.current.muted = nextMute;
                    }}
                    className="p-1 rounded hover:bg-white/15"
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 accent-white hidden sm:block"
                  />
                </div>

                <span className="font-mono tabular-nums text-[11px]">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label={t.playbackSpeed}
                  value={speed}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                  className="bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-[11px] font-mono"
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <option key={s} value={s}>
                      {s}x
                    </option>
                  ))}
                </select>

                <select
                  aria-label={t.quality}
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as 'Auto' | 'HD' | 'Data Saver')}
                  className="bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-[11px]"
                >
                  <option value="Auto">Auto</option>
                  <option value="HD">HD</option>
                  <option value="Data Saver">{t.dataSaver}</option>
                </select>

                <button
                  type="button"
                  onClick={handleFullscreen}
                  aria-label={t.fullscreen}
                  className="p-1.5 rounded-lg hover:bg-white/15"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Title & Actions */}
        <div>
          <h1 className="text-xl font-bold font-display leading-snug">{video.title}</h1>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            <span>
              {formatCount(video.viewsCount)} {t.views}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatRelativeTime(video.createdAt, language)}</span>
            <span aria-hidden="true">·</span>
            <span>{video.category}</span>
          </div>
        </div>

        {/* Creator + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-y border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onCreatorClick(video.creatorId)}
              className="flex items-center gap-2.5 text-start"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                {isSafeMediaUrl(creator?.photoURL || video.creatorPhotoURL) ? (
                  <img
                    src={creator?.photoURL || video.creatorPhotoURL}
                    alt={video.creatorName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-5 h-5 text-neutral-500" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold">{creator?.displayName || video.creatorName}</p>
                <p className="text-xs text-neutral-500 tabular-nums">
                  {formatCount(creator?.followersCount ?? 0)} {t.followers}
                </p>
              </div>
            </button>

            {video.creatorId !== firebaseUser?.uid && (
              <button
                type="button"
                onClick={handleFollow}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  following
                    ? 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    : 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950'
                }`}
              >
                {following ? t.unfollow : t.follow}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleReaction('like')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                reaction === 'like'
                  ? 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 border-neutral-950 dark:border-white'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">{formatCount(video.likesCount)}</span>
            </button>

            <button
              type="button"
              onClick={() => handleReaction('dislike')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                reaction === 'dislike'
                  ? 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 border-neutral-950 dark:border-white'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleSave}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                saved
                  ? 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 border-neutral-950 dark:border-white'
                  : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>{saved ? t.saved : t.save}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{t.share}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setReportInfo({ open: true, type: 'video', id: video.id })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>{t.report}</span>
            </button>
          </div>
        </div>

        {/* Description */}
        {(video.description || (video.tags && video.tags.length > 0)) && (
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 text-sm space-y-2">
            {video.description && (
              <p className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
                {video.description}
              </p>
            )}
            {video.tags && video.tags.length > 0 && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {video.tags.map((tag) => `#${tag}`).join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* Comments Section */}
        <section className="pt-2 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <h2 className="text-base font-bold font-display">
              {t.comments} ({video.commentsCount})
            </h2>
          </div>

          <form onSubmit={(e) => handleAddComment(e)} className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t.writeComment}
              className="flex-1 h-10 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm outline-none focus:border-neutral-400"
            />
            <button
              type="submit"
              className="px-4 h-10 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
            >
              {t.postComment}
            </button>
          </form>

          <div className="space-y-4">
            {topComments.map((cmt) => {
              const replies = repliesByParent[cmt.id] || [];
              return (
                <div key={cmt.id} className="space-y-2 border-b border-neutral-100 dark:border-neutral-900 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                        {isSafeMediaUrl(cmt.authorPhotoURL) ? (
                          <img
                            src={cmt.authorPhotoURL}
                            alt={cmt.authorName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-4 h-4 text-neutral-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold">{cmt.authorName}</span>
                          <span className="text-neutral-400">
                            {formatRelativeTime(cmt.createdAt, language)}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-800 dark:text-neutral-200 mt-0.5">
                          {cmt.text}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-500">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(cmt)}
                            className="hover:text-neutral-900 dark:hover:text-white font-medium"
                          >
                            {t.reply}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReportInfo({
                                open: true,
                                type: 'comment',
                                id: cmt.id,
                                parentId: video.id,
                              })
                            }
                            className="hover:text-neutral-900 dark:hover:text-white"
                          >
                            {t.report}
                          </button>
                        </div>
                      </div>
                    </div>

                    {firebaseUser?.uid === cmt.authorId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(cmt.id)}
                        aria-label={t.deleteText}
                        className="p-1.5 text-neutral-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {replyingTo?.id === cmt.id && (
                    <form
                      onSubmit={(e) => handleAddComment(e, cmt.id)}
                      className="ms-10 flex gap-2"
                    >
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={t.reply}
                        className="flex-1 h-8 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs outline-none"
                      />
                      <button
                        type="submit"
                        className="px-3 h-8 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
                      >
                        {t.postComment}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="px-2 text-xs text-neutral-500"
                      >
                        {t.cancelText}
                      </button>
                    </form>
                  )}

                  {replies.length > 0 && (
                    <div className="ms-10 space-y-2 pt-1">
                      {replies.map((rep) => (
                        <div key={rep.id} className="flex items-start justify-between gap-2 text-xs">
                          <div>
                            <span className="font-semibold">{rep.authorName}</span>
                            <span className="text-neutral-400 ms-2">
                              {formatRelativeTime(rep.createdAt, language)}
                            </span>
                            <p className="text-neutral-700 dark:text-neutral-300 mt-0.5">
                              {rep.text}
                            </p>
                          </div>
                          {firebaseUser?.uid === rep.authorId && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(rep.id)}
                              className="p-1 text-neutral-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Related / Up Next Column */}
      <aside className="lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{t.relatedVideos}</h2>
          <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
            <span>{t.autoplayNext}</span>
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
              className="accent-neutral-950 dark:accent-white"
            />
          </label>
        </div>

        <div className="space-y-4">
          {related.length === 0 ? (
            <p className="text-xs text-neutral-500">{t.noVideosYet}</p>
          ) : (
            related.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                compact
                onWatch={onWatch}
                onCreatorClick={onCreatorClick}
              />
            ))
          )}
        </div>
      </aside>

      <ReportModal
        open={reportInfo.open}
        onClose={() => setReportInfo((prev) => ({ ...prev, open: false }))}
        targetType={reportInfo.type}
        targetId={reportInfo.id}
        parentId={reportInfo.parentId}
      />
    </div>
  );
};
