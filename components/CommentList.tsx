// components/CommentList.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { db, ensureAnonymousAuth } from '@/lib/firebase';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';

type Props = { mediaId: string };
type CommentDoc = {
  text: string;
  authorId: string;
  authorName?: string;
  approved: boolean;
  createdAt?: unknown;
};

export default function CommentList({ mediaId }: Props) {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [comments, setComments] = useState<Array<{ id: string; data: CommentDoc }>>([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    ensureAnonymousAuth((u) => setUser(u ? { uid: u.uid } : null), (error) =>
      console.error('Auth failed:', error)
    );
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'media', mediaId, 'comments'),
      where('approved', '==', true),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, data: d.data() as CommentDoc })));
    });
    return () => unsub();
  }, [mediaId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const t = text.trim();
    if (!t) return;

    await addDoc(collection(db, 'media', mediaId, 'comments'), {
      text: t,
      authorId: user.uid,
      authorName: 'Anonymous',
      approved: false,
      createdAt: serverTimestamp(),
    });

    setText('');
    setPending('Submitted for approval. Your comment will appear after admin review.');
  };

  return (
    <div className="mt-4">
      {pending && (
        <div className="text-xs text-orange-600 mb-2" role="status">
          {pending}
        </div>
      )}

      <form onSubmit={submit} className="flex items-start gap-2 mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
          placeholder="Write a comment…"
          rows={2}
        />
        <button className="px-3 py-2 bg-neutral-900 text-white rounded">Post</button>
      </form>

      <div className="space-y-3">
        {comments.map(({ id, data }) => (
          <div key={id} className="bg-white rounded border p-3">
            <div className="text-sm text-neutral-600">{data.authorName ?? 'Anonymous'}</div>
            <div className="font-medium">{data.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
