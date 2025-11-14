// types/media.ts
export interface Media {
  id: string;
  type: 'image' | 'video';
  storagePath: string;
  url: string;
  caption?: string;
  uploaderId: string;
  uploaderName?: string;
  createdAt: unknown; // Firestore timestamp
  likesCount: number;
  reactionCounts: Record<string, number>;
  commentCount: number;
}

export interface Like {
  createdAt: unknown;
}

export interface Reaction {
  emoji: string;
  createdAt: unknown;
}

export interface Comment {
  id: string;
  commenterId: string;
  commenterName?: string;
  text: string;
  createdAt: unknown;
  reactionCounts: Record<string, number>;
}
