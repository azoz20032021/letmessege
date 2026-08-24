import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, MessagesSquare } from 'lucide-react';

import { ChatHeader } from '@/components/chat/ChatHeader';
import { GroupInfoPanel } from '@/components/chat/GroupInfoPanel';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { MessageList } from '@/components/chat/MessageList';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { SearchPanel } from '@/components/chat/SearchPanel';
import { Sidebar } from '@/components/layout/Sidebar';
import { ProfileModal } from '@/components/layout/ProfileModal';
import { Button, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/hooks';
import { useAuthStore } from '@/store/auth';
import { useChatStore, useActiveConversation } from '@/store/chat';
import { useUIStore } from '@/store/ui';

export function ChatPage() {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();

  const userId = useAuthStore((s) => s.user?._id);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const bindSocket = useChatStore((s) => s.bindSocket);
  const conversation = useActiveConversation();

  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const setNewChatOpen = useUIStore((s) => s.setNewChatOpen);

  useEffect(() => {
    if (!userId) return undefined;
    const unbind = bindSocket(userId);
    void loadConversations();
    return unbind;
  }, [userId, bindSocket, loadConversations]);

  // On mobile the sidebar is a drawer; on desktop it is always in the layout.
  const showSidebar = isDesktop || sidebarOpen || !conversation;

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-muted">
      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.div
            initial={isDesktop ? false : { x: '-100%' }}
            animate={{ x: 0 }}
            exit={isDesktop ? undefined : { x: '-100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'z-30 h-full w-full shrink-0 lg:w-[22rem] xl:w-[24rem]',
              !isDesktop && conversation && 'fixed inset-y-0 start-0 shadow-lift rtl:[--tw-enter-translate-x:100%]'
            )}
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop behind the mobile drawer */}
      {!isDesktop && sidebarOpen && conversation && (
        <div
          role="presentation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Conversation pane */}
      <main className={cn('flex min-w-0 flex-1 flex-col', !conversation && 'hidden lg:flex')}>
        {conversation ? (
          <>
            <ChatHeader conversation={conversation} />
            <MessageList conversation={conversation} />
            <MessageComposer conversationId={conversation._id} />
          </>
        ) : (
          <div className="chat-canvas flex h-full flex-col">
            <div className="flex h-16 items-center px-3 lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                aria-label={t('sidebar.chats')}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
            <EmptyState
              className="flex-1"
              icon={<MessagesSquare className="h-7 w-7" />}
              title={t('chat.emptyTitle')}
              description={t('chat.emptySubtitle')}
              action={<Button onClick={() => setNewChatOpen(true)}>{t('sidebar.newChat')}</Button>}
            />
          </div>
        )}
      </main>

      <NewChatModal />
      <SearchPanel />
      <ProfileModal />
      {conversation?.type === 'group' && <GroupInfoPanel conversation={conversation} />}
    </div>
  );
}
