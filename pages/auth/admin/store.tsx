// pages/auth/admin/store.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import useAdminGuard from '@/utils/useAdminGuard';

type Album = {
  id: string;
  name?: string;        // NEW
  title: string;
  address?: string;     // NEW
  slug: string;
  description: string;
  published: boolean;
  primaryMediaId: string | null;
  primaryMediaUrl: string;
  createdAtMillis: number | null;
  mediaCount: number;
  imageCount: number;
  videoCount: number;
};

type MediaItem = {
  id: string;
  url: string;
  type: 'image' | 'video';
  thumbUrl: string | null;
  title: string;
  note?: string;        // NEW
  createdAtMillis: number | null;
};

type ApiError = Error & { details?: unknown; status?: number };

async function fetchJSON<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!j?.ok) {
    const err: ApiError = new Error(j?.error || 'Request failed');
    err.details = j;
    err.status = r.status;
    throw err;
  }
  return j;
}

function useAlbums() {
  const [items, setItems] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [after, setAfter] = useState<number | null>(null);

  // Return latest items so callers can re-sync "active" after refresh
  const load = async (reset = false): Promise<Album[]> => {
    const q = reset ? '' : (after ? `&after=${after}` : '');
    const j = await fetchJSON<{ items: Album[]; nextAfter: number | null }>(`/api/admin/store/list?limit=50${q}`);
    const nextAfter = j.nextAfter ?? null;
    const add = (j.items || []) as Album[];

    if (reset) {
      setItems(add);
      setAfter(nextAfter);
      return add;
    } else {
      setItems(prev => [...prev, ...add]);
      setAfter(nextAfter);
      return add;
    }
  };

  useEffect(() => {
    (async () => { try { await load(true); } finally { setLoading(false); } })();
  }, []);

  return { items, setItems, loading, load, after };
}

export default function AdminStorePage() {
  useAdminGuard();

  const { items: albums, setItems: setAlbums, loading: albumsLoading, load } = useAlbums();
  const [active, setActive] = useState<Album | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Firestore "create index" link, if required
  const [indexUrl, setIndexUrl] = useState<string | null>(null);

  // Create album (store) form — matches Gallery layout, with two extra fields
  const [form, setForm] = useState({ name: '', title: '', address: '', description: '', published: false });
  const [saving, setSaving] = useState(false);

  // Uploading state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  // Auto-select newest album when list loads
  useEffect(() => {
    if (!albumsLoading && !active && albums.length > 0) void openAlbum(albums[0]);
  }, [albumsLoading, albums, active]);

  async function createAlbum() {
    setSaving(true);
    try {
      const j = await fetchJSON<{ id: string; slug: string }>('/api/admin/store/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const created: Album = {
        id: j.id,
        slug: j.slug,
        name: form.name,
        title: form.title,
        address: form.address,
        description: form.description,
        published: form.published,
        primaryMediaId: null,
        primaryMediaUrl: '',
        createdAtMillis: Date.now(),
        mediaCount: 0,
        imageCount: 0,
        videoCount: 0,
      };

      setAlbums(prev => [created, ...prev]);
      setForm({ name: '', title: '', address: '', description: '', published: false });

      // Open created album immediately (uploader visible)
      await openAlbum(created);

      // Refresh list (counters/cover) and re-sync active object
      const latest = await load(true);
      const refreshed = latest.find(x => x.id === created.id);
      if (refreshed) setActive(refreshed);
    } finally { setSaving(false); }
  }

  async function openAlbum(a: Album) {
    setIndexUrl(null);
    setActive(a);
    setLoadingMedia(true);
    try {
      const j = await fetchJSON<{ items: MediaItem[] }>(`/api/admin/store/media-list?groupId=${a.id}&limit=200`);
      setMedia(j.items || []);
      setIndexUrl(null);
    } catch (e: unknown) {
      if (e?.details?.error === 'index_required' && e?.details?.createIndexUrl) {
        setIndexUrl(e.details.createIndexUrl as string);
      } else {
        alert(e?.message || 'Failed to load media');
      }
    } finally { setLoadingMedia(false); }

    // Scroll to editor
    setTimeout(() => {
      document.getElementById('album-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async function updateAlbum(patch: Partial<Album>) {
    if (!active) return;
    const payload: unknown = { id: active.id };
    if (typeof patch.name === 'string') payload.name = patch.name;
    if (typeof patch.title === 'string') payload.title = patch.title;
    if (typeof patch.address === 'string') payload.address = patch.address;
    if (typeof patch.description === 'string') payload.description = patch.description;
    if (typeof patch.published === 'boolean') payload.published = patch.published;
    if (typeof (patch as unknown).primaryMediaId === 'string') payload.primaryMediaId = (patch as unknown).primaryMediaId;

    await fetchJSON('/api/admin/store/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const updated = { ...active, ...patch } as Album;
    setActive(updated);
    setAlbums(prev => prev.map(x => (x.id === updated.id ? updated : x)));
  }

  async function deleteAlbum() {
    if (!active) return;
    if (!confirm('Delete this album and all media?')) return;

    await fetchJSON('/api/admin/store/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: active.id }),
    });

    setAlbums(prev => prev.filter(x => x.id !== active.id));
    setActive(null);
    setMedia([]);
    setIndexUrl(null);
  }

  function acceptFilesFromEvent(e: React.ChangeEvent<HTMLInputElement>) {
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
    return new Promise(resolve => {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.src = URL.createObjectURL(file);
        video.onloadeddata = () => { try { video.currentTime = Math.min(1, video.duration / 2); } catch {} };
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = Math.floor(640 * (video.videoHeight / video.videoWidth || 0.5625));
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
            if (!blob) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1] || null);
            reader.readAsDataURL(blob);
          }, 'image/jpeg', 0.8);
        };
        video.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  async function uploadFiles(files: FileList) {
    if (!active) { alert('Please select or create an album first.'); return; }
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    setUploadCount(list.length);

    try {
      let firstUpload = !active.primaryMediaUrl;
      for (const file of list) {
        const isVideo = file.type.startsWith('video');

        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(file);
        });

        let thumbData: string | null = null;
        if (isVideo) { try { thumbData = await generateVideoThumb(file); } catch {} }

        await fetchJSON('/api/admin/store/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            albumId: active.id,
            type: isVideo ? 'video' : 'image',
            title: file.name.replace(/\.[^.]+$/, ''),
            filename: file.name,
            contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
            data: b64,
            thumbData,
            thumbContentType: 'image/jpeg',
            setAsPrimary: firstUpload, // first upload becomes cover if none exists
          }),
        });

        firstUpload = false;
      }

      // Reload media grid and refresh album counters/cover
      await openAlbum(active);
      const latest = await load(true);
      const refreshed = latest.find(x => x.id === active.id);
      if (refreshed) setActive(refreshed);
    } finally {
      setUploading(false);
      setUploadCount(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeMedia(m: MediaItem) {
    if (!confirm('Delete this media?')) return;
    await fetchJSON('/api/admin/store/delete-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id }),
    });
    setMedia(prev => prev.filter(x => x.id !== m.id));

    // Refresh album header (counts/cover may change)
    const latest = await load(true);
    if (active) {
      const refreshed = latest.find(x => x.id === active.id);
      if (refreshed) setActive(refreshed);
    }
  }

  async function renameMedia(m: MediaItem, title: string) {
    await fetchJSON('/api/admin/store/update-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: m.id, title }),
    });
    setMedia(prev => prev.map(x => (x.id === m.id ? { ...x, title } : x)));
  }

  async function updateMediaNote(m: MediaItem, note: string) {
    await fetchJSON('/api/admin/store/update-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: m.id, note }),
    });
    setMedia(prev => prev.map(x => (x.id === m.id ? { ...x, note } : x)));
  }

  const headerCounts = useMemo(() => {
    if (!active) return '';
    return `${active.imageCount || 0} photos · ${active.videoCount || 0} videos`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.imageCount, active?.videoCount]);

  return (
    <>
      <Head><title>Admin • Store</title></Head>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-extrabold">Admin / Store</h1>
        <p className="text-gray-600 mt-1">Create a store album (name, title, address, description), then upload images/videos under it. Toggle publish when ready.</p>

        {/* Create album */}
        <div className="mt-6 rounded-2xl border p-4 bg-white">
          <h2 className="font-semibold text-lg">Create New Store</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="rounded-xl border px-3 py-2"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm(v => ({ ...v, name: e.target.value }))}
            />
            <input
              className="rounded-xl border px-3 py-2"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm(v => ({ ...v, title: e.target.value }))}
            />
            <input
              className="rounded-xl border px-3 py-2"
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm(v => ({ ...v, address: e.target.value }))}
            />
            <input
              className="rounded-xl border px-3 py-2 md:col-span-3"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm(v => ({ ...v, description: e.target.value }))}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm(v => ({ ...v, published: e.target.checked }))}
              />
              Publish immediately
            </label>
            <button
              disabled={!form.title || saving}
              onClick={createAlbum}
              className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: album list */}
          <div className="rounded-2xl border bg-white">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Stores</h2>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto divide-y">
              {albumsLoading ? (
                <div>Loading…</div>
              ) : albums.length === 0 ? (
                <div>No stores yet.</div>
              ) : (
                albums.map((a) => (
                  <button key={a.id} onClick={() => openAlbum(a)} className={`w-full text-left py-3 ${active?.id === a.id ? 'bg-gray-50' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{a.title}</div>
                        <div className="text-xs text-gray-500">{a.imageCount || 0} photos · {a.videoCount || 0} videos</div>
                        {(a.name || a.address) ? (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {[a.name, a.address].filter(Boolean).join(' • ')}
                          </div>
                        ) : null}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full border ${a.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                        {a.published ? 'Published' : 'Draft'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: editor + uploader */}
          <div id="album-editor" className="rounded-2xl border bg-white">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Store Editor</h2>
              {active ? <button onClick={deleteAlbum} className="text-red-600 hover:underline">Delete store</button> : null}
            </div>

            {!active ? (
              <div className="p-4 text-gray-500">Select a store to edit and upload media.</div>
            ) : (
              <div className="p-4 space-y-6">
                {/* Meta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-sm text-gray-600">Name</div>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={active.name || ''}
                      onChange={(e) => updateAlbum({ name: e.target.value }) as unknown}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm text-gray-600">Address</div>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={active.address || ''}
                      onChange={(e) => updateAlbum({ address: e.target.value }) as unknown}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm text-gray-600">Title</div>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={active.title}
                      onChange={(e) => updateAlbum({ title: e.target.value }) as unknown}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm text-gray-600">Publish</div>
                    <div className="mt-2">
                      <input type="checkbox" checked={active.published} onChange={(e) => updateAlbum({ published: e.target.checked })} />
                      <span className="ml-2 text-sm">{active.published ? 'Published' : 'Draft'}</span>
                    </div>
                  </label>
                  <label className="block md:col-span-2">
                    <div className="text-sm text-gray-600">Description</div>
                    <textarea
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      rows={3}
                      value={active.description}
                      onChange={(e) => updateAlbum({ description: e.target.value }) as unknown}
                    />
                  </label>
                </div>

                {/* 🔔 Index-required banner */}
                {indexUrl ? (
                  <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                    This store view needs a Firestore composite index.
                    <a href={indexUrl} target="_blank" rel="noreferrer" className="ml-2 underline font-medium">Create index in Firebase Console</a>
                  </div>
                ) : null}

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
                    <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={acceptFilesFromEvent} />
                  </div>
                  {uploading ? <div className="mt-3 text-sm text-gray-700">Uploading {uploadCount} file{uploadCount > 1 ? 's' : ''}…</div> : null}
                </div>

                {/* Media grid — identical layout, plus Note field */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Media ({media.length})</div>
                    <div className="text-xs text-gray-500">Click the star ★ to set album cover</div>
                  </div>

                  {loadingMedia ? (
                    <div>Loading…</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {media.map((m) => (
                        <div key={m.id} className="relative group rounded-xl overflow-hidden border bg-gray-50" title={m.title}>
                          <button
                            onClick={() => updateAlbum({ primaryMediaId: m.id } as unknown)}
                            title="Set as cover"
                            className={`absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-xs ${active?.primaryMediaId === m.id ? 'bg-black text-white' : 'bg-white/80 hover:bg-white'}`}
                          >★</button>
                          <button
                            onClick={() => removeMedia(m)}
                            title="Delete"
                            className="absolute right-2 top-2 z-10 rounded-full px-2 py-1 text-xs bg-white/80 hover:bg-white"
                          >🗑</button>

                          <div className="aspect-square w-full relative">
                            {m.type === 'video' ? (
                              m.thumbUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.thumbUrl} alt={m.title} className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-400">Video</div>
                              )
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.url} alt={m.title} className="absolute inset-0 w-full h-full object-cover" />
                            )}
                          </div>

                          <input
                            className="w-full border-t px-2 py-2 text-sm"
                            value={m.title}
                            onChange={(e) => renameMedia(m, e.target.value)}
                          />
                          <textarea
                            className="w-full border-t px-2 py-2 text-xs"
                            placeholder="Note (optional)"
                            value={m.note || ''}
                            onChange={(e) => updateMediaNote(m, e.target.value)}
                          />
                        </div>
                      ))}
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
