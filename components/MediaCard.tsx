import React from 'react';

export default function MediaCard({ it, onLike, onOpen }: { it: unknown; onLike?: ()=>void; onOpen?: ()=>void }) {
  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="aspect-video bg-neutral-100 flex items-center justify-center cursor-pointer" onClick={onOpen}>
        {it.type === 'video' ? (
          <video src={it.downloadUrl} controls className="w-full h-full object-cover" />
        ) : (
          <img src={it.downloadUrl} alt={it.title || ''} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="font-semibold">{it.title || '(Untitled)'}</div>
        <div className="text-sm text-neutral-500">{it.description}</div>
        <div className="text-xs text-neutral-400">Likes: {it.likesCount} · Comments: {it.commentsCount}</div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded border" onClick={onLike}>Like</button>
          <button className="px-3 py-1.5 rounded border" onClick={onOpen}>Comments</button>
        </div>
      </div>
    </div>
  );
}
