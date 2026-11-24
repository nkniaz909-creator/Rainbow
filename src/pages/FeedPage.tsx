import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Heart,
  ThumbsUp,
  MessageSquare,
  Share2,
  Flag,
  ShieldBan,
  Trash2,
  User,
  Film,
  Send,
  X,
} from 'lucide-react';
import type { SocialPost, CommentItem, VideoItem } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchPublicPosts,
  createPost,
  deletePost,
  togglePostReaction,
  fetchComments,
  addComment,
  uploadFileWithProgress,
  fetchBlockedIds,
  toggleBlockUser,
  fetchCreatorVideos,
} from '../services/firestoreService';
import { LoadingScreen } from '../components/LoadingScreen';
import { ReportModal } from '../components/ReportModal';
import { formatRelativeTime, generateId, isSafeMediaUrl } from '../utils/format';

interface FeedPageProps {
  onWatch: (videoId: string) => void;
  onCreatorClick: (userId: string) => void;
  onSignInClick: () => void;
}

export const FeedPage: React.FC<FeedPageProps> = ({
  onWatch,
  onCreatorClick,
  onSignInClick,
}) => {
  const { t, language, showToast } = useApp();
  const { firebaseUser, profile } = useAuth();

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [myVideos, setMyVideos] = useState<VideoItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [publishing, setPublishing] = useState(false);

  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentItem[]>>({});
  const [commentInput, setCommentInput] = useState('');
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const [feedPosts, blocked] = await Promise.all([
        fetchPublicPosts(30),
        firebaseUser ? fetchBlockedIds(firebaseUser.uid) : Promise.resolve([]),
      ]);
      setBlockedIds(blocked);
      setPosts(feedPosts.filter((p) => !blocked.includes(p.authorId)));
      if (firebaseUser) {
        const mine = await fetchCreatorVideos(firebaseUser.uid, false);
        setMyVideos(mine);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [firebaseUser]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) {
      onSignInClick();
      return;
    }
    if (!postText.trim() && !postImage && !selectedVideoId) return;

    setPublishing(true);
    try {
      const postId = generateId('pst');
      let imageUrl = '';
      let imagePath = '';
      if (postImage) {
        imagePath = `posts/${firebaseUser.uid}/${postId}_${postImage.name}`;
        imageUrl = await uploadFileWithProgress(imagePath, postImage);
      }

      const attachedVid = myVideos.find((v) => v.id === selectedVideoId);
      const now = new Date().toISOString();
      const newPost: SocialPost = {
        id: postId,
        authorId: firebaseUser.uid,
        authorName: profile.displayName,
        authorUsername: profile.username,
        authorPhotoURL: profile.photoURL || '',
        ...(postText.trim() ? { text: postText.trim().slice(0, 3000) } : {}),
        ...(imageUrl ? { imageUrl, imagePath } : {}),
        ...(attachedVid
          ? {
              sharedVideoId: attachedVid.id,
              sharedVideoTitle: attachedVid.title,
              sharedVideoThumb: attachedVid.thumbnailUrl || '',
            }
          : {}),
        visibility,
        status: 'active',
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await createPost(newPost);
      setPosts((prev) => [newPost, ...prev]);
      setPostText('');
      setPostImage(null);
      setPostImagePreview('');
      setSelectedVideoId('');
    } catch {
      showToast(t.errorGeneric, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleReact = async (post: SocialPost, reaction: 'like' | 'love') => {
    if (!firebaseUser || !profile) {
      onSignInClick();
      return;
    }
    const res = await togglePostReaction(
      post.id,
      firebaseUser.uid,
      reaction,
      profile,
      post.authorId
    );
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likesCount: Math.max(0, p.likesCount + (res ? 1 : -1)) }
          : p
      )
    );
  };

  const toggleComments = async (postId: string) => {
    if (openCommentsFor === postId) {
      setOpenCommentsFor(null);
      return;
    }
    setOpenCommentsFor(postId);
    const list = await fetchComments('posts', postId);
    setCommentsMap((prev) => ({ ...prev, [postId]: list }));
  };

  const handleAddComment = async (e: React.FormEvent, post: SocialPost) => {
    e.preventDefault();
    if (!firebaseUser || !profile) {
      onSignInClick();
      return;
    }
    if (!commentInput.trim()) return;
    const created = await addComment({
      parentCollection: 'posts',
      parentId: post.id,
      author: profile,
      text: commentInput,
      ownerId: post.authorId,
    });
    setCommentsMap((prev) => ({
      ...prev,
      [post.id]: [...(prev[post.id] || []), created],
    }));
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, commentsCount: p.commentsCount + 1 } : p))
    );
    setCommentInput('');
  };

  const handleBlock = async (targetUserId: string) => {
    if (!firebaseUser) {
      onSignInClick();
      return;
    }
    await toggleBlockUser(firebaseUser.uid, targetUserId);
    setBlockedIds((prev) => [...prev, targetUserId]);
    setPosts((prev) => prev.filter((p) => p.authorId !== targetUserId));
    showToast(t.blockUser, 'info');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Create Post Composer */}
      <form
        onSubmit={handlePublish}
        className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
      >
        <textarea
          rows={3}
          maxLength={3000}
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder={t.createPostPlaceholder}
          className="w-full bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 text-sm outline-none resize-none"
        />

        {postImagePreview && (
          <div className="relative rounded-xl overflow-hidden max-h-64 bg-black">
            <img src={postImagePreview} alt="Preview" className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={() => {
                setPostImage(null);
                setPostImagePreview('');
              }}
              className="absolute top-2 end-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{t.addImage}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setPostImage(f);
                  setPostImagePreview(URL.createObjectURL(f));
                }}
                className="hidden"
              />
            </label>

            {myVideos.length > 0 && (
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs"
              >
                <option value="">{t.shareVideoOption}</option>
                {myVideos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            )}

            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'followers' | 'private')}
              className="h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs"
            >
              <option value="public">{t.publicOption}</option>
              <option value="followers">{t.followersOnlyOption}</option>
              <option value="private">{t.privateOption}</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={publishing}
            className="px-4 py-1.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold disabled:opacity-50"
          >
            {t.publishPost}
          </button>
        </div>
      </form>

      {/* Posts List */}
      {loading ? (
        <LoadingScreen visible fullscreen={false} label={t.loading} />
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center text-sm text-neutral-500">
          {t.noPostsYet}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onCreatorClick(post.authorId)}
                  className="flex items-center gap-2.5 text-start"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                    {isSafeMediaUrl(post.authorPhotoURL) ? (
                      <img
                        src={post.authorPhotoURL}
                        alt={post.authorName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-4 h-4 text-neutral-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{post.authorName}</p>
                    <p className="text-xs text-neutral-500">
                      {formatRelativeTime(post.createdAt, language)}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1">
                  {firebaseUser?.uid === post.authorId ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await deletePost(post);
                        setPosts((prev) => prev.filter((p) => p.id !== post.id));
                      }}
                      aria-label={t.deleteText}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setReportTarget(post.id)}
                        aria-label={t.report}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                      {!blockedIds.includes(post.authorId) && (
                        <button
                          type="button"
                          onClick={() => handleBlock(post.authorId)}
                          aria-label={t.blockUser}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600"
                        >
                          <ShieldBan className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {post.text && (
                <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
                  {post.text}
                </p>
              )}

              {isSafeMediaUrl(post.imageUrl) && (
                <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-black">
                  <img
                    src={post.imageUrl}
                    alt={post.authorName}
                    className="w-full max-h-96 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {post.sharedVideoId && (
                <button
                  type="button"
                  onClick={() => onWatch(post.sharedVideoId!)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-start hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Film className="w-5 h-5 shrink-0 text-neutral-500" />
                  <span className="text-xs font-semibold truncate">
                    {post.sharedVideoTitle || post.sharedVideoId}
                  </span>
                </button>
              )}

              <div className="flex items-center gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
                <button
                  type="button"
                  onClick={() => handleReact(post, 'like')}
                  className="inline-flex items-center gap-1.5 hover:text-neutral-950 dark:hover:text-white"
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="font-mono tabular-nums">{post.likesCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleReact(post, 'love')}
                  className="inline-flex items-center gap-1.5 hover:text-red-600"
                >
                  <Heart className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => toggleComments(post.id)}
                  className="inline-flex items-center gap-1.5 hover:text-neutral-950 dark:hover:text-white"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="font-mono tabular-nums">{post.commentsCount}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/?post=${post.id}`);
                    showToast(t.linkCopied, 'success');
                  }}
                  className="inline-flex items-center gap-1.5 hover:text-neutral-950 dark:hover:text-white"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{t.share}</span>
                </button>
              </div>

              {openCommentsFor === post.id && (
                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(commentsMap[post.id] || []).map((c) => (
                      <div key={c.id} className="text-xs">
                        <span className="font-semibold">{c.authorName}: </span>
                        <span className="text-neutral-700 dark:text-neutral-300">{c.text}</span>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => handleAddComment(e, post)} className="flex gap-2">
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder={t.writeComment}
                      className="flex-1 h-8 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs outline-none"
                    />
                    <button
                      type="submit"
                      className="w-8 h-8 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <ReportModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetType="post"
        targetId={reportTarget || ''}
      />
    </div>
  );
};
