import { create } from 'zustand';

type Theme = 'light' | 'dark';

const THEME_KEY = 'lm.theme';

const readTheme = (): Theme => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  searchOpen: boolean;
  profileOpen: boolean;
  newChatOpen: boolean;
  groupInfoOpen: boolean;

  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setProfileOpen: (open: boolean) => void;
  setNewChatOpen: (open: boolean) => void;
  setGroupInfoOpen: (open: boolean) => void;
  closeAllPanels: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: readTheme(),
  // On desktop the sidebar is always visible; this flag drives the mobile drawer.
  sidebarOpen: false,
  searchOpen: false,
  profileOpen: false,
  newChatOpen: false,
  groupInfoOpen: false,

  toggleTheme: () =>
    set((state) => {
      const theme: Theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      return { theme };
    }),

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setProfileOpen: (profileOpen) => set({ profileOpen }),
  setNewChatOpen: (newChatOpen) => set({ newChatOpen }),
  setGroupInfoOpen: (groupInfoOpen) => set({ groupInfoOpen }),

  closeAllPanels: () =>
    set({ searchOpen: false, profileOpen: false, newChatOpen: false, groupInfoOpen: false }),
}));
