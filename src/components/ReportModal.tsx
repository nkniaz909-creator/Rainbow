import React, { useState } from 'react';
import { X, Flag } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { submitReport } from '../services/firestoreService';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: 'video' | 'account' | 'comment' | 'post';
  targetId: string;
  parentId?: string;
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or hate speech',
  'Violence or dangerous content',
  'Copyright infringement',
  'Inappropriate or explicit content',
  'Child safety concern',
  'Other',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  open,
  onClose,
  targetType,
  targetId,
  parentId,
}) => {
  const { t, showToast } = useApp();
  const { firebaseUser } = useAuth();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      showToast(t.signInToContinue, 'error');
      return;
    }
    setSubmitting(true);
    try {
      await submitReport({
        reporterId: firebaseUser.uid,
        targetType,
        targetId,
        parentId,
        reason,
        details,
      });
      showToast(t.reportSubmitted, 'success');
      setDetails('');
      onClose();
    } catch {
      showToast(t.errorGeneric, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
            <h2 className="text-base font-bold">{t.report}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.cancelText}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
              {t.reportReason}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
              {t.descriptionLabel}
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {t.cancelText}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 hover:opacity-90 disabled:opacity-50"
            >
              {t.submitReport}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
