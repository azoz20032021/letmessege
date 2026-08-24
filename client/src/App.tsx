import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

import { AuthPage } from '@/pages/AuthPage';
import { ChatPage } from '@/pages/ChatPage';
import { Button, Spinner } from '@/components/ui';
import { setSessionExpiredHandler } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';

function FullPageSpinner() {
  return (
    <div className="flex h-dvh items-center justify-center bg-surface-muted">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') return <FullPageSpinner />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface-muted px-6 text-center">
      <p className="text-6xl font-bold text-brand-500">404</p>
      <div>
        <h1 className="text-xl font-semibold text-ink">{t('errors.notFound')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('errors.notFoundHint')}</p>
      </div>
      <Button onClick={() => window.location.assign('/')}>{t('errors.goHome')}</Button>
    </div>
  );
}

export default function App() {
  const { t } = useTranslation();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // A failed refresh means the session is really gone: drop the socket and say so.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      disconnectSocket();
      useAuthStore.setState({ user: null, status: 'anonymous' });
      toast.error(t('errors.sessionExpired'));
    });
  }, [t]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3200,
          style: {
            background: theme === 'dark' ? '#1b1f2d' : '#ffffff',
            color: theme === 'dark' ? '#eef0f7' : '#111420',
            border: `1px solid ${theme === 'dark' ? '#272c3d' : '#e3e6ef'}`,
            borderRadius: '0.875rem',
            fontSize: '14px',
            boxShadow: '0 16px 40px -16px rgb(0 0 0 / 0.25)',
          },
        }}
      />
    </BrowserRouter>
  );
}
