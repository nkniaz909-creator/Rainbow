import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Film, User, Megaphone } from 'lucide-react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import {
  VIDEO_CATEGORIES,
  type VideoItem,
  type UserProfile,
  type AnnouncementItem,
} from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchPublicVideos,
  fetchFollowingVideos,
  fetchFollowingIds,
  fetchPopularCreators,
  fetchAnnouncements,
} from '../services/firestoreService';
import { VideoCard } from '../components/VideoCard';
import { LoadingScreen } from '../components/LoadingScreen';
import { formatCount, isSafeMediaUrl } from '../utils/format';

interface HomePageProps {
  followingOnly?: boolean;
  onWatch: (videoId: string) => void;
  onCreatorClick: (userId: string) => void;
  onUploadClick: () => void;
  onSignInClick: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  followingOnly = false,
  onWatch,
  onCreatorClick,
  onUploadClick,
  onSignInClick,
}) => {
  const { t } = useApp();
  const { firebaseUser } = useAuth();

  const [tab, setTab] = useState<'recommended' | 'trending' | 'latest' | 'following'>(
    followingOnly ? 'following' : 'recommended'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [creators, setCreators] = useState<UserProfile[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setTab(followingOnly ? 'following' : 'recommended');
  }, [followingOnly]);

  const categoryLabel = (cat: string): string => {
    const map: Record<string, string> = {
      All: t.allCategories,
      Entertainment: t.catEntertainment,
      Education: t.catEducation,
      Technology: t.catTechnology,
      Gaming: t.catGaming,
      News: t.catNews,
      Sports: t.catSports,
      Music: t.catMusic,
      Islamic: t.catIslamic,
      Comedy: t.catComedy,
      Travel: t.catTravel,
      Cooking: t.catCooking,
      Science: t.catScience,
      Movies: t.catMovies,
      Lifestyle: t.catLifestyle,
      Other: t.catOther,
    };
    return map[cat] || cat;
  };

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [creatorsRes, annRes] = await Promise.all([
        fetchPopularCreators(10),
        fetchAnnouncements(),
      ]);
      setCreators(creatorsRes);
      setAnnouncements(annRes.slice(0, 1));

      if (tab === 'following') {
        if (!firebaseUser) {
          setVideos([]);
          setHasMore(false);
        } else {
          const ids = await fetchFollowingIds(firebaseUser.uid);
          const followingVids = await fetchFollowingVideos(ids);
          const filtered =
            selectedCategory === 'All'
              ? followingVids
              : followingVids.filter((v) => v.category === selectedCategory);
          setVideos(filtered);
          setHasMore(false);
        }
      } else {
        const res = await fetchPublicVideos({
          category: selectedCategory,
          sortBy: tab,
          pageSize: 12,
        });
        setVideos(res.items);
        setLastDoc(res.lastDoc);
        setHasMore(res.items.length === 12);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab, selectedCategory, firebaseUser]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleLoadMore = async () => {
    if (!lastDoc || loadingMore || tab === 'following') return;
    setLoadingMore(true);
    try {
      const res = await fetchPublicVideos({
        category: selectedCategory,
        sortBy: tab,
        pageSize: 12,
        cursor: lastDoc,
      });
      setVideos((prev) => [...prev, ...res.items]);
      setLastDoc(res.lastDoc);
      setHasMore(res.items.length === 12);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-6">
      {/* Platform Announcement */}
      {announcements.length > 0 && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-4 py-3 flex items-start gap-3">
          <Megaphone className="w-4 h-4 mt-0.5 text-neutral-700 dark:text-neutral-300 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
              {announcements[0].title}
            </p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
              {announcements[0].body}
            </p>
          </div>
        </div>
      )}

      {/* Feed Mode Switcher */}
      {!followingOnly && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900">
            {(
              [
                { id: 'recommended', label: t.recommended },
                { id: 'trending', label: t.trending },
                { id: 'latest', label: t.latest },
                { id: 'following', label: t.followingFeed },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  tab === item.id
                    ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold whitespace-nowrap hover:opacity-90"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t.upload}</span>
          </button>
        </div>
      )}

      {/* Categories Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {['All', ...VIDEO_CATEGORIES].map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 border transition-colors ${
                active
                  ? 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 border-neutral-950 dark:border-white'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              {categoryLabel(cat)}
            </button>
          );
        })}
      </div>

      {/* Popular Creators Strip */}
      {creators.length > 0 && !followingOnly && (
        <section>
          <h2 className="text-sm font-bold mb-3">{t.popularCreators}</h2>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
            {creators.map((creator) => (
              <button
                key={creator.uid}
                type="button"
                onClick={() => onCreatorClick(creator.uid)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 shrink-0 transition-colors"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                  {isSafeMediaUrl(creator.photoURL) ? (
                    <img
                      src={creator.photoURL}
                      alt={creator.displayName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-4 h-4 text-neutral-500" />
                  )}
                </div>
                <div className="text-start min-w-0">
                  <p className="text-xs font-semibold truncate max-w-[120px]">
                    {creator.displayName}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {formatCount(creator.followersCount)} {t.followers}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Video Grid */}
      {loading ? (
        <LoadingScreen visible fullscreen={false} label={t.loading} />
      ) : tab === 'following' && !firebaseUser ? (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-10 text-center max-w-lg mx-auto">
          <h3 className="text-base font-bold mb-2">{t.authRequired}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-5">
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
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center mx-auto mb-4">
            <Film className="w-6 h-6 text-neutral-500" />
          </div>
          <h3 className="text-base font-bold mb-1.5">{t.noVideosYet}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto mb-6">
            {t.noVideosDesc}
          </p>
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-semibold hover:opacity-90"
          >
            <Upload className="w-4 h-4" />
            <span>{t.uploadFirstVideo}</span>
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-7">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onWatch={onWatch}
                onCreatorClick={onCreatorClick}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-50"
              >
                {loadingMore ? t.loading : t.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
