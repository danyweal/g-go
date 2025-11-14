// pages/auth/admin/news/[id].tsx
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useAdminGuard from '@/utils/useAdminGuard';

/* ===========================
   Types
=========================== */

type NewsItem = {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  published: boolean;
  primaryMediaId: string | null;
  primaryMediaUrl: string | null;
  primaryMediaType?: 'image' | 'video' | null;
  primaryMediaThumbUrl?: string | null;
  createdAtMillis: number | null;
  mediaCount: number;
  imageCount: number;
  videoCount: number;
  tags?: string[] | null;
};

type MediaItem = {
  id: string;                         // global media doc id (cms/root/media)
  url: string | null;                 // download URL
  type: 'image' | 'video';
  thumbUrl: string | null;
  title: string;
  createdAtMillis: number | null;
};

/* ===========================
   Utils
=========================== */

type ApiError = Error & { details?: unknown; status?: number };

async function fetchJSON<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!j?.ok) {
    const err: ApiError = new Error(j?.error || 'Request failed');
    (err as unknown).details = j;
    (err as unknown).status = r.status;
    throw err;
  }
  return j;
}

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function fmtCounts(n: NewsItem | null) {
  if (!n) return '';
  return `${n.imageCount || 0} photos · ${n.videoCount || 0} videos`;
}

/* ===========================
   Page
=========================== */

export default function AdminNewsItemPage() {
  useAdminGuard();
  const router = useRouter();
  const id = String(router.query.id || '');

  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  const headerCounts = useMemo(() => fmtCounts(item), [item?.imageCount, item?.videoCount]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const j = await fetchJSON<{ item: NewsItem }>(`/api/admin/news/get?id=${encodeURIComponent(id)}`);
      setItem(j.item);
      await loadMedia(id);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadMedia = useCallback(async (nid: string) => {
    setLoadingMedia(true);
    try {
      const j = await fetchJSON<{ items: MediaItem[] }>(
        `/api/admin/news/media-list?groupId=${encodeURIComponent(nid)}&limit=400&include=all`
      );
      setMedia((j.items || []).map((m) => ({ ...m, url: m.url || null })));
    } finally {
      setLoadingMedia(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function updateArticle(patch: Partial<NewsItem>) {
    if (!item) return;
    const payload: unknown = { id: item.id };
    if (typeof patch.title === 'string') payload.title = patch.title;
    if (typeof patch.slug === 'string') payload.slug = patch.slug;
    if (typeof patch.excerpt === 'string') payload.excerpt = patch.excerpt;
    if (typeof patch.content === 'string') payload.content = patch.content;
    if (typeof patch.published === 'boolean') payload.published = patch.published;
    if (Array.isArray((patch as unknown).tags)) payload.tags = (patch as unknown).tags;

    setSaving(true);
    try {
      await fetchJSON('/api/admin/news/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setItem((prev) => (prev ? { ...prev, ...patch } as NewsItem : prev));
    } finally {
      setSaving(false);
    }
  }

  async function deleteArticle() {
    if (!item) return;
    if (!confirm('Delete this article and all media?')) return;
    await fetchJSON('/api/admin/news/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    });
    router.replace('/auth/admin/news');
  }

  function acceptFilesFromInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) void uploadFiles(files);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!e.dataTransfer?.files?.length) return;
    void uploadFiles(e.dataTransfer.files);
  }

  async function generateVideoThumb(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        const url = URL.createObjectURL(file);
        video.src = url;
        video.onloadeddata = () => {
          try { video.currentTime = Math.min(1, video.duration / 2); } catch {}
        };
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          const ratio = (video.videoHeight || 9) / (video.videoWidth || 16);
          canvas.width = 640;
          canvas.height = Math.max(1, Math.floor(640 * ratio));
          const ctx = canvas.getContext('2d');
          if (!ctx) { URL.revokeObjectURL(url); return resolve(null); }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url);
              if (!blob) return resolve(null);
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(',')[1] || null);
              reader.readAsDataURL(blob);
            },
            'image/jpeg',
            0.8
          );
        };
        video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      } catch {
        resolve(null);
      }
    });
  }

  async function uploadFiles(files: FileList) {
    if (!item) { alert('Please load the article first.'); return; }
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    setUploadCount(list.length);

    try {
      let firstUpload = !item.primaryMediaUrl;
      for (const file of list) {
        const isVideo = file.type?.startsWith('video');

        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(file);
        });

        let thumbData: string | null = null;
        if (isVideo) {
          try { thumbData = await generateVideoThumb(file); } catch {}
        }

        await fetchJSON('/api/admin/news/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newsId: item.id,
            type: isVideo ? 'video' : 'image',
            title: file.name.replace(/\.[^.]+$/, ''),
            filename: file.name,
            contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
            data: b64,
            thumbData,
            thumbContentType: 'image/jpeg',
            setAsPrimary: firstUpload,
          }),
        });

        firstUpload = false;
      }

      await load();
    } finally {
      setUploading(false);
      setUploadCount(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeMedia(m: MediaItem) {
    if (!item) return;
    if (!confirm('Delete this media?')) return;
    await fetchJSON('/api/admin/news/delete-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: m.id }),
    });
    await load();
  }

  async function renameMedia(m: MediaItem, title: string) {
    await fetchJSON('/api/admin/news/update-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: m.id, title }),
    });
    setMedia((prev) => prev.map((x) => (x.id === m.id ? { ...x, title } : x)));
  }

  async function setPrimary(m: MediaItem) {
    if (!item) return;
    await fetchJSON('/api/admin/news/set-primary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newsId: item.id, mediaId: m.id }),
    });
    await load();
  }

  return (
    <>
      <Head><title>Admin • News • {item?.title || 'Loading…'}</title></Head>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Admin / News</h1>
            <div className="text-gray-600 text-sm mt-1">Edit article, manage media, set cover.</div>
          </div>
          <Link href="/auth/admin/news" className="text-sm hover:underline">← Back to list</Link>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Meta */}
          <div className="rounded-2xl border bg-white">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Article</h2>
              {item ? (
                <button onClick={deleteArticle} className="text-red-600 hover:underline">Delete</button>
              ) : null}
            </div>
            <div className="p-4 space-y-4">
              {loading ? (
                <div>Loading…</div>
              ) : !item ? (
                <div>Not found.</div>
              ) : (
                <>
                  <label className="block">
                    <div className="text-sm text-gray-600">Title</div>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={item.title}
                      onChange={(e) => setItem({ ...item, title: e.target.value })}
                      onBlur={(e) => updateArticle({ title: e.target.value })}
                    />
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block">
                      <div className="text-sm text-gray-600">Slug</div>
                      <input
                        className="mt-1 w-full rounded-xl border px-3 py-2"
                        value={item.slug || ''}
                        onChange={(e) => setItem({ ...item, slug: e.target.value })}
                        onBlur={(e) => updateArticle({ slug: e.target.value || slugify(item.title) })}
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm text-gray-600">Publish</div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.published}
                          onChange={(e) => updateArticle({ published: e.target.checked })}
                        />
                        <span className="text-sm">{item.published ? 'Published' : 'Draft'}</span>
                      </div>
                    </label>
                  </div>
                  <label className="block">
                    <div className="text-sm text-gray-600">Tags (comma separated)</div>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={(item.tags || []).join(', ')}
                      onChange={(e) => setItem({ ...item, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                      onBlur={(e) => updateArticle({ tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } as unknown)}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm text-gray-600">Excerpt</div>
                    <textarea
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      rows={2}
                      value={item.excerpt || ''}
                      onChange={(e) => setItem({ ...item, excerpt: e.target.value })}
                      onBlur={(e) => updateArticle({ excerpt: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm text-gray-600">Content</div>
                    <textarea
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      rows={8}
                      value={item.content || ''}
                      onChange={(e) => setItem({ ...item, content: e.target.value })}
                      onBlur={(e) => updateArticle({ content: e.target.value })}
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Right: Media uploader & grid */}
          <div className="rounded-2xl border bg-white">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Media</h2>
                <div className="text-xs text-gray-500">{headerCounts}</div>
              </div>
            </div>

            <div className="p-4 space-y-6">
              {/* Uploader */}
              <div
                className={`rounded-xl border p-4 transition ${isDragging ? 'ring-2 ring-black/50 bg-gray-50' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                onDrop={onDrop}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Add media to this article</div>
                    <div className="text-xs text-gray-500">Drag & drop or pick multiple images/videos</div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={acceptFilesFromInput}
                  />
                </div>
                {uploading ? (
                  <div className="mt-3 text-sm text-gray-700">
                    Uploading {uploadCount} file{uploadCount > 1 ? 's' : ''}…
                  </div>
                ) : null}
              </div>

              {/* Grid */}
              {loadingMedia ? (
                <div>Loading…</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {media.map((m) => {
                    const isCover = !!(item?.primaryMediaUrl && m.url && item.primaryMediaUrl === m.url);
                    return (
                      <div key={m.id} className="relative group rounded-xl overflow-hidden border bg-gray-50" title={m.title}>
                        <button
                          onClick={() => setPrimary(m)}
                          title="Set as cover"
                          className={`absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-xs ${isCover ? 'bg-black text-white' : 'bg-white/80 hover:bg-white'}`}
                        >
                          ★
                        </button>
                        <button
                          onClick={() => removeMedia(m)}
                          title="Delete"
                          className="absolute right-2 top-2 z-10 rounded-full px-2 py-1 text-xs bg-white/80 hover:bg-white"
                        >
                          🗑
                        </button>

                        <div className="aspect-square w-full relative">
                          {m.type === 'video' ? (
                            m.thumbUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.thumbUrl} alt={m.title} className="absolute inset-0 w-full h-full object-cover" />
                            ) : m.url ? (
                              <video src={m.url} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-400">Video</div>
                            )
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.url || ''} alt={m.title} className="absolute inset-0 w-full h-full object-cover" />
                          )}
                        </div>

                        <input
                          className="w-full border-t px-2 py-2 text-sm"
                          value={m.title}
                          onChange={(e) => setMedia((prev) => prev.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))}
                          onBlur={(e) => renameMedia(m, e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
