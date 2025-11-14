// components/MediaGallery.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit as fsLimit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import MediaCard from './MediaCard';
import UploadMediaForm from './UploadMediaForm';

interface MediaItem {
  id: string;
  createdAt?: Timestamp;
  url: string;
  type: 'image' | 'video';
  caption?: string;
  likesCount?: number;
  reactionCounts?: Record<string, number>;
  commentCount?: number;
}

const PAGE_SIZE = 9;

const Spinner = () => (
  <div className="flex justify-center items-center py-6">
    <svg
      aria-hidden="true"
      className="w-8 h-8 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  </div>
);

export default function MediaGallery() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Initial real-time subscription to first page
  useEffect(() => {
    setLoading(true);
    const firstQuery = query(
      collection(db, 'media'),
      orderBy('createdAt', 'desc'),
      fsLimit(PAGE_SIZE)
    );
    const unsubscribe = onSnapshot(
      firstQuery,
      (snap) => {
        const docs: MediaItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MediaItem, 'id'>),
        }));
        setItems(docs);
        setLastDoc(snap.docs[snap.docs.length - 1] || null);
        setHasMore(snap.docs.length === PAGE_SIZE);
        setLoading(false);
      },
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load gallery.';
        setError(msg);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const moreQuery = query(
        collection(db, 'media'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        fsLimit(PAGE_SIZE)
      );
      const snap = await getDocs(moreQuery);
      if (!snap.empty) {
        const moreItems: MediaItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MediaItem, 'id'>),
        }));
        setItems((prev) => [...prev, ...moreItems]);
        setLastDoc(snap.docs[snap.docs.length - 1] || lastDoc);
        if (snap.docs.length < PAGE_SIZE) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load more items.';
      setError(msg);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, lastDoc, loadingMore]);

  return (
    <div className="max-w-7xl mx-auto px-6 space-y-10">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <UploadMediaForm onUploaded={() => loadMore()} />
        </div>
      </div>

      {error && (
        <div className="bg-red-100 text-red-800 px-4 py-3 rounded-md">
          Error loading gallery: {error}
        </div>
      )}

      {loading && <Spinner />}

      {!loading && items.length === 0 && (
        <div className="text-center text-palestine-muted py-10">
          No media uploaded yet. Be the first to share!
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((m) => (
          <MediaCard key={m.id} media={m} />
        ))}
      </div>

      <div className="flex justify-center mt-8">
        {hasMore ? (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn btn-outline inline-flex items-center gap-2"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        ) : (
          items.length > 0 && (
            <div className="text-sm text-palestine-muted">No more items to show.</div>
          )
        )}
      </div>
    </div>
  );
}
