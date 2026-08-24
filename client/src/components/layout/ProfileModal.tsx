import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Moon, Sun } from 'lucide-react';
import toast from 'react-hot-toast';

import { Avatar, Button, Input, Modal, Textarea } from '@/components/ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { userApi, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';

export function ProfileModal() {
  const { t } = useTranslation();
  const open = useUIStore((s) => s.profileOpen);
  const setOpen = useUIStore((s) => s.setProfileOpen);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);

  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setBio(user.bio);
    }
  }, [open, user]);

  if (!user) return null;

  const dirty = name.trim() !== user.name || bio.trim() !== user.bio;

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const { user: updated } = await userApi.update({ name: name.trim(), bio: bio.trim() });
      patchUser(updated);
      toast.success(t('profile.saved'));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const { user: updated } = await userApi.uploadAvatar(file);
      patchUser(updated);
      toast.success(t('profile.saved'));
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t('errors.generic'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={t('profile.title')}
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={!dirty} loading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar name={user.name} src={user.avatar} color={user.avatarColor} size="xl" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label={t('profile.changePhoto')}
              className={cn(
                'focus-ring absolute -bottom-1 -end-1 flex h-8 w-8 items-center justify-center rounded-full',
                'border-2 border-surface bg-brand-600 text-white shadow-soft transition-colors',
                'hover:bg-brand-500 disabled:opacity-60'
              )}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadAvatar(file);
                e.target.value = '';
              }}
            />
          </div>
          <p className="mt-3 text-sm text-ink-muted">{user.email}</p>
        </div>

        <Input
          name="name"
          label={t('auth.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
        />

        <Textarea
          name="bio"
          label={t('profile.bio')}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t('profile.bioPlaceholder')}
          rows={3}
          maxLength={160}
        />

        <div className="space-y-3 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">{t('profile.language')}</span>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">{t('profile.theme')}</span>
            <Button variant="secondary" size="sm" onClick={toggleTheme}>
              {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {theme === 'dark' ? t('profile.themeDark') : t('profile.themeLight')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
