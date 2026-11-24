import React, { useState, useRef } from 'react';
import { Upload, Film, Image as ImageIcon, X, RotateCcw, CheckCircle2 } from 'lucide-react';
import type { UploadTask } from 'firebase/storage';
import { VIDEO_CATEGORIES, type VideoCategory, type VideoItem } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  uploadFileWithProgress,
  createVideoDoc,
  createNotification,
} from '../services/firestoreService';
import { generateId } from '../utils/format';

interface UploadPageProps {
  onSuccess: (videoId: string) => void;
  onSignInClick: () => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ onSuccess, onSignInClick }) => {
  const { t, showToast } = useApp();
  const { firebaseUser, profile } = useAuth();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [thumbBlob, setThumbBlob] = useState<Blob | File | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string>('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<VideoCategory>('Entertainment');
  const [tagsText, setTagsText] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isShort, setIsShort] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const activeTaskRef = useRef<UploadTask | null>(null);

  if (!firebaseUser || !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8">
          <Upload className="w-8 h-8 mx-auto mb-3 text-neutral-500" />
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

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoPreviewUrl(url);
    if (!title) {
      setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 120));
    }
    setFailed(false);
    setErrorMsg('');
  };

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    const dur = Math.round(el.duration || 0);
    setDuration(dur);
    if (el.videoHeight > el.videoWidth || (dur > 0 && dur <= 60)) {
      setIsShort(true);
    }
  };

  const handleCaptureFrame = () => {
    const el = videoRef.current;
    if (!el || el.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
        setThumbBlob(blob);
        setThumbPreviewUrl(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.85
    );
  };

  const handleThumbSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
    setThumbBlob(file);
    setThumbPreviewUrl(URL.createObjectURL(file));
  };

  const handleCancelUpload = () => {
    if (activeTaskRef.current) {
      activeTaskRef.current.cancel();
      activeTaskRef.current = null;
    }
    setUploading(false);
    setProgress(0);
  };

  const startUpload = async () => {
    if (!videoFile || !title.trim()) return;
    setUploading(true);
    setFailed(false);
    setErrorMsg('');
    setProgress(0);

    const videoId = generateId('vid');
    const ext = videoFile.name.split('.').pop() || 'mp4';
    const storagePath = `videos/${firebaseUser.uid}/${videoId}.${ext}`;
    const thumbnailPath = thumbBlob ? `thumbnails/${firebaseUser.uid}/${videoId}.jpg` : '';

    try {
      const videoUrl = await uploadFileWithProgress(
        storagePath,
        videoFile,
        (pct) => setProgress(thumbBlob ? pct * 0.9 : pct),
        (task) => {
          activeTaskRef.current = task;
        }
      );

      let thumbnailUrl = '';
      if (thumbBlob && thumbnailPath) {
        thumbnailUrl = await uploadFileWithProgress(
          thumbnailPath,
          thumbBlob,
          (pct) => setProgress(90 + pct * 0.1)
        );
      }

      const tags = tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);

      const now = new Date().toISOString();
      const docData: VideoItem = {
        id: videoId,
        creatorId: firebaseUser.uid,
        creatorName: profile.displayName,
        creatorUsername: profile.username,
        creatorPhotoURL: profile.photoURL || '',
        title: title.trim().slice(0, 150),
        description: description.trim().slice(0, 5000),
        videoUrl,
        storagePath,
        ...(thumbnailUrl ? { thumbnailUrl, thumbnailPath } : {}),
        duration,
        isShort,
        category,
        tags,
        visibility,
        status: 'active',
        viewsCount: 0,
        likesCount: 0,
        dislikesCount: 0,
        commentsCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      await createVideoDoc(docData);
      if (visibility === 'public') {
        await createNotification({
          recipientId: firebaseUser.uid,
          actorId: firebaseUser.uid,
          actorName: profile.displayName,
          actorPhotoURL: profile.photoURL,
          type: 'upload',
          targetId: videoId,
          targetType: 'video',
          message: `Published "${docData.title}"`,
        });
      }
      setProgress(100);
      showToast(t.uploadSuccess, 'success');
      onSuccess(videoId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.uploadFailed;
      if (!msg.includes('storage/canceled')) {
        setFailed(true);
        setErrorMsg(msg);
        showToast(t.uploadFailed, 'error');
      }
    } finally {
      setUploading(false);
      activeTaskRef.current = null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display">{t.uploadVideoTitle}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Video Preview & Thumbnail */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-4">
            {videoPreviewUrl ? (
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  src={videoPreviewUrl}
                  controls
                  onLoadedMetadata={handleLoadedMetadata}
                  className="w-full rounded-xl bg-black max-h-72 object-contain"
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    className="flex-1 py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {t.captureFrame}
                  </button>
                  <label className="py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    {t.selectVideoFile}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl cursor-pointer hover:border-neutral-500 transition-colors">
                <Film className="w-10 h-10 text-neutral-400 mb-3" />
                <span className="text-sm font-semibold">{t.selectVideoFile}</span>
                <span className="text-xs text-neutral-500 mt-1">MP4, WebM, MOV (max 500MB)</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-4">
            <p className="text-xs font-semibold mb-2">{t.thumbnailLabel}</p>
            {thumbPreviewUrl ? (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black mb-2">
                <img
                  src={thumbPreviewUrl}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setThumbBlob(null);
                    setThumbPreviewUrl('');
                  }}
                  className="absolute top-2 end-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : null}
            <label className="w-full py-2.5 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <ImageIcon className="w-4 h-4" />
              <span>{t.addImage}</span>
              <input type="file" accept="image/*" onChange={handleThumbSelect} className="hidden" />
            </label>
          </div>
        </div>

        {/* Right: Metadata Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startUpload();
          }}
          className="lg:col-span-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold mb-1.5">{t.videoTitleLabel}</label>
            <input
              type="text"
              required
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">{t.descriptionLabel}</label>
            <textarea
              rows={4}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">{t.categoryLabel}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VideoCategory)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm"
              >
                {VIDEO_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">{t.visibilityLabel}</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm"
              >
                <option value="public">{t.publicOption}</option>
                <option value="private">{t.privateOption}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">{t.tagsLabel}</label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder={t.tagsHint}
              className="w-full h-10 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none focus:border-neutral-400"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isShort}
              onChange={(e) => setIsShort(e.target.checked)}
              className="w-4 h-4 rounded accent-neutral-950 dark:accent-white"
            />
            <span>{t.publishAsShort}</span>
          </label>

          {/* Real Upload Progress */}
          {uploading && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>{t.uploadingProgress}</span>
                <span className="font-mono tabular-nums">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rainbow-bar transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <button
                type="button"
                onClick={handleCancelUpload}
                className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                {t.cancelUpload}
              </button>
            </div>
          )}

          {failed && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 flex items-center justify-between gap-3">
              <span className="text-xs text-red-700 dark:text-red-300 truncate">
                {errorMsg || t.uploadFailed}
              </span>
              <button
                type="button"
                onClick={startUpload}
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-300 shrink-0 hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.retryUpload}</span>
              </button>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={!videoFile || !title.trim() || uploading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t.publishVideo}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
