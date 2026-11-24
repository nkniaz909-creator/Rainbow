import React, { useState, useEffect } from 'react';
import { Search, Clock, Trash2, User } from 'lucide-react';
import { VIDEO_CATEGORIES, type VideoItem, type UserProfile } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  searchPlatform,
  fetchSearchHistory,
  clearSearchHistory,
} from '../services/firestoreService';
import { VideoCard } from '../components/VideoCard';
import { LoadingScreen } from '../components/LoadingScreen';
import { formatCount, isSafeMediaUrl } from '../utils/format';

interface SearchPageProps {
  queryText: string;
  onSearch: (q: string) => void;
  onWatch: (videoId: string) => void;
  onCreatorClick: (userId: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  queryText,
  onSearch,
  onWatch,
  onCreatorClick,
}) => {
  const { t } = useApp();
  const { firebaseUser } = useAuth();

  const [filter, setFilter] = useState<'all' | 'videos' | 'shorts' | 'channels'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [shorts, setShorts] = useState<VideoItem[]>([]);
  const [creators, setCreators] = useState<UserProfile[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (firebaseUser) {
      fetchSearchHistory(firebaseUser.uid).then((items) =>
        setHistory(items.map((i) => i.query))
      );
    } else {
      try {
        setHistory(JSON.parse(localStorage.getItem('rainbow_search_history') || '[]'));
      } catch {
        setHistory([]);
      }
    }
  }, [firebaseUser, queryText]);

  useEffect(() => {
    if (!queryText.trim()) {
      setVideos([]);
      setShorts([]);
      setCreators([]);
      return;
    }
    setLoading(true);
    searchPlatform(queryText)
      .then((res) => {
        setVideos(res.videos);
        setShorts(res.shorts);
        setCreators(res.creators);
      })
      .finally(() => setLoading(false));
  }, [queryText]);

  const handleClearHistory = async () => {
    if (firebaseUser) {
      await clearSearchHistory(firebaseUser.uid);
    }
    localStorage.removeItem('rainbow_search_history');
    setHistory([]);
  };

  const filteredVideos =
    categoryFilter === 'All' ? videos : videos.filter((v) => v.category === categoryFilter);
  const filteredShorts =
    categoryFilter === 'All' ? shorts : shorts.filter((v) => v.category === categoryFilter);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Recent Search History */}
      {history.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{t.recentSearches}</span>
            </span>
            <button
              type="button"
              onClick={handleClearHistory}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.clearHistory}</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onSearch(term)}
                className="px-3 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900"
              >
                {term}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900">
          {(
            [
              { id: 'all', label: t.allFilter },
              { id: 'videos', label: t.videos },
              { id: 'shorts', label: t.shorts },
              { id: 'channels', label: t.channels },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                filter === item.id
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs"
        >
          <option value="All">{t.allCategories}</option>
          {VIDEO_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingScreen visible fullscreen={false} label={t.loading} />
      ) : !queryText.trim() ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-12 text-center">
          <Search className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
          <p className="text-sm text-neutral-500">{t.searchPlaceholder}</p>
        </div>
      ) : filteredVideos.length === 0 && filteredShorts.length === 0 && creators.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-12 text-center">
          <p className="text-sm text-neutral-500">{t.noResults}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(filter === 'all' || filter === 'channels') && creators.length > 0 && (
            <section>
              <h2 className="text-sm font-bold mb-3">{t.channels}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {creators.map((c) => (
                  <button
                    key={c.uid}
                    type="button"
                    onClick={() => onCreatorClick(c.uid)}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-start hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                      {isSafeMediaUrl(c.photoURL) ? (
                        <img
                          src={c.photoURL}
                          alt={c.displayName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-5 h-5 text-neutral-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{c.displayName}</p>
                      <p className="text-xs text-neutral-500 truncate">
                        @{c.username} · {formatCount(c.followersCount)} {t.followers}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(filter === 'all' || filter === 'videos') && filteredVideos.length > 0 && (
            <section>
              <h2 className="text-sm font-bold mb-3">{t.videos}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredVideos.map((v) => (
                  <VideoCard
                    key={v.id}
                    video={v}
                    onWatch={onWatch}
                    onCreatorClick={onCreatorClick}
                  />
                ))}
              </div>
            </section>
          )}

          {(filter === 'all' || filter === 'shorts') && filteredShorts.length > 0 && (
            <section>
              <h2 className="text-sm font-bold mb-3">{t.shorts}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {filteredShorts.map((v) => (
                  <VideoCard
                    key={v.id}
                    video={v}
                    onWatch={onWatch}
                    onCreatorClick={onCreatorClick}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
