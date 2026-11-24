import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  onSnapshot,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import type {
  VideoItem,
  UserProfile,
  UserPrivateSettings,
  CommentItem,
  SocialPost,
  NotificationItem,
  ConversationItem,
  MessageItem,
  ReportItem,
  AnnouncementItem,
} from '../types';
import { generateId } from '../utils/format';

// --- Storage Upload Helpers ---
export function uploadFileWithProgress(
  path: string,
  file: Blob | File,
  onProgress?: (pct: number) => void,
  onTask?: (task: UploadTask) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);
    if (onTask) onTask(task);
    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function deleteStorageFile(path?: string): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // Ignore if already deleted
  }
}

// --- Videos & Shorts ---
export async function fetchPublicVideos(options: {
  isShort?: boolean;
  category?: string;
  sortBy?: 'latest' | 'trending' | 'recommended';
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}): Promise<{ items: VideoItem[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const { isShort, category, sortBy = 'latest', pageSize = 12, cursor } = options;
  try {
    const baseConstraints = [
      where('visibility', '==', 'public'),
      where('status', '==', 'active'),
      limit(pageSize * 2),
    ];
    let q = query(collection(db, 'videos'), ...baseConstraints);
    if (cursor) {
      q = query(collection(db, 'videos'), ...baseConstraints, startAfter(cursor));
    }
    const snap = await getDocs(q);
    let items = snap.docs.map((d) => d.data() as VideoItem);

    if (typeof isShort === 'boolean') {
      items = items.filter((v) => v.isShort === isShort);
    }
    if (category && category !== 'All') {
      items = items.filter((v) => v.category === category);
    }

    if (sortBy === 'trending') {
      items.sort((a, b) => b.viewsCount + b.likesCount * 3 - (a.viewsCount + a.likesCount * 3));
    } else if (sortBy === 'recommended') {
      items.sort((a, b) => {
        const scoreA = a.likesCount * 4 + a.commentsCount * 2 + a.viewsCount;
        const scoreB = b.likesCount * 4 + b.commentsCount * 2 + b.viewsCount;
        return scoreB - scoreA || b.createdAt.localeCompare(a.createdAt);
      });
    } else {
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { items: items.slice(0, pageSize), lastDoc };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'videos');
  }
}

export async function fetchFollowingVideos(followingIds: string[]): Promise<VideoItem[]> {
  if (followingIds.length === 0) return [];
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < followingIds.length; i += 10) {
      chunks.push(followingIds.slice(i, i + 10));
    }
    const results: VideoItem[] = [];
    for (const chunk of chunks) {
      const q = query(
        collection(db, 'videos'),
        where('creatorId', 'in', chunk),
        where('visibility', '==', 'public'),
        where('status', '==', 'active'),
        limit(20)
      );
      const snap = await getDocs(q);
      snap.forEach((d) => results.push(d.data() as VideoItem));
    }
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'videos');
  }
}

export async function fetchCreatorVideos(creatorId: string, includePrivate = false): Promise<VideoItem[]> {
  try {
    const q = includePrivate
      ? query(collection(db, 'videos'), where('creatorId', '==', creatorId), limit(50))
      : query(
          collection(db, 'videos'),
          where('creatorId', '==', creatorId),
          where('visibility', '==', 'public'),
          where('status', '==', 'active'),
          limit(50)
        );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as VideoItem)
      .filter((v) => v.status !== 'removed')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'videos');
  }
}

export async function fetchVideoById(videoId: string): Promise<VideoItem | null> {
  try {
    const snap = await getDoc(doc(db, 'videos', videoId));
    return snap.exists() ? (snap.data() as VideoItem) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `videos/${videoId}`);
  }
}

export async function createVideoDoc(video: VideoItem): Promise<void> {
  try {
    await setDoc(doc(db, 'videos', video.id), video);
    await updateDoc(doc(db, 'users', video.creatorId), {
      videosCount: increment(1),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `videos/${video.id}`);
  }
}

export async function updateVideoDetails(
  videoId: string,
  updates: Partial<Pick<VideoItem, 'title' | 'description' | 'category' | 'tags' | 'visibility' | 'thumbnailUrl' | 'thumbnailPath' | 'isShort'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'videos', videoId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `videos/${videoId}`);
  }
}

export async function deleteVideoComplete(video: VideoItem): Promise<void> {
  try {
    await deleteDoc(doc(db, 'videos', video.id));
    await deleteStorageFile(video.storagePath);
    await deleteStorageFile(video.thumbnailPath);
    await updateDoc(doc(db, 'users', video.creatorId), {
      videosCount: increment(-1),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `videos/${video.id}`);
  }
}

export async function recordVideoView(videoId: string, userId?: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'videos', videoId), {
      viewsCount: increment(1),
      updatedAt: new Date().toISOString(),
    });
    if (userId) {
      await setDoc(doc(db, 'users', userId, 'watchHistory', videoId), {
        videoId,
        watchedAt: new Date().toISOString(),
        progressSeconds: 0,
      });
    }
  } catch {
    // Non-blocking view telemetry
  }
}

export async function toggleVideoReaction(
  videoId: string,
  userId: string,
  type: 'like' | 'dislike',
  actor?: UserProfile | null,
  videoCreatorId?: string
): Promise<'like' | 'dislike' | null> {
  const likeRef = doc(db, 'videos', videoId, 'likes', userId);
  const videoRef = doc(db, 'videos', videoId);
  try {
    const snap = await getDoc(likeRef);
    const now = new Date().toISOString();
    if (snap.exists()) {
      const prev = snap.data().type as 'like' | 'dislike';
      if (prev === type) {
        await deleteDoc(likeRef);
        await updateDoc(videoRef, {
          [type === 'like' ? 'likesCount' : 'dislikesCount']: increment(-1),
          updatedAt: now,
        });
        return null;
      } else {
        await setDoc(likeRef, { userId, type, createdAt: now });
        await updateDoc(videoRef, {
          likesCount: increment(type === 'like' ? 1 : -1),
          dislikesCount: increment(type === 'dislike' ? 1 : -1),
          updatedAt: now,
        });
        return type;
      }
    } else {
      await setDoc(likeRef, { userId, type, createdAt: now });
      await updateDoc(videoRef, {
        [type === 'like' ? 'likesCount' : 'dislikesCount']: increment(1),
        updatedAt: now,
      });
      if (type === 'like' && actor && videoCreatorId && videoCreatorId !== userId) {
        await createNotification({
          recipientId: videoCreatorId,
          actorId: userId,
          actorName: actor.displayName,
          actorPhotoURL: actor.photoURL,
          type: 'like',
          targetId: videoId,
          targetType: 'video',
          message: 'liked your video',
        });
      }
      return type;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `videos/${videoId}/likes/${userId}`);
  }
}

export async function getUserVideoReaction(
  videoId: string,
  userId: string
): Promise<'like' | 'dislike' | null> {
  try {
    const snap = await getDoc(doc(db, 'videos', videoId, 'likes', userId));
    return snap.exists() ? (snap.data().type as 'like' | 'dislike') : null;
  } catch {
    return null;
  }
}

// --- Saved Videos ---
export async function toggleSaveVideo(videoId: string, userId: string): Promise<boolean> {
  const refDoc = doc(db, 'users', userId, 'saved', videoId);
  try {
    const snap = await getDoc(refDoc);
    if (snap.exists()) {
      await deleteDoc(refDoc);
      return false;
    } else {
      await setDoc(refDoc, { videoId, createdAt: new Date().toISOString() });
      return true;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/saved/${videoId}`);
  }
}

export async function isVideoSaved(videoId: string, userId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'saved', videoId));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function fetchSavedVideos(userId: string): Promise<VideoItem[]> {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'saved'));
    const ids = snap.docs.map((d) => d.id);
    const items: VideoItem[] = [];
    for (const id of ids.slice(0, 30)) {
      const v = await fetchVideoById(id);
      if (v && v.status === 'active') items.push(v);
    }
    return items;
  } catch {
    return [];
  }
}

// --- Video & Post Comments ---
export async function fetchComments(
  parentCollection: 'videos' | 'posts',
  parentId: string
): Promise<CommentItem[]> {
  try {
    const q = query(
      collection(db, parentCollection, parentId, 'comments'),
      where('status', '==', 'active'),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as CommentItem)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `${parentCollection}/${parentId}/comments`);
  }
}

export async function addComment(params: {
  parentCollection: 'videos' | 'posts';
  parentId: string;
  author: UserProfile;
  text: string;
  replyToId?: string;
  ownerId: string;
}): Promise<CommentItem> {
  const { parentCollection, parentId, author, text, replyToId, ownerId } = params;
  const id = generateId('cmt');
  const now = new Date().toISOString();
  const item: CommentItem = {
    id,
    ...(parentCollection === 'videos' ? { videoId: parentId } : { postId: parentId }),
    authorId: author.uid,
    authorName: author.displayName,
    authorUsername: author.username,
    authorPhotoURL: author.photoURL || '',
    text: text.trim().slice(0, 2000),
    ...(replyToId ? { parentId: replyToId } : {}),
    status: 'active',
    createdAt: now,
  };
  try {
    await setDoc(doc(db, parentCollection, parentId, 'comments', id), item);
    await updateDoc(doc(db, parentCollection, parentId), {
      commentsCount: increment(1),
      updatedAt: now,
    });
    if (ownerId !== author.uid) {
      await createNotification({
        recipientId: ownerId,
        actorId: author.uid,
        actorName: author.displayName,
        actorPhotoURL: author.photoURL,
        type: replyToId ? 'reply' : 'comment',
        targetId: parentId,
        targetType: parentCollection === 'videos' ? 'video' : 'post',
        message: replyToId ? 'replied to a comment' : 'commented on your content',
      });
    }
    return item;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${parentCollection}/${parentId}/comments/${id}`);
  }
}

export async function deleteComment(
  parentCollection: 'videos' | 'posts',
  parentId: string,
  commentId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, parentCollection, parentId, 'comments', commentId));
    await updateDoc(doc(db, parentCollection, parentId), {
      commentsCount: increment(-1),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${parentCollection}/${parentId}/comments/${commentId}`);
  }
}

// --- Follow / Unfollow / Creators ---
export async function isFollowingUser(currentUserId: string, targetUserId: string): Promise<boolean> {
  if (!currentUserId || !targetUserId) return false;
  try {
    const snap = await getDoc(doc(db, 'users', currentUserId, 'following', targetUserId));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function toggleFollowUser(
  currentUser: UserProfile,
  targetUserId: string
): Promise<boolean> {
  const followingRef = doc(db, 'users', currentUser.uid, 'following', targetUserId);
  const followerRef = doc(db, 'users', targetUserId, 'followers', currentUser.uid);
  const now = new Date().toISOString();
  try {
    const snap = await getDoc(followingRef);
    if (snap.exists()) {
      await deleteDoc(followingRef);
      await deleteDoc(followerRef);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        followingCount: increment(-1),
        updatedAt: now,
      });
      await updateDoc(doc(db, 'users', targetUserId), {
        followersCount: increment(-1),
        updatedAt: now,
      });
      return false;
    } else {
      await setDoc(followingRef, { targetId: targetUserId, createdAt: now });
      await setDoc(followerRef, { followerId: currentUser.uid, createdAt: now });
      await updateDoc(doc(db, 'users', currentUser.uid), {
        followingCount: increment(1),
        updatedAt: now,
      });
      await updateDoc(doc(db, 'users', targetUserId), {
        followersCount: increment(1),
        updatedAt: now,
      });
      await createNotification({
        recipientId: targetUserId,
        actorId: currentUser.uid,
        actorName: currentUser.displayName,
        actorPhotoURL: currentUser.photoURL,
        type: 'follow',
        targetId: currentUser.uid,
        targetType: 'user',
        message: 'started following you',
      });
      return true;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/following/${targetUserId}`);
  }
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'following'));
    return snap.docs.map((d) => d.id);
  } catch {
    return [];
  }
}

export async function fetchPopularCreators(max = 12): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), where('isPrivate', '==', false), limit(30));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as UserProfile)
      .filter((u) => !u.isRestricted)
      .sort((a, b) => b.followersCount - a.followersCount)
      .slice(0, max);
  } catch {
    return [];
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch {
    return null;
  }
}

export async function updateUserProfileData(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function updatePrivateSettings(
  uid: string,
  updates: Partial<UserPrivateSettings>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid, 'private', 'account'), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/private/account`);
  }
}

// --- Social Feed Posts ---
export async function fetchPublicPosts(pageSize = 20): Promise<SocialPost[]> {
  try {
    const q = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      where('status', '==', 'active'),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as SocialPost)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'posts');
  }
}

export async function fetchUserPosts(authorId: string, includePrivate = false): Promise<SocialPost[]> {
  try {
    const q = includePrivate
      ? query(collection(db, 'posts'), where('authorId', '==', authorId), limit(30))
      : query(
          collection(db, 'posts'),
          where('authorId', '==', authorId),
          where('visibility', '==', 'public'),
          where('status', '==', 'active'),
          limit(30)
        );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as SocialPost)
      .filter((p) => p.status !== 'removed')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function createPost(post: SocialPost): Promise<void> {
  try {
    await setDoc(doc(db, 'posts', post.id), post);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `posts/${post.id}`);
  }
}

export async function deletePost(post: SocialPost): Promise<void> {
  try {
    await deleteDoc(doc(db, 'posts', post.id));
    await deleteStorageFile(post.imagePath);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `posts/${post.id}`);
  }
}

export async function togglePostReaction(
  postId: string,
  userId: string,
  reaction: 'like' | 'love' | 'insightful' | 'celebrate',
  actor?: UserProfile | null,
  postAuthorId?: string
): Promise<string | null> {
  const refDoc = doc(db, 'posts', postId, 'reactions', userId);
  const postRef = doc(db, 'posts', postId);
  const now = new Date().toISOString();
  try {
    const snap = await getDoc(refDoc);
    if (snap.exists()) {
      const prev = snap.data().reaction as string;
      if (prev === reaction) {
        await deleteDoc(refDoc);
        await updateDoc(postRef, { likesCount: increment(-1), updatedAt: now });
        return null;
      } else {
        await setDoc(refDoc, { userId, reaction, createdAt: now });
        return reaction;
      }
    } else {
      await setDoc(refDoc, { userId, reaction, createdAt: now });
      await updateDoc(postRef, { likesCount: increment(1), updatedAt: now });
      if (actor && postAuthorId && postAuthorId !== userId) {
        await createNotification({
          recipientId: postAuthorId,
          actorId: userId,
          actorName: actor.displayName,
          actorPhotoURL: actor.photoURL,
          type: 'like',
          targetId: postId,
          targetType: 'post',
          message: 'reacted to your post',
        });
      }
      return reaction;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `posts/${postId}/reactions/${userId}`);
  }
}

// --- Block & Report ---
export async function toggleBlockUser(currentUserId: string, targetUserId: string): Promise<boolean> {
  const blockRef = doc(db, 'users', currentUserId, 'blocked', targetUserId);
  try {
    const snap = await getDoc(blockRef);
    if (snap.exists()) {
      await deleteDoc(blockRef);
      return false;
    } else {
      await setDoc(blockRef, { blockedId: targetUserId, createdAt: new Date().toISOString() });
      return true;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${currentUserId}/blocked/${targetUserId}`);
  }
}

export async function fetchBlockedUsers(currentUserId: string): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users', currentUserId, 'blocked'));
    const list: UserProfile[] = [];
    for (const d of snap.docs) {
      const u = await fetchUserProfile(d.id);
      if (u) list.push(u);
    }
    return list;
  } catch {
    return [];
  }
}

export async function fetchBlockedIds(currentUserId: string): Promise<string[]> {
  try {
    const snap = await getDocs(collection(db, 'users', currentUserId, 'blocked'));
    return snap.docs.map((d) => d.id);
  } catch {
    return [];
  }
}

export async function submitReport(params: {
  reporterId: string;
  targetType: 'video' | 'account' | 'comment' | 'post';
  targetId: string;
  parentId?: string;
  reason: string;
  details?: string;
}): Promise<void> {
  const id = generateId('rep');
  const report: ReportItem = {
    id,
    reporterId: params.reporterId,
    targetType: params.targetType,
    targetId: params.targetId,
    ...(params.parentId ? { parentId: params.parentId } : {}),
    reason: params.reason.slice(0, 120),
    ...(params.details ? { details: params.details.slice(0, 1000) } : {}),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'reports', id), report);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reports/${id}`);
  }
}

// --- Notifications ---
export async function createNotification(
  params: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>
): Promise<void> {
  const id = generateId('ntf');
  const item: NotificationItem = {
    ...params,
    id,
    read: false,
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'notifications', id), item);
  } catch {
    // non-fatal notification failure
  }
}

export function subscribeNotifications(
  userId: string,
  callback: (items: NotificationItem[]) => void
): () => void {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as NotificationItem)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      callback(items);
    },
    (err) => {
      console.error('Notification subscription error:', err);
    }
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch {
    // ignore
  }
}

export async function markAllNotificationsRead(items: NotificationItem[]): Promise<void> {
  const unread = items.filter((n) => !n.read);
  await Promise.all(unread.map((n) => markNotificationRead(n.id)));
}

// --- Messaging & Youth Safety ---
export function getConversationId(uidA: string, uidB: string): string {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

export async function canUsersMessage(
  sender: UserProfile,
  recipient: UserProfile
): Promise<{ allowed: boolean; reason?: string }> {
  if (sender.isRestricted) {
    return { allowed: false, reason: 'Account restricted' };
  }
  const blockedByRecipient = await getDoc(
    doc(db, 'users', recipient.uid, 'blocked', sender.uid)
  );
  if (blockedByRecipient.exists()) {
    return { allowed: false, reason: 'Blocked' };
  }
  if (recipient.whoCanMessage === 'nobody') {
    return { allowed: false, reason: 'User disabled direct messages' };
  }
  // Youth safety: minors can only message mutual followers
  if (sender.isMinor || recipient.isMinor || recipient.whoCanMessage === 'following') {
    const [aFollowsB, bFollowsA] = await Promise.all([
      isFollowingUser(sender.uid, recipient.uid),
      isFollowingUser(recipient.uid, sender.uid),
    ]);
    if (sender.isMinor || recipient.isMinor) {
      if (!aFollowsB || !bFollowsA) {
        return { allowed: false, reason: 'minor_mutual_required' };
      }
    } else if (recipient.whoCanMessage === 'following' && !bFollowsA) {
      return { allowed: false, reason: 'Only people followed by this user can message' };
    }
  }
  return { allowed: true };
}

export async function getOrCreateConversation(
  sender: UserProfile,
  recipient: UserProfile
): Promise<ConversationItem> {
  const convId = getConversationId(sender.uid, recipient.uid);
  const convRef = doc(db, 'conversations', convId);
  try {
    const snap = await getDoc(convRef);
    if (snap.exists()) {
      return snap.data() as ConversationItem;
    }
    const now = new Date().toISOString();
    const conv: ConversationItem = {
      id: convId,
      participants: [sender.uid, recipient.uid].sort(),
      participantNames: {
        [sender.uid]: sender.displayName,
        [recipient.uid]: recipient.displayName,
      },
      participantPhotos: {
        [sender.uid]: sender.photoURL || '',
        [recipient.uid]: recipient.photoURL || '',
      },
      lastMessage: '',
      lastSenderId: '',
      lastMessageAt: now,
      createdAt: now,
    };
    await setDoc(convRef, conv);
    return conv;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `conversations/${convId}`);
  }
}

export function subscribeConversations(
  userId: string,
  callback: (items: ConversationItem[]) => void
): () => void {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as ConversationItem)
        .sort((a, b) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt));
      callback(list);
    },
    (err) => console.error('Conversations listener error:', err)
  );
}

export function subscribeMessages(
  conversationId: string,
  callback: (items: MessageItem[]) => void
): () => void {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(150)
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => d.data() as MessageItem));
    },
    (err) => console.error('Messages listener error:', err)
  );
}

export async function sendChatMessage(
  conversationId: string,
  senderId: string,
  text: string
): Promise<void> {
  const id = generateId('msg');
  const now = new Date().toISOString();
  const msg: MessageItem = {
    id,
    senderId,
    text: text.trim().slice(0, 2000),
    readBy: [senderId],
    createdAt: now,
  };
  try {
    await setDoc(doc(db, 'conversations', conversationId, 'messages', id), msg);
    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessage: msg.text.slice(0, 200),
      lastSenderId: senderId,
      lastMessageAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `conversations/${conversationId}/messages/${id}`);
  }
}

export async function markMessageRead(
  conversationId: string,
  message: MessageItem,
  userId: string
): Promise<void> {
  if (message.readBy.includes(userId)) return;
  try {
    await updateDoc(doc(db, 'conversations', conversationId, 'messages', message.id), {
      readBy: [...message.readBy, userId],
    });
  } catch {
    // ignore
  }
}

// --- Search & History ---
export async function searchPlatform(term: string): Promise<{
  videos: VideoItem[];
  shorts: VideoItem[];
  creators: UserProfile[];
}> {
  const clean = term.trim().toLowerCase();
  if (!clean) return { videos: [], shorts: [], creators: [] };

  try {
    const [vidSnap, userSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'videos'),
          where('visibility', '==', 'public'),
          where('status', '==', 'active'),
          limit(100)
        )
      ),
      getDocs(query(collection(db, 'users'), where('isPrivate', '==', false), limit(60))),
    ]);

    const allVids = vidSnap.docs.map((d) => d.data() as VideoItem);
    const matchedVids = allVids.filter(
      (v) =>
        v.title.toLowerCase().includes(clean) ||
        (v.description || '').toLowerCase().includes(clean) ||
        v.category.toLowerCase().includes(clean) ||
        v.creatorName.toLowerCase().includes(clean) ||
        v.creatorUsername.toLowerCase().includes(clean) ||
        (v.tags || []).some((t) => t.toLowerCase().includes(clean))
    );

    const creators = userSnap.docs
      .map((d) => d.data() as UserProfile)
      .filter(
        (u) =>
          !u.isRestricted &&
          (u.displayName.toLowerCase().includes(clean) ||
            u.username.toLowerCase().includes(clean) ||
            (u.bio || '').toLowerCase().includes(clean))
      );

    return {
      videos: matchedVids.filter((v) => !v.isShort),
      shorts: matchedVids.filter((v) => v.isShort),
      creators,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'search');
  }
}

export async function saveSearchHistoryItem(userId: string, queryText: string): Promise<void> {
  const id = generateId('sh');
  try {
    await setDoc(doc(db, 'users', userId, 'searchHistory', id), {
      query: queryText.trim().slice(0, 120),
      createdAt: new Date().toISOString(),
    });
  } catch {
    // ignore
  }
}

export async function fetchSearchHistory(userId: string): Promise<{ id: string; query: string; createdAt: string }[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'users', userId, 'searchHistory'), orderBy('createdAt', 'desc'), limit(15))
    );
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { query: string; createdAt: string }),
    }));
  } catch {
    return [];
  }
}

export async function clearSearchHistory(userId: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'searchHistory'));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch {
    // ignore
  }
}

export async function fetchWatchHistory(userId: string): Promise<VideoItem[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'users', userId, 'watchHistory'), orderBy('watchedAt', 'desc'), limit(20))
    );
    const items: VideoItem[] = [];
    for (const d of snap.docs) {
      const v = await fetchVideoById(d.id);
      if (v && v.status === 'active') items.push(v);
    }
    return items;
  } catch {
    return [];
  }
}

export async function clearWatchHistory(userId: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'watchHistory'));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch {
    // ignore
  }
}

// --- Admin / Moderation & Announcements ---
export async function fetchAllReports(): Promise<ReportItem[]> {
  try {
    const snap = await getDocs(query(collection(db, 'reports'), limit(100)));
    return snap.docs
      .map((d) => d.data() as ReportItem)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'reports');
  }
}

export async function resolveReport(
  reportId: string,
  status: 'reviewed' | 'resolved' | 'dismissed',
  adminUid: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      reviewedBy: adminUid,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
  }
}

export async function adminModerateVideo(
  videoId: string,
  status: 'active' | 'restricted' | 'removed'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'videos', videoId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `videos/${videoId}`);
  }
}

export async function adminModerateUser(userId: string, isRestricted: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      isRestricted,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
  }
}

export async function adminRemoveComment(
  parentCollection: 'videos' | 'posts',
  parentId: string,
  commentId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, parentCollection, parentId, 'comments', commentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${parentCollection}/${parentId}/comments/${commentId}`);
  }
}

export async function fetchAnnouncements(): Promise<AnnouncementItem[]> {
  try {
    const snap = await getDocs(query(collection(db, 'announcements'), limit(20)));
    return snap.docs
      .map((d) => d.data() as AnnouncementItem)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function publishAnnouncement(
  authorId: string,
  title: string,
  body: string
): Promise<AnnouncementItem> {
  const id = generateId('ann');
  const item: AnnouncementItem = {
    id,
    title: title.trim().slice(0, 160),
    body: body.trim().slice(0, 3000),
    authorId,
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'announcements', id), item);
    return item;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `announcements/${id}`);
  }
}

export async function submitSupportTicket(
  userId: string,
  subject: string,
  message: string
): Promise<void> {
  const id = generateId('tkt');
  try {
    await setDoc(doc(db, 'supportTickets', id), {
      id,
      userId,
      subject: subject.trim().slice(0, 150),
      message: message.trim().slice(0, 2000),
      status: 'open',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `supportTickets/${id}`);
  }
}
