import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  User,
  ShieldAlert,
  ShieldBan,
  Flag,
  Check,
  CheckCheck,
  MessageSquare,
} from 'lucide-react';
import type { ConversationItem, MessageItem, UserProfile } from '../types';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeConversations,
  subscribeMessages,
  sendChatMessage,
  markMessageRead,
  getOrCreateConversation,
  canUsersMessage,
  fetchUserProfile,
  toggleBlockUser,
} from '../services/firestoreService';
import { ReportModal } from '../components/ReportModal';
import { formatRelativeTime, isSafeMediaUrl } from '../utils/format';

interface MessagesPageProps {
  initialPeer?: UserProfile | null;
  onSignInClick: () => void;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({
  initialPeer,
  onSignInClick,
}) => {
  const { t, language, showToast } = useApp();
  const { firebaseUser, profile } = useAuth();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState('');
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [reportUserId, setReportUserId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeConversations(firebaseUser.uid, (list) => {
      setConversations(list);
    });
    return () => unsub();
  }, [firebaseUser]);

  useEffect(() => {
    if (!initialPeer || !profile) return;
    canUsersMessage(profile, initialPeer).then(async (res) => {
      if (!res.allowed) {
        setSafetyError(
          res.reason === 'minor_mutual_required' ? t.minorMessagingBlocked : res.reason || t.minorMessagingBlocked
        );
        return;
      }
      setSafetyError(null);
      const conv = await getOrCreateConversation(profile, initialPeer);
      setSelectedConv(conv);
    });
  }, [initialPeer, profile, t.minorMessagingBlocked]);

  useEffect(() => {
    if (!selectedConv || !firebaseUser) {
      setMessages([]);
      return;
    }
    const unsub = subscribeMessages(selectedConv.id, (msgs) => {
      setMessages(msgs);
      msgs.forEach((m) => {
        if (m.senderId !== firebaseUser.uid && !m.readBy.includes(firebaseUser.uid)) {
          markMessageRead(selectedConv.id, m, firebaseUser.uid);
        }
      });
    });
    return () => unsub();
  }, [selectedConv, firebaseUser]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!firebaseUser || !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8">
          <MessageSquare className="w-8 h-8 mx-auto mb-3 text-neutral-500" />
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

  const getPeerId = (conv: ConversationItem): string => {
    return conv.participants.find((id) => id !== firebaseUser.uid) || '';
  };

  const handleSelectConv = async (conv: ConversationItem) => {
    setSelectedConv(conv);
    setSafetyError(null);
    const peerId = getPeerId(conv);
    const peer = await fetchUserProfile(peerId);
    if (peer) {
      const check = await canUsersMessage(profile, peer);
      if (!check.allowed) {
        setSafetyError(
          check.reason === 'minor_mutual_required' ? t.minorMessagingBlocked : check.reason || ''
        );
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv || !text.trim() || safetyError) return;
    await sendChatMessage(selectedConv.id, firebaseUser.uid, text);
    setText('');
  };

  const activePeerId = selectedConv ? getPeerId(selectedConv) : '';
  const activePeerName = selectedConv?.participantNames?.[activePeerId] || 'Rainbow User';

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-5">
      {profile.isMinor && (
        <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{t.minorMessagingBlocked}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900 h-[calc(100vh-11rem)]">
        {/* Conversation List */}
        <div className="md:col-span-4 border-e border-neutral-200 dark:border-neutral-800 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 font-bold text-sm">
            {t.messages}
          </div>
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">{t.noConversations}</div>
          ) : (
            conversations.map((conv) => {
              const peerId = getPeerId(conv);
              const peerName = conv.participantNames?.[peerId] || 'Rainbow User';
              const peerPhoto = conv.participantPhotos?.[peerId];
              const active = selectedConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => handleSelectConv(conv)}
                  className={`w-full flex items-center gap-3 p-3.5 text-start border-b border-neutral-100 dark:border-neutral-800/60 transition-colors ${
                    active ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                    {isSafeMediaUrl(peerPhoto) ? (
                      <img src={peerPhoto} alt={peerName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-neutral-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{peerName}</span>
                      {conv.lastMessageAt && (
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          {formatRelativeTime(conv.lastMessageAt, language)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">
                      {conv.lastMessage || '...'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Chat Thread */}
        <div className="md:col-span-8 flex flex-col bg-neutral-50/50 dark:bg-neutral-950/50">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-500">
              <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">{t.noConversations}</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
                <span className="text-sm font-bold">{activePeerName}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReportUserId(activePeerId)}
                    aria-label={t.report}
                    className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await toggleBlockUser(firebaseUser.uid, activePeerId);
                      setSafetyError(t.blockUser);
                      showToast(t.blockUser, 'info');
                    }}
                    aria-label={t.blockUser}
                    className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-red-600"
                  >
                    <ShieldBan className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => {
                  const mine = m.senderId === firebaseUser.uid;
                  const seenByOther = m.readBy.some((id) => id !== firebaseUser.uid);
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                          mine
                            ? 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950'
                            : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        <p className="break-words">{m.text}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">
                          <span>{formatRelativeTime(m.createdAt, language)}</span>
                          {mine &&
                            (seenByOther ? (
                              <CheckCheck className="w-3 h-3" />
                            ) : (
                              <Check className="w-3 h-3" />
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {safetyError ? (
                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 text-center">
                  {safetyError}
                </div>
              ) : (
                <form
                  onSubmit={handleSend}
                  className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-2"
                >
                  <input
                    type="text"
                    maxLength={2000}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t.newMessagePlaceholder}
                    className="flex-1 h-10 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Send className="w-4 h-4" />
                    <span>{t.sendMessage}</span>
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      <ReportModal
        open={Boolean(reportUserId)}
        onClose={() => setReportUserId(null)}
        targetType="account"
        targetId={reportUserId || ''}
      />
    </div>
  );
};
