import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Users } from 'lucide-react';

import { Avatar, EmptyState, Input, Modal, Skeleton } from '@/components/ui';
import { messageApi } from '@/lib/api';
import { cn, formatListStamp, splitOnQuery } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks';
import { useChatStore } from '@/store/chat';
import { useUIStore } from '@/store/ui';
import type { SearchResult } from '@/types';

/** Renders the matched substring with a highlight. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitOnQuery(text, query).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded bg-brand-500/25 px-0.5 text-ink">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

export function SearchPanel() {
  const { t, i18n } = useTranslation();
  const open = useUIStore((s) => s.searchOpen);
  const setOpen = useUIStore((s) => s.setSearchOpen);
  const openConversation = useChatStore((s) => s.openConversation);
  const currentConversations = useChatStore((s) => s.conversations);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const debounced = useDebouncedValue(query.trim(), 300);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      return undefined;
    }
    if (!debounced) {
      setResults([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    messageApi
      .search(debounced)
      .then(({ results: found }) => !cancelled && setResults(found))
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  const titleOf = (result: SearchResult) => {
    const known = currentConversations.find((c) => c._id === result.conversation._id);
    if (known) return known.title;
    return result.conversation.type === 'group' ? result.conversation.name : result.sender.name;
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t('common.search')} size="lg">
      <div className="space-y-4">
        <Input
          name="q"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sidebar.searchPlaceholder')}
          leading={<Search className="h-4 w-4" />}
        />

        {debounced && !loading && (
          <p className="text-xs text-ink-muted">
            {t('sidebar.messagesFound', { count: results.length })}
          </p>
        )}

        <div className="scrollbar-thin -mx-1 max-h-[55vh] space-y-1 overflow-y-auto px-1">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 p-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))
          ) : !debounced ? (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title={t('sidebar.searchPlaceholder')}
              className="py-10"
            />
          ) : results.length === 0 ? (
            <EmptyState title={t('sidebar.noResults', { query: debounced })} className="py-10" />
          ) : (
            results.map((result) => (
              <button
                key={result._id}
                type="button"
                onClick={() => {
                  void openConversation(result.conversation._id);
                  setOpen(false);
                }}
                className={cn(
                  'focus-ring flex w-full items-start gap-3 rounded-xl p-2.5 text-start transition-colors',
                  'hover:bg-surface-muted'
                )}
              >
                {result.conversation.type === 'group' ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <Users className="h-4 w-4" />
                  </span>
                ) : (
                  <Avatar
                    name={result.sender.name}
                    src={result.sender.avatar}
                    gradient={result.sender.avatarColor}
                    size="md"
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{titleOf(result)}</span>
                    <span className="shrink-0 text-[11px] text-ink-faint">
                      {formatListStamp(result.createdAt, i18n.resolvedLanguage)}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-muted">
                    <span className="font-medium">{result.sender.name}: </span>
                    <Highlighted text={result.text} query={debounced} />
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
