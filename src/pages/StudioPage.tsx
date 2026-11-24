import React, { useState, useEffect } from 'react';
import {
  Eye,
  ThumbsUp,
  MessageSquare,
  Users,
  Edit3,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { VIDEO_CATEGORIES, type VideoItem } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchCreatorVideos,
  updateVideoDetails,
  deleteVideoComplete,
} from '../services/firestoreService';
import { LoadingScreen } from '../components/LoadingScreen';
import { formatCount, formatDuration, formatRelativeTime } from '../utils/format';

interface StudioPageProps {
  onWatch: (videoId: string) => void;
  onUploadClick: () => void;
  onSignInClick: () => void;
}

export const StudioPage: React.FC<StudioPageProps> = ({
  onWatch,
  onUploadClick,
  onSignInClick,
}) => {
  const { t, language, showToast } = useApp();
  const { firebaseUser, profile, refreshProfile } = useAuth();

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<VideoItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editVis, setEditVis] = useState<'public' | 'private'>('public');

  useEffect(() => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCreatorVideos(firebaseUser.uid, true)
      .then(setVideos)
      .finally(() => setLoading(false));
  }, [firebaseUser]);

  if (!firebaseUser || !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8">
          <h2 className="text-lg font-bold mb-2">{t.authRequired}</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            {t.signInToContinue}
          </p>
          <button
            type="button"
            onClick={onSignInClick}
            className="px-5 py-2.5 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-semibold"
          >
            {t.signIn}
          </button>
        </div>
      </div>
    );
  }

  const totalViews = videos.reduce((sum, v) => sum + v.viewsCount, 0);
  const totalLikes = videos.reduce((sum, v) => sum + v.likesCount, 0);
  const totalComments = videos.reduce((sum, v) => sum + v.commentsCount, 0);
  const maxViews = Math.max(1, ...videos.map((v) => v.viewsCount));

  const openEdit = (v: VideoItem) => {
    setEditing(v);
    setEditTitle(v.title);
    setEditDesc(v.description || '');
    setEditCat(v.category);
    setEditVis(v.visibility);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await updateVideoDetails(editing.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
      category: editCat,
      visibility: editVis,
    });
    setVideos((prev) =>
      prev.map((v) =>
        v.id === editing.id
          ? {
              ...v,
              title: editTitle.trim(),
              description: editDesc.trim(),
              category: editCat,
              visibility: editVis,
            }
          : v
      )
    );
    setEditing(null);
    showToast(t.saveChanges, 'success');
  };

  const handleDelete = async (v: VideoItem) => {
    await deleteVideoComplete(v);
    setVideos((prev) => prev.filter((item) => item.id !== v.id));
    await refreshProfile();
    showToast(t.deleteText, 'info');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">{t.studioTitle}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {profile.displayName} · @{profile.username}
          </p>
        </div>

        <button
          type="button"
          onClick={onUploadClick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{t.upload}</span>
        </button>
      </div>

      {/* Real KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t.totalViews, value: totalViews, icon: Eye },
          { label: t.totalLikes, value: totalLikes, icon: ThumbsUp },
          { label: t.totalComments, value: totalComments, icon: MessageSquare },
          { label: t.followers, value: profile.followersCount, icon: Users },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
            >
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                <span>{stat.label}</span>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums">
                {formatCount(stat.value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Real Video Views Chart */}
      {videos.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <h2 className="text-sm font-bold mb-4">{t.totalViews}</h2>
          <div className="space-y-3">
            {videos.slice(0, 8).map((v) => {
              const pct = Math.round((v.viewsCount / maxViews) * 100);
              return (
                <div key={v.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[70%] font-medium">{v.title}</span>
                    <span className="font-mono tabular-nums text-neutral-500">
                      {formatCount(v.viewsCount)} {t.views}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rainbow-bar rounded-full transition-all"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Video Management Table */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-sm font-bold">{t.manageVideos}</h2>
        </div>

        {loading ? (
          <LoadingScreen visible fullscreen={false} label={t.loading} />
        ) : videos.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-500">{t.noStudioVideos}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500">
                <tr>
                  <th className="py-3 px-4 text-start font-medium">{t.videoTitleLabel}</th>
                  <th className="py-3 px-4 text-start font-medium">{t.visibilityLabel}</th>
                  <th className="py-3 px-4 text-end font-medium">{t.views}</th>
                  <th className="py-3 px-4 text-end font-medium">{t.like}</th>
                  <th className="py-3 px-4 text-end font-medium">{t.comments}</th>
                  <th className="py-3 px-4 text-end font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {videos.map((v) => (
                  <tr key={v.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onWatch(v.id)}
                        className="font-semibold text-start hover:underline line-clamp-1 max-w-xs"
                      >
                        {v.title}
                      </button>
                      <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                        {formatDuration(v.duration)} · {formatRelativeTime(v.createdAt, language)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {v.visibility === 'public' ? t.publicOption : t.privateOption}
                    </td>
                    <td className="py-3 px-4 text-end font-mono tabular-nums text-xs">
                      {formatCount(v.viewsCount)}
                    </td>
                    <td className="py-3 px-4 text-end font-mono tabular-nums text-xs">
                      {formatCount(v.likesCount)}
                    </td>
                    <td className="py-3 px-4 text-end font-mono tabular-nums text-xs">
                      {formatCount(v.commentsCount)}
                    </td>
                    <td className="py-3 px-4 text-end">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(v)}
                          aria-label={t.editText}
                          className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(v)}
                          aria-label={t.deleteText}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit Video Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">{t.editText}</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">{t.videoTitleLabel}</label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">{t.descriptionLabel}</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.categoryLabel}</label>
                  <select
                    value={editCat}
                    onChange={(e) => setEditCat(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs"
                  >
                    {VIDEO_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.visibilityLabel}</label>
                  <select
                    value={editVis}
                    onChange={(e) => setEditVis(e.target.value as 'public' | 'private')}
                    className="w-full h-9 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs"
                  >
                    <option value="public">{t.publicOption}</option>
                    <option value="private">{t.privateOption}</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-800"
                >
                  {t.cancelText}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                >
                  {t.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
