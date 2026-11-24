import React, { useState, useEffect } from 'react';
import {
  User,
  Edit3,
  Share2,
  MessageSquare,
  Flag,
  ShieldBan,
  Lock,
  Camera,
  X,
} from 'lucide-react';
import type { UserProfile, VideoItem, SocialPost } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchUserProfile,
  fetchCreatorVideos,
  fetchUserPosts,
  fetchSavedVideos,
  isFollowingUser,
  toggleFollowUser,
  toggleBlockUser,
  updateUserProfileData,
  uploadFileWithProgress,
} from '../services/firestoreService';
import { VideoCard } from '../components/VideoCard';
import { LoadingScreen } from '../components/LoadingScreen';
import { ReportModal } from '../components/ReportModal';
import { formatCount, formatRelativeTime, isSafeMediaUrl } from '../utils/format';

interface ProfilePageProps {
  targetUserId: string;
  onWatch: (videoId: string) => void;
  onMessageUser: (user: UserProfile) => void;
  onSignInClick: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  targetUserId,
  onWatch,
  onMessageUser,
  onSignInClick,
}) => {
  const { t, language, showToast } = useApp();
  const { firebaseUser, profile: currentProfile, refreshProfile } = useAuth();

  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [savedVideos, setSavedVideos] = useState<VideoItem[]>([]);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState<'videos' | 'shorts' | 'posts' | 'saved'>('videos');
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPrivate, setEditPrivate] = useState(false);
  const [editShowSaved, setEditShowSaved] = useState(false);
  const [editWhoMsg, setEditWhoMsg] = useState<'everyone' | 'following' | 'nobody'>('everyone');
  const [savingEdit, setSavingEdit] = useState(false);

  const isOwn = firebaseUser?.uid === targetUserId;

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      fetchUserProfile(targetUserId),
      fetchCreatorVideos(targetUserId, isOwn),
      fetchUserPosts(targetUserId, isOwn),
      firebaseUser ? isFollowingUser(firebaseUser.uid, targetUserId) : Promise.resolve(false),
    ])
      .then(async ([prof, vids, psts, isFl]) => {
        if (!active) return;
        setViewedProfile(prof);
        setVideos(vids);
        setPosts(psts);
        setFollowing(isFl);

        if (prof) {
          setEditName(prof.displayName);
          setEditUsername(prof.username);
          setEditBio(prof.bio || '');
          setEditPrivate(prof.isPrivate);
          setEditShowSaved(Boolean(prof.showSavedPublicly));
          setEditWhoMsg(prof.whoCanMessage);

          if (isOwn || prof.showSavedPublicly) {
            const sv = await fetchSavedVideos(targetUserId);
            if (active) setSavedVideos(sv);
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [targetUserId, isOwn, firebaseUser]);

  const handleFollow = async () => {
    if (!firebaseUser || !currentProfile) {
      onSignInClick();
      return;
    }
    if (!viewedProfile || isOwn) return;
    const next = await toggleFollowUser(currentProfile, viewedProfile.uid);
    setFollowing(next);
    setViewedProfile((p) =>
      p ? { ...p, followersCount: Math.max(0, p.followersCount + (next ? 1 : -1)) } : p
    );
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    const url = await uploadFileWithProgress(
      `avatars/${firebaseUser.uid}/avatar_${Date.now()}.jpg`,
      file
    );
    await updateUserProfileData(firebaseUser.uid, { photoURL: url });
    setViewedProfile((p) => (p ? { ...p, photoURL: url } : p));
    await refreshProfile();
    showToast(t.saveChanges, 'success');
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    const url = await uploadFileWithProgress(
      `covers/${firebaseUser.uid}/cover_${Date.now()}.jpg`,
      file
    );
    await updateUserProfileData(firebaseUser.uid, { coverURL: url });
    setViewedProfile((p) => (p ? { ...p, coverURL: url } : p));
    await refreshProfile();
    showToast(t.saveChanges, 'success');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !viewedProfile) return;
    setSavingEdit(true);
    try {
      const updates: Partial<UserProfile> = {
        displayName: editName.trim().slice(0, 80) || viewedProfile.displayName,
        username:
          editUsername.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 40) ||
          viewedProfile.username,
        bio: editBio.trim().slice(0, 500),
        isPrivate: editPrivate,
        showSavedPublicly: editShowSaved,
        whoCanMessage: viewedProfile.isMinor && editWhoMsg === 'everyone' ? 'following' : editWhoMsg,
      };
      await updateUserProfileData(firebaseUser.uid, updates);
      setViewedProfile((p) => (p ? { ...p, ...updates } : p));
      await refreshProfile();
      setEditOpen(false);
      showToast(t.saveChanges, 'success');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return <LoadingScreen visible fullscreen={false} label={t.loading} />;
  }

  if (!viewedProfile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-sm text-neutral-500">{t.noResults}</p>
      </div>
    );
  }

  const canSeePrivateContent = isOwn || !viewedProfile.isPrivate || following;
  const standardVideos = videos.filter((v) => !v.isShort);
  const shortVideos = videos.filter((v) => v.isShort);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 space-y-6">
      {/* Cover + Header */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900">
        <div className="relative h-36 sm:h-52 bg-neutral-100 dark:bg-neutral-800">
          {isSafeMediaUrl(viewedProfile.coverURL) ? (
            <img
              src={viewedProfile.coverURL}
              alt={viewedProfile.displayName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full rainbow-bar opacity-20" />
          )}

          {isOwn && (
            <label className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs font-medium cursor-pointer hover:bg-black/85">
              <Camera className="w-3.5 h-3.5" />
              <span>{t.coverPhoto}</span>
              <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
            </label>
          )}
        </div>

        <div className="px-5 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12 relative z-10">
            <div className="flex items-end gap-4">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white dark:border-neutral-900 overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                {isSafeMediaUrl(viewedProfile.photoURL) ? (
                  <img
                    src={viewedProfile.photoURL}
                    alt={viewedProfile.displayName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-8 h-8 text-neutral-500" />
                )}
                {isOwn && (
                  <label className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity">
                    <Camera className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="pb-1">
                <h1 className="text-xl font-bold font-display">{viewedProfile.displayName}</h1>
                <p className="text-xs text-neutral-500">@{viewedProfile.username}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isOwn ? (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t.editProfile}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleFollow}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold ${
                      following
                        ? 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        : 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950'
                    }`}
                  >
                    {following ? t.unfollow : t.follow}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      firebaseUser ? onMessageUser(viewedProfile) : onSignInClick()
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{t.messages}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    aria-label={t.report}
                    className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                  {firebaseUser && (
                    <button
                      type="button"
                      onClick={async () => {
                        await toggleBlockUser(firebaseUser.uid, viewedProfile.uid);
                        showToast(t.blockUser, 'info');
                      }}
                      aria-label={t.blockUser}
                      className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:text-red-600"
                    >
                      <ShieldBan className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/?u=${viewedProfile.uid}`
                  );
                  showToast(t.linkCopied, 'success');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{t.shareProfile}</span>
              </button>
            </div>
          </div>

          {viewedProfile.bio && (
            <p className="mt-4 text-sm text-neutral-700 dark:text-neutral-300 max-w-2xl">
              {viewedProfile.bio}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-neutral-600 dark:text-neutral-400 tabular-nums">
            <span>
              <strong className="text-neutral-950 dark:text-white">
                {formatCount(viewedProfile.followersCount)}
              </strong>{' '}
              {t.followers}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-neutral-950 dark:text-white">
                {formatCount(viewedProfile.followingCount)}
              </strong>{' '}
              {t.followingCount}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-neutral-950 dark:text-white">
                {formatCount(viewedProfile.videosCount)}
              </strong>{' '}
              {t.videos}
            </span>
          </div>
        </div>
      </div>

      {!canSeePrivateContent ? (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-10 text-center">
          <Lock className="w-7 h-7 mx-auto mb-2 text-neutral-400" />
          <p className="text-sm font-semibold">{t.privateAccount}</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 w-fit">
            {(
              [
                { id: 'videos', label: `${t.videos} (${standardVideos.length})` },
                { id: 'shorts', label: `${t.shorts} (${shortVideos.length})` },
                { id: 'posts', label: `${t.postsTab} (${posts.length})` },
                ...(isOwn || viewedProfile.showSavedPublicly
                  ? [{ id: 'saved' as const, label: `${t.savedTab} (${savedVideos.length})` }]
                  : []),
              ] as const
            ).map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  tab === tb.id
                    ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tab === 'videos' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {standardVideos.length === 0 ? (
                <p className="text-sm text-neutral-500 col-span-full">{t.noVideosYet}</p>
              ) : (
                standardVideos.map((v) => (
                  <VideoCard key={v.id} video={v} onWatch={onWatch} />
                ))
              )}
            </div>
          )}

          {tab === 'shorts' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {shortVideos.length === 0 ? (
                <p className="text-sm text-neutral-500 col-span-full">{t.noShortsYet}</p>
              ) : (
                shortVideos.map((v) => (
                  <VideoCard key={v.id} video={v} onWatch={onWatch} />
                ))
              )}
            </div>
          )}

          {tab === 'posts' && (
            <div className="space-y-4 max-w-2xl">
              {posts.length === 0 ? (
                <p className="text-sm text-neutral-500">{t.noPostsYet}</p>
              ) : (
                posts.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-2"
                  >
                    <p className="text-xs text-neutral-400">
                      {formatRelativeTime(p.createdAt, language)}
                    </p>
                    {p.text && <p className="text-sm">{p.text}</p>}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'saved' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {savedVideos.length === 0 ? (
                <p className="text-sm text-neutral-500 col-span-full">{t.noVideosYet}</p>
              ) : (
                savedVideos.map((v) => (
                  <VideoCard key={v.id} video={v} onWatch={onWatch} />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">{t.editProfile}</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">{t.displayNamePlaceholder}</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">{t.usernamePlaceholder}</label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">{t.bioLabel}</label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">{t.whoCanMessageLabel}</label>
                <select
                  value={editWhoMsg}
                  onChange={(e) =>
                    setEditWhoMsg(e.target.value as 'everyone' | 'following' | 'nobody')
                  }
                  className="w-full h-9 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm"
                >
                  {!viewedProfile.isMinor && <option value="everyone">{t.everyone}</option>}
                  <option value="following">{t.followersOnlyOption}</option>
                  <option value="nobody">{t.nobody}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={editPrivate}
                  onChange={(e) => setEditPrivate(e.target.checked)}
                />
                <span>{t.privateAccount}</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={editShowSaved}
                  onChange={(e) => setEditShowSaved(e.target.checked)}
                />
                <span>{t.savedPublicly}</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-800"
                >
                  {t.cancelText}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                >
                  {t.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="account"
        targetId={viewedProfile.uid}
      />
    </div>
  );
};
