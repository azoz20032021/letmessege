import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Search, User as UserIcon, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import { Avatar, Button, EmptyState, Input, Modal, Skeleton, Textarea } from '@/components/ui';
import { conversationApi, userApi, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks';
import { useChatStore } from '@/store/chat';
import { useUIStore } from '@/store/ui';
import type { User } from '@/types';

type Mode = 'direct' | 'group';

export function NewChatModal() {
  const { t } = useTranslation();
  const open = useUIStore((s) => s.newChatOpen);
  const setOpen = useUIStore((s) => s.setNewChatOpen);
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const openConversation = useChatStore((s) => s.openConversation);
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);

  const [mode, setMode] = useState<Mode>('direct');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    userApi
      .list(debouncedQuery)
      .then(({ users: found }) => !cancelled && setUsers(found))
      .catch(() => !cancelled && setUsers([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery]);

  // Start from a clean slate every time the dialog opens.
  useEffect(() => {
    if (open) return;
    setMode('direct');
    setQuery('');
    setSelected([]);
    setGroupName('');
    setGroupDescription('');
  }, [open]);

  const toggle = (userId: string) =>
    setSelected((current) =>
      mode === 'direct'
        ? [userId]
        : current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId]
    );

  const canSubmit = useMemo(
    () => selected.length > 0 && (mode === 'direct' || groupName.trim().length >= 2) && !submitting,
    [selected.length, mode, groupName, submitting]
  );

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { conversation } = await conversationApi.create({
        type: mode,
        memberIds: selected,
        ...(mode === 'group'
          ? { name: groupName.trim(), description: groupDescription.trim() || undefined }
          : {}),
      });
      upsertConversation(conversation);
      await openConversation(conversation._id);
      setOpen(false);
      toast.success(t('newChat.created'));
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const modes: { key: Mode; label: string; icon: typeof UserIcon }[] = [
    { key: 'direct', label: t('newChat.direct'), icon: UserIcon },
    { key: 'group', label: t('newChat.group'), icon: Users },
  ];

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={t('newChat.title')}
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit} loading={submitting}>
            {t('common.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-surface-muted p-1">
          {modes.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                setSelected((current) => (key === 'direct' ? current.slice(0, 1) : current));
              }}
              className={cn(
                'focus-ring flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all',
                mode === key
                  ? 'bg-surface text-ink shadow-soft'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {mode === 'group' && (
          <div className="space-y-3">
            <Input
              name="groupName"
              label={t('newChat.groupName')}
              placeholder={t('newChat.groupNamePlaceholder')}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={60}
            />
            <Textarea
              name="groupDescription"
              label={`${t('newChat.groupDescription')} (${t('common.optional')})`}
              placeholder={t('newChat.groupDescriptionPlaceholder')}
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              rows={2}
              maxLength={200}
            />
          </div>
        )}

        <Input
          name="people"
          placeholder={t('newChat.searchPeople')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leading={<Search className="h-4 w-4" />}
        />

        {selected.length > 0 && mode === 'group' && (
          <p className="text-xs text-ink-muted">{t('newChat.selected', { count: selected.length })}</p>
        )}

        <div className="scrollbar-thin -mx-1 max-h-64 space-y-0.5 overflow-y-auto px-1">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-3.5 w-40" />
              </div>
            ))
          ) : users.length === 0 ? (
            <EmptyState title={t('newChat.noPeople')} className="py-8" />
          ) : (
            users.map((user) => {
              const checked = selected.includes(user._id);
              return (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => toggle(user._id)}
                  className={cn(
                    'focus-ring flex w-full items-center gap-3 rounded-xl p-2 text-start transition-colors',
                    checked ? 'bg-brand-500/10' : 'hover:bg-surface-muted'
                  )}
                >
                  <Avatar
                    name={user.name}
                    src={user.avatar}
                    color={user.avatarColor}
                    online={onlineUserIds.has(user._id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
                    <span className="block truncate text-xs text-ink-muted">{user.email}</span>
                  </span>
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                      checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-line'
                    )}
                  >
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
