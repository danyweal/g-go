// pages/auth/admin/news.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';

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
  primaryMediaId: string | null;      // may be a hash in some APIs
  primaryMediaUrl: string;            // reliable for star/cover selection
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

type ApiError = Error & { details?: unknown; status?: number };

/* ===========================
   Utils
=========================== */

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

function useNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [after, setAfter] = useState<number | null>(null);

  const load = async (reset = false): Promise<NewsItem[]> => {
    const q = reset ? '' : (after ? `&after=${after}` : '');
    const j = await fetchJSON<{ items: NewsItem[]; nextAfter: number | null }>(
      `/api/admin/news/list?limit=50${q}`
    );
    const nextAfter = j.nextAfter ?? null;
    const add = (j.items || []) as NewsItem[];

    if (reset) {
      setItems(add);
      setAfter(nextAfter);
      return add;
    } else {
      setItems((prev) => [...prev, ...add]);
      setAfter(nextAfter);
      return add;
    }
  };

  useEffect(() => {
    (async () => {
      try { await load(true); }
      finally { setLoading(false); }
    })();
  }, []);

  return { items, setItems, loading, load, after };
}

/* ===========================
   Admin News Page (events-style parity)
=========================== */

export default function AdminNewsPage() {
  useAdminGuard();

  const { items: articles, setItems: setArticles, loading: articlesLoading, load } = useNews();
  const [active, setActive] = useState<NewsItem | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    published: false,
    tags: '' as string | string[],
  });
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  useEffect(() => {
    if (!articlesLoading && !active && articles.length > 0) {
      void openArticle(articles[0]);
    }
  }, [articlesLoading, articles, active]);

  async function createArticle() {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        excerpt: form.excerpt,
        content: form.content,
        published: form.published,
        tags:
          typeof form.tags === 'string'
            ? form.tags.split(',').map((s) => s.trim()).filter(Boolean)
            : form.tags,
      };
      const j = await fetchJSON<{ id: string }>('/api/admin/news/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const created: NewsItem = {
        id: j.id,
        title: payload.title,
        slug: payload.slug || null,
        excerpt: payload.excerpt || null,
        content: payload.content || null,
        published: payload.published,
        primaryMediaId: null,
        primaryMediaUrl: '',
        createdAtMillis: Date.now(),
        mediaCount: 0,
        imageCount: 0,
        videoCount: 0,
        tags: (payload.tags as string[]) || [],
      };

      setArticles((prev) => [created, ...prev]);
      setForm({ title: '', slug: '', excerpt: '', content: '', published: false, tags: '' });

      await openArticle(created);

      const latest = await load(true);
      const refreshed = latest.find((x) => x.id === created.id);
      if (refreshed) setActive(refreshed);
    } finally {
      setSaving(false);
    }
  }

  async function openArticle(ni: NewsItem) {
    setActive(ni);
    setLoadingMedia(true);
    try {
      // include=all so videos are returned too
      const j = await fetchJSON<{ items: MediaItem[] }>(
        `/api/admin/news/media-list?groupId=${encodeURIComponent(ni.id)}&limit=400&include=all`
      );
      setMedia((j.items || []).map((m) => ({ ...m, url: m.url || null })));
    } catch (e: unknown) {
      alert(e?.message || 'Failed to load media');
    } finally {
      setLoadingMedia(false);
    }

    // jump to editor
    setTimeout(() => {
      document.getElementById('news-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async function updateArticle(patch: Partial<NewsItem>) {
    if (!active) return;
    const payload: unknown = { id: active.id };
    if (typeof patch.title === 'string') payload.title = patch.title;
    if (typeof patch.slug === 'string') payload.slug = patch.slug;
    if (typeof patch.excerpt === 'string') payload.excerpt = patch.excerpt;
    if (typeof patch.content === 'string') payload.content = patch.content;
    if (typeof patch.published === 'boolean') payload.published = patch.published;
    if (Array.isArray((patch as unknown).tags)) payload.tags = (patch as unknown).tags;

    await fetchJSON('/api/admin/news/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const updated = { ...active, ...patch } as NewsItem;
    setActive(updated);
    setArticles((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function deleteArticle() {
    if (!active) return;
    if (!confirm('Delete this article and all media?')) return;

    await fetchJSON('/api/admin/news/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: active.id }),
    });

    setArticles((prev) => prev.filter((x) => x.id !== active.id));
    setActive(null);
    setMedia([]);
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
    if (!active) { alert('Please select or create an article first.'); return; }
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    setUploadCount(list.length);

    try {
      let firstUpload = !active.primaryMediaUrl;
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
            newsId: active.id,
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

      await openArticle(active);
      const latest = await load(true);
      const refreshed = latest.find((x) => x.id === active.id);
      if (refreshed) setActive(refreshed);
    } finally {
      setUploading(false);
      setUploadCount(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeMedia(m: MediaItem) {
    if (!active) return;
    if (!confirm('Delete this media?')) return;
    await fetchJSON('/api/admin/news/delete-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: m.id }),
    });
    setMedia((prev) => prev.filter((x) => x.id !== m.id));

    const latest = await load(true);
    if (active) {
      const refreshed = latest.find((x) => x.id === active.id);
      if (refreshed) setActive(refreshed);
    }
  }

  async function renameMedia(m: MediaItem, title: string) {
    if (!active) return;
    await fetchJSON('/api/admin/news/update-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: m.id, title }),
    });
    setMedia((prev) => prev.map((x) => (x.id === m.id ? { ...x, title } : x)));
  }

  async function setPrimary(m: MediaItem) {
    if (!active) return;
    await fetchJSON('/api/admin/news/set-primary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newsId: active.id, mediaId: m.id }),
    });
    // optimistic UI
    setActive((prev) => (prev ? { ...prev, primaryMediaUrl: m.url || '' } : prev));
    await openArticle(active);
    const latest = await load(true);
    const refreshed = latest.find((x) => x.id === active.id);
    if (refreshed) setActive(refreshed);
  }

  const headerCounts = useMemo(() => {
    if (!active) return '';
    return `${active.imageCount || 0} photos · ${active.videoCount || 0} videos`;
  }, [active?.imageCount, active?.videoCount]);

  return (
    <>
      <Head><title>Admin • News</title></Head>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-extrabold">Admin / News</h1>
        <p className="text-gray-600 mt-1">
          Create an article (title, slug, excerpt, content), then upload images/videos. Toggle publish when ready.
        </p>

        {/* Create article */}
        <div className="mt-6 rounded-2xl border p-4 bg-white">
          <h2 className="font-semibold text-lg">Create New Article</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="rounded-xl border px-3 py-2"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))}
            />
            <input
              className="rounded-xl border px-3 py-2"
              placeholder="Slug (optional)"
              value={form.slug}
              onChange={(e) => setForm((v) => ({ ...v, slug: e.target.value }))}
            />
            <input
              className="rounded-xl border px-3 py-2"
              placeholder="Tags (comma separated)"
              value={typeof form.tags === 'string' ? form.tags : (form.tags || []).join(', ')}
              onChange={(e) => setForm((v) => ({ ...v, tags: e.target.value }))}
            />
            <input
              className="rounded-xl border px-3 py-2 md:col-span-3"
              placeholder="Excerpt"
              value={form.excerpt}
              onChange={(e) => setForm((v) => ({ ...v, excerpt: e.target.value }))}
            />
            <textarea
              className="rounded-xl border px-3 py-2 md:col-span-3"
              placeholder="Content"
              rows={4}
              value={form.content}
              onChange={(e) => setForm((v) => ({ ...v, content: e.target.value }))}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm((v) => ({ ...v, published: e.target.checked }))}
              />
              Publish immediately
            </label>
            <button
              disabled={!form.title || saving}
              onClick={createArticle}
              className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: articles list */}
          <div className="rounded-2xl border bg-white">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Articles</h2>
            </div>
            <div className="p-4 max-h-[70vh] lg:max-h-[70vh] overflow-auto divide-y">
              {articlesLoading ? (
                <div>Loading…</div>
              ) : articles.length === 0 ? (
                <div>No articles yet.</div>
              ) : (
                articles.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openArticle(n)}
                    className={`w-full text-left py-3 ${active?.id === n.id ? 'bg-gray-50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{n.title}</div>
                        <div className="text-xs text-gray-500">
                          {n.slug ? n.slug : 'No slug'}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {n.imageCount || 0} photos · {n.videoCount || 0} videos
                        </div>
                      </div>
                      <div
                        className={`text-xs px-2 py-1 rounded-full border ${
                          n.published
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}
                      >
                        {n.published ? 'Published' : 'Draft'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: editor + uploader */}
          <div id="news-editor" className="rounded-2xl border bg-white">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Article Editor</h2>
              {active ? (
                <button onClick={deleteArticle} className="text-red-600 hover:underline">
                  Delete article
                </button>
              ) : null}
            </div>

            {!active ? (
              <div className="p-4 text-gray-500">Select an article to edit and upload media.</div>
            ) : (
              <div className="p-4 space-y-6">
                {/* Meta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-sm text-gray-600">Title</div>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={active.title}
                      onChange={(e) => updateArticle({ title: e.target.value }) as unknown}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm text-gray-600">Publish</div>
                    <div className="mt-2">
                      <input
                        type="checkbox"
                        checked={active.published}
                        onChange={(e) => updateArticle({ published: e.target.checked })}
                      />
                      <span className="ml-2 text-sm">{active.published ? 'Published' : 'Draft'}</span>
                    </div>
                  </label>

                  <label className="block">
                    <div className="text-sm text-gray-600">Slug</div>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={active.slug || ''}
                      onChange={(e) =>
                        updateArticle({ slug: e.target.value || slugify(active.title) } as unknown)
                      }
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm text-gray-600">Tags (comma separated)</div>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={(active.tags || []).join(', ')}
                      onChange={(e) =>
                        updateArticle({
                          tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        } as unknown)
                      }
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <div className="text-sm text-gray-600">Excerpt</div>
                    <textarea
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      rows={2}
                      value={active.excerpt || ''}
                      onChange={(e) => updateArticle({ excerpt: e.target.value }) as unknown}
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <div className="text-sm text-gray-600">Content</div>
                    <textarea
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      rows={6}
                      value={active.content || ''}
                      onChange={(e) => updateArticle({ content: e.target.value }) as unknown}
                    />
                  </label>
                </div>

                {/* Uploader */}
                <div
                  className={`rounded-xl border p-4 transition ${isDragging ? 'ring-2 ring-black/50 bg-gray-50' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                  onDrop={onDrop}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">Add media to “{active.title}”</div>
                      <div className="text-xs text-gray-500">Drag & drop or pick multiple images/videos</div>
                      <div className="text-xs text-gray-500 mt-1">{headerCounts}</div>
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

                {/* Media grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Media ({media.length})</div>
                    <div className="text-xs text-gray-500">Click the star ★ to set article cover</div>
                  </div>

                  {loadingMedia ? (
                    <div>Loading…</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {media.map((m) => {
                        const isCover = !!(active?.primaryMediaUrl && m.url && active.primaryMediaUrl === m.url);
                        return (
                          <div
                            key={m.id}
                            className="relative group rounded-xl overflow-hidden border bg-gray-50"
                            title={m.title}
                          >
                            <button
                              onClick={() => setPrimary(m)}
                              title="Set as cover"
                              className={`absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-xs ${
                                isCover ? 'bg-black text-white' : 'bg-white/80 hover:bg-white'
                              }`}
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
                                  <img
                                    src={m.thumbUrl}
                                    alt={m.title}
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                ) : m.url ? (
                                  <video
                                    src={m.url}
                                    preload="metadata"
                                    muted
                                    playsInline
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                    Video
                                  </div>
                                )
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={m.url || ''}
                                  alt={m.title}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              )}
                            </div>

                            <input
                              className="w-full border-t px-2 py-2 text-sm"
                              value={m.title}
                              onChange={(e) => renameMedia(m, e.target.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
