import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Plus, Search, Shield, UserMinus, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import { Avatar, Button, Input, Modal, Skeleton } from '@/components/ui';
import { conversationApi, userApi, ApiClientError } from '@/lib/api';
import { cn, formatListStamp } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';
import { useUIStore } from '@/store/ui';
import type { Conversation, User } from '@/types';

export function GroupInfoPanel({ conversation }: { conversation: Conversation }) {
  const { t, i18n } = useTranslation();
  const open = useUIStore((s) => s.groupInfoOpen);
  const setOpen = useUIStore((s) => s.setGroupInfoOpen);
  const currentUser = useAuthStore((s) => s.user);
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const removeConversation = useChatStore((s) => s.removeConversation);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<User[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [busy, setBusy] = useState(false);

  const debounced = useDebouncedValue(query, 250);
  const isAdmin = Boolean(currentUser && conversation.admins.includes(currentUser._id));
  const memberIds = new Set(conversation.members.map((m) => m._id));

  useEffect(() => {
    if (!adding) return undefined;
    let cancelled = false;
    setLoadingPeople(true);
    userApi
      .list(debounced)
      .then(({ users }) => !cancelled && setCandidates(users.filter((u) => !memberIds.has(u._id))))
      .catch(() => !cancelled && setCandidates([]))
      .finally(() => !cancelled && setLoadingPeople(false));
    return () => {
      cancelled = true;
    };
    // memberIds is derived from conversation.members, which is in the deps already.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding, debounced, conversation.members]);

  useEffect(() => {
    if (!open) {
      setAdding(false);
      setQuery('');
    }
  }, [open]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const addMember = (userId: string) =>
    run(async () => {
      const { conversation: updated } = await conversationApi.addMembers(conversation._id, [userId]);
      upsertConversation(updated);
      setCandidates((current) => current.filter((u) => u._id !== userId));
    });

  const removeMember = (userId: string) =>
    run(async () => {
      const result = await conversationApi.removeMember(conversation._id, userId);
      if (result.conversation) upsertConversation(result.conversation);
    });

  const leave = () =>
    run(async () => {
      if (!currentUser) return;
      if (!window.confirm(t('groupInfo.leaveConfirm'))) return;
      await conversationApi.removeMember(conversation._id, currentUser._id);
      removeConversation(conversation._id);
      setOpen(false);
    });

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t('groupInfo.title')}>
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lift">
            <Users className="h-9 w-9" />
          </span>
          <h3 className="mt-3 text-lg font-semibold text-ink">{conversation.name}</h3>
          <p className="text-sm text-ink-muted">
            {t('common.members', { count: conversation.members.length })} ·{' '}
            {t('groupInfo.created', {
              date: formatListStamp(conversation.createdAt, i18n.resolvedLanguage),
            })}
          </p>
        </div>

        {conversation.description && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {t('groupInfo.about')}
            </h4>
            <p className="rounded-xl bg-surface-muted p-3 text-sm text-ink-muted">
              {conversation.description}
            </p>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {t('groupInfo.members')}
            </h4>
            {isAdmin && (
              <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
                <Plus className="h-4 w-4" />
                {t('groupInfo.addMembers')}
              </Button>
            )}
          </div>

          {adding && (
            <div className="mb-3 space-y-2 rounded-xl border border-line bg-surface-muted p-2.5">
              <Input
                name="addMember"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('newChat.searchPeople')}
                leading={<Search className="h-4 w-4" />}
              />
              <div className="scrollbar-thin max-h-40 space-y-0.5 overflow-y-auto">
                {loadingPeople ? (
                  <Skeleton className="h-10 w-full" />
                ) : candidates.length === 0 ? (
                  <p className="py-3 text-center text-xs text-ink-faint">{t('newChat.noPeople')}</p>
                ) : (
                  candidates.map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      disabled={busy}
                      onClick={() => void addMember(user._id)}
                      className="focus-ring flex w-full items-center gap-2.5 rounded-lg p-1.5 text-start transition-colors hover:bg-surface disabled:opacity-50"
                    >
                      <Avatar name={user.name} src={user.avatar} color={user.avatarColor} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{user.name}</span>
                      <Plus className="h-4 w-4 text-brand-500" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <ul className="space-y-0.5">
            {conversation.members.map((member) => {
              const memberIsAdmin = conversation.admins.includes(member._id);
              const isMe = member._id === currentUser?._id;
              return (
                <li
                  key={member._id}
                  className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-muted"
                >
                  <Avatar
                    name={member.name}
                    src={member.avatar}
                    color={member.avatarColor}
                    online={onlineUserIds.has(member._id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {member.name}
                      {isMe && <span className="text-ink-faint"> ({t('common.you')})</span>}
                    </p>
                    <p className="truncate text-xs text-ink-muted">{member.email}</p>
                  </div>

                  {memberIsAdmin && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5',
                        'text-[11px] font-medium text-brand-500'
                      )}
                    >
                      <Shield className="h-3 w-3" />
                      {t('groupInfo.admin')}
                    </span>
                  )}

                  {isAdmin && !isMe && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeMember(member._id)}
                      aria-label={t('groupInfo.removeMember')}
                      className="focus-ring rounded-lg p-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <Button variant="ghost" onClick={() => void leave()} disabled={busy} className="w-full text-red-500 hover:bg-red-500/10">
          <LogOut className="h-4 w-4 rtl-flip" />
          {t('groupInfo.leaveGroup')}
        </Button>
      </div>
    </Modal>
  );
}
