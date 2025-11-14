export type NewsDoc = {
  title: string;
  slug: string;
  coverUrl?: string;
  excerpt?: string;
  body?: string;
  published: boolean;
  createdAt: number; // ms
  updatedAt: number; // ms
};

export type EventDoc = {
  title: string;
  dateISO: string;
  location?: string;
  imageUrl?: string;
  description?: string;
  published: boolean;
  createdAt: number;
  updatedAt: number;
};

export type MediaDoc = {
  title?: string;
  description?: string;
  type: 'image' | 'video';
  contentType: string;
  storagePath: string;
  downloadUrl?: string;
  published: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: number;
  updatedAt: number;
};

export type CommentDoc = {
  content: string;
  authorName?: string;
  authorAvatarUrl?: string;
  userId?: string;
  approved: boolean;
  createdAt: number;
};
