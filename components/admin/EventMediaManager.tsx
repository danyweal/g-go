// components/admin/EventMediaManager.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

type MediaItem = {
  id: string;
  url: string;
  type: 'image' | 'video';
  thumbUrl: string | null;
  title: string;
  createdAtMillis: number | null;
};

type ApiError = Error & { details?: unknown; status?: number };

async function fetchJSON<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!j?.ok) {
    const err: ApiError = new Error(j?.error || 'Request failed');
    err.details = j;
    (err as unknown).status = r.status;
    throw err;
  }
  return j;
}

export default function EventMediaManager({
  eventId,
  eventTitle,
  onPrimaryChange,
}: {
  eventId: string;
  eventTitle?: string;
  onPrimaryChange?: (mediaId: string) => void;
}) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexUrl, setIndexUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function reload() {
    setIndexUrl(null);
    setLoading(true);
    try {
      const j = await fetchJSON<{ items: MediaItem[] }>(
        `/api/admin/events/media-list?groupId=${encodeURIComponent(eventId)}&limit=400`
      );
      setMedia(j.items || []);
    } catch (e: unknown) {
      if (e?.details?.error === 'index_required' && e?.details?.createIndexUrl) {
        setIndexUrl(e.details.createIndexUrl as string);
      } else {
        alert(e?.message || 'Failed to load media');
      }
    } finally {
      setLoading(false);
    }
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
        video.onloadeddata = () => {
          try { video.currentTime = Math.min(1, video.duration / 2); } catch {}
        };
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
      } catch {
        resolve(null);
      }
    });
  }

  async function uploadFiles(files: FileList) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    setUploadCount(list.length);

    try {
      let first = media.length === 0;
      for (const file of list) {
        const isVideo = file.type.startsWith('video');

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

        await fetchJSON('/api/admin/events/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            type: isVideo ? 'video' : 'image',
            title: file.name.replace(/\.[^.]+$/, ''),
            filename: file.name,
            contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
            data: b64,
            thumbData,
            thumbContentType: 'image/jpeg',
            setAsPrimary: first,
          }),
        });

        first = false;
      }
      await reload();
    } finally {
      setUploading(false);
      setUploadCount(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeMedia(m: MediaItem) {
    if (!confirm('Delete this media?')) return;
    await fetchJSON('/api/admin/events/delete-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id }),
    });
    await reload();
  }

  async function renameMedia(m: MediaItem, title: string) {
    await fetchJSON('/api/admin/events/update-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: m.id, title }),
    });
    setMedia(prev => prev.map(x => (x.id === m.id ? { ...x, title } : x)));
  }

  async function setPrimary(m: MediaItem) {
    await fetchJSON('/api/admin/events/set-primary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, mediaId: m.id }),
    });
    onPrimaryChange?.(m.id);
    // visual feedback via reload
    await reload();
  }

  const counts = useMemo(() => {
    const photos = media.filter(m => m.type === 'image').length;
    const videos = media.filter(m => m.type === 'video').length;
    return `${photos} photos · ${videos} videos`;
  }, [media]);

  return (
    <div className="rounded-2xl border bg-white">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">
          Event Media{eventTitle ? ` — “${eventTitle}”` : ''} <span className="text-xs text-gray-500 ml-2">{counts}</span>
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {indexUrl ? (
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            This view needs a Firestore composite index.
            <a href={indexUrl} target="_blank" rel="noreferrer" className="ml-2 underline font-medium">
              Create index in Firebase Console
            </a>
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
              <div className="font-medium">Add images/videos to this event</div>
              <div className="text-xs text-gray-500">Drag & drop or select multiple files</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={acceptFilesFromEvent}
            />
          </div>
          {uploading ? (
            <div className="mt-3 text-sm text-gray-700">
              Uploading {uploadCount} file{uploadCount > 1 ? 's' : ''}…
            </div>
          ) : null}
        </div>

        {/* Grid */}
        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {media.map((m) => (
              <div key={m.id} className="relative group rounded-xl overflow-hidden border bg-gray-50">
                <button
                  onClick={() => setPrimary(m)}
                  title="Set as cover"
                  className="absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-xs bg-white/90 hover:bg-white"
                >
                  ★
                </button>
                <button
                  onClick={() => removeMedia(m)}
                  title="Delete"
                  className="absolute right-2 top-2 z-10 rounded-full px-2 py-1 text-xs bg-white/90 hover:bg-white"
                >
                  🗑
                </button>

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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
