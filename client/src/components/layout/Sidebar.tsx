import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Moon, PenSquare, Search, Sun, X } from 'lucide-react';

import { ConversationList } from '@/components/chat/ConversationList';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Avatar, Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';
import { useUIStore } from '@/store/ui';

/** Small pill reflecting the live socket state. */
function ConnectionPill() {
  const { t } = useTranslation();
  const connection = useChatStore((s) => s.connection);
  if (connection === 'online') return null;

  return (
    <div
      role="status"
      className={cn(
        'mx-3 mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs',
        connection === 'connecting'
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-red-500/10 text-red-500'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          connection === 'connecting' ? 'animate-pulse bg-amber-500' : 'bg-red-500'
        )}
      />
      {connection === 'connecting' ? t('connection.reconnecting') : t('connection.offline')}
    </div>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);

  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const setNewChatOpen = useUIStore((s) => s.setNewChatOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const setProfileOpen = useUIStore((s) => s.setProfileOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  return (
    <aside className="flex h-full w-full flex-col border-e border-line bg-surface">
      <header className="flex h-16 shrink-0 items-center gap-2 px-3">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 text-start transition-colors hover:bg-surface-muted"
        >
          <Avatar
            name={user?.name ?? '?'}
            src={user?.avatar}
            color={user?.avatarColor}
            online={user ? onlineUserIds.has(user._id) : undefined}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{user?.name}</span>
            <span className="block truncate text-xs text-ink-muted">{user?.email}</span>
          </span>
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(false)}
          aria-label={t('common.close')}
          className="lg:hidden"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex items-center gap-1.5 px-3 pb-3">
        <Input
          name="filter"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sidebar.searchPlaceholder')}
          leading={<Search className="h-4 w-4" />}
          className="h-10"
        />
        <Button
          size="icon"
          onClick={() => setNewChatOpen(true)}
          aria-label={t('sidebar.newChat')}
          className="h-10 w-10 shrink-0"
        >
          <PenSquare className="h-[18px] w-[18px]" />
        </Button>
      </div>

      <ConnectionPill />

      <ConversationList query={query} />

      <footer className="flex shrink-0 items-center justify-between gap-1 border-t border-line px-3 py-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={t('profile.theme')}
          >
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </Button>
          <LanguageSwitcher compact align="start" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            aria-label={t('common.search')}
          >
            <Search className="h-[18px] w-[18px]" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          className="text-ink-muted hover:text-red-500"
        >
          <LogOut className="h-4 w-4 rtl-flip" />
          <span className="hidden sm:inline">{t('auth.signOut')}</span>
        </Button>
      </footer>
    </aside>
  );
}
