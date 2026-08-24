export type LocaleCode = 'en' | 'ar' | 'tr';

export interface User {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  /** Colour key (violet, sky, emerald, amber, rose, cyan) — the client maps it to a gradient. */
  avatarColor: string;
  bio: string;
  locale: LocaleCode;
  isOnline: boolean;
  lastSeen: string;
}

export interface Attachment {
  url: string;
  publicId?: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface Message {
  _id: string;
  conversation: string;
  sender: Pick<User, '_id' | 'name' | 'avatar' | 'avatarColor'> & { email?: string };
  type: MessageType;
  text: string;
  attachments: Attachment[];
  replyTo?: Pick<Message, '_id' | 'text' | 'type' | 'createdAt'> & {
    sender: Pick<User, '_id' | 'name' | 'avatarColor'>;
  } | null;
  readBy: { user: string; at: string }[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;

  /** Client-only: set on optimistic bubbles until the server confirms. */
  pending?: boolean;
  failed?: boolean;
  tempId?: string;
}

export type ConversationType = 'direct' | 'group';

export interface Conversation {
  _id: string;
  type: ConversationType;
  name: string;
  description: string;
  avatar: string;
  members: User[];
  admins: string[];
  createdBy: string;
  lastMessage: Message | null;
  lastMessageAt: string;
  unreadCount: number;
  peer: User | null;
  title: string;
  createdAt: string;
}

/** A message from /messages/search, where `conversation` comes back populated. */
export interface SearchResult extends Omit<Message, 'conversation'> {
  conversation: Pick<Conversation, '_id' | 'type' | 'name' | 'avatar'> & { members: User[] };
}

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}

export interface TypingUser {
  userId: string;
  name: string;
}
