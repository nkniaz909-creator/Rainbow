import React, { useState, useEffect } from 'react';
import { ShieldCheck, Megaphone, CheckCircle2, Ban, Trash2 } from 'lucide-react';
import type { ReportItem, AnnouncementItem } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchAllReports,
  resolveReport,
  adminModerateVideo,
  adminModerateUser,
  adminRemoveComment,
  fetchAnnouncements,
  publishAnnouncement,
} from '../services/firestoreService';
import { LoadingScreen } from '../components/LoadingScreen';
import { formatRelativeTime } from '../utils/format';

export const AdminPage: React.FC = () => {
  const { t, language, showToast } = useApp();
  const { firebaseUser, isAdmin } = useAuth();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverVerified, setServerVerified] = useState(false);

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');

  useEffect(() => {
    if (!firebaseUser || !isAdmin) {
      setLoading(false);
      return;
    }

    const verifyAndLoad = async () => {
      setLoading(true);
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setServerVerified(false);
          return;
        }
        setServerVerified(true);
        const [reps, anns] = await Promise.all([fetchAllReports(), fetchAnnouncements()]);
        setReports(reps);
        setAnnouncements(anns);
      } finally {
        setLoading(false);
      }
    };

    verifyAndLoad();
  }, [firebaseUser, isAdmin]);

  if (loading) {
    return <LoadingScreen visible fullscreen={false} label={t.loading} />;
  }

  if (!firebaseUser || !isAdmin || !serverVerified) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-neutral-400" />
        <p className="text-sm text-neutral-500">{t.authRequired}</p>
      </div>
    );
  }

  const handleDismiss = async (rep: ReportItem) => {
    await resolveReport(rep.id, 'dismissed', firebaseUser.uid);
    setReports((prev) => prev.map((r) => (r.id === rep.id ? { ...r, status: 'dismissed' } : r)));
  };

  const handleEnforce = async (rep: ReportItem, action: 'restrict' | 'remove') => {
    if (rep.targetType === 'video') {
      await adminModerateVideo(rep.targetId, action === 'restrict' ? 'restricted' : 'removed');
    } else if (rep.targetType === 'account') {
      await adminModerateUser(rep.targetId, true);
    } else if (rep.targetType === 'comment' && rep.parentId) {
      await adminRemoveComment('videos', rep.parentId, rep.targetId);
    }
    await resolveReport(rep.id, 'resolved', firebaseUser.uid);
    setReports((prev) => prev.map((r) => (r.id === rep.id ? { ...r, status: 'resolved' } : r)));
    showToast(t.saveChanges, 'success');
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    const created = await publishAnnouncement(firebaseUser.uid, annTitle, annBody);
    setAnnouncements((prev) => [created, ...prev]);
    setAnnTitle('');
    setAnnBody('');
    showToast(t.publishAnnouncement, 'success');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-8">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="w-6 h-6" />
        <h1 className="text-2xl font-bold font-display">{t.moderationDashboard}</h1>
      </div>

      {/* Announcements Composer */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4" />
          <h2 className="text-sm font-bold">{t.announcements}</h2>
        </div>

        <form onSubmit={handlePublishAnnouncement} className="space-y-3 max-w-xl">
          <input
            type="text"
            required
            maxLength={160}
            value={annTitle}
            onChange={(e) => setAnnTitle(e.target.value)}
            placeholder={t.videoTitleLabel}
            className="w-full h-10 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm"
          />
          <textarea
            rows={3}
            required
            maxLength={3000}
            value={annBody}
            onChange={(e) => setAnnBody(e.target.value)}
            placeholder={t.descriptionLabel}
            className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm resize-none"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
          >
            {t.publishAnnouncement}
          </button>
        </form>

        {announcements.length > 0 && (
          <div className="space-y-2 pt-2">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs"
              >
                <p className="font-bold">{a.title}</p>
                <p className="text-neutral-600 dark:text-neutral-400 mt-0.5">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reports Queue */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-sm font-bold">
            {t.reportedVideos} · {t.reportedAccounts} · {t.reportedComments}
          </h2>
        </div>

        {reports.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-500">{t.noResults}</div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="uppercase">{rep.targetType}</span>
                    <span>·</span>
                    <span className="font-mono">{rep.targetId}</span>
                    <span>·</span>
                    <span>{rep.status}</span>
                  </div>
                  <p className="text-sm font-medium">{rep.reason}</p>
                  {rep.details && <p className="text-xs text-neutral-500">{rep.details}</p>}
                  <p className="text-[11px] text-neutral-400">
                    {formatRelativeTime(rep.createdAt, language)}
                  </p>
                </div>

                {rep.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDismiss(rep)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t.dismiss}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnforce(rep, 'restrict')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-medium"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>{t.restrict}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnforce(rep, 'remove')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.removeContent}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
