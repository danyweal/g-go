// pages/auth/admin/events/[id].tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import useAdminGuard from '@/utils/useAdminGuard';

/* =========================
   Types
========================= */

type EventItem = {
  id: string;
  title: string;
  description: string;
  dateISO: string | null;
  location: string | null;
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
  createdAtMillis: number | null;
};

type ApiError = Error & { details?: unknown; status?: number };

/* =========================
   Helpers
========================= */

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

function normalizeLocalDatetimeStr(s: string | null | undefined) {
  return s ? String(s).slice(0, 16) : '';
}

function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }
function formatLocalISO(y: number, m1: number, d: number, hh: number, mm: number) {
  return `${y}-${pad2(m1)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}`;
}
function parseValue(v?: string | null) {
  const s = v || '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [ , y, mo, d, hh, mm ] = m;
  return {
    year: Number(y),
    month: Number(mo), // 1-12
    day: Number(d),
    hour: Number(hh),
    minute: Number(mm),
  };
}

/* =========================
   Lightweight DateTime Picker
   - No external libs
   - Outputs "YYYY-MM-DDTHH:mm"
========================= */

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function DateTimePicker({
  value,
  onChange,
  placeholder = 'YYYY-MM-DDTHH:mm',
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const parsed = parseValue(value);
  const now = new Date();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState<number>(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(parsed?.month ?? (now.getMonth() + 1)); // 1-12
  const [selDay, setSelDay] = useState<number>(parsed?.day ?? now.getDate());
  const [selHour, setSelHour] = useState<number>(parsed?.hour ?? now.getHours());
  const [selMinute, setSelMinute] = useState<number>(parsed?.minute ?? Math.floor(now.getMinutes() / 5) * 5);

  useEffect(() => {
    const p = parseValue(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelDay(p.day);
      setSelHour(p.hour);
      setSelMinute(p.minute);
    }
  }, [value]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function commit(y = viewYear, m1 = viewMonth, d = selDay, hh = selHour, mm = selMinute) {
    onChange(formatLocalISO(y, m1, d, hh, mm));
  }

  function daysInMonth(y: number, m1: number) {
    return new Date(y, m1, 0).getDate();
  }
  function firstWeekdayIndex(y: number, m1: number) {
    return new Date(y, m1 - 1, 1).getDay(); // 0=Sun
  }

  const dim = daysInMonth(viewYear, viewMonth);
  const firstIdx = firstWeekdayIndex(viewYear, viewMonth);
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  function gotoPrevMonth() {
    let y = viewYear, m = viewMonth - 1;
    if (m < 1) { m = 12; y -= 1; }
    setViewYear(y); setViewMonth(m);
  }
  function gotoNextMonth() {
    let y = viewYear, m = viewMonth + 1;
    if (m > 12) { m = 1; y += 1; }
    setViewYear(y); setViewMonth(m);
  }
  function onDayClick(d: number) {
    setSelDay(d);
    commit(viewYear, viewMonth, d);
  }
  function onTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value; // "HH:MM"
    const [hh, mm] = v.split(':').map(Number);
    setSelHour(hh);
    setSelMinute(mm);
    commit(viewYear, viewMonth, selDay, hh, mm);
  }
  function setNow() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth() + 1);
    setSelDay(t.getDate());
    setSelHour(t.getHours());
    setSelMinute(t.getMinutes());
    onChange(formatLocalISO(t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes()));
  }
  function clearAll() {
    onChange('');
  }

  const timeValue = `${pad2(selHour)}:${pad2(selMinute)}`;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Input + calendar button */}
      <div className="flex items-stretch gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="rounded-xl border px-3 py-2 flex-1"
        />
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="rounded-xl border px-3 py-2 hover:bg-gray-50"
          title="Open calendar"
        >
          📅
        </button>
      </div>

      {/* Popover */}
      {open && (
        <div className="absolute z-30 mt-2 w-80 rounded-2xl border bg-white shadow-lg p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={gotoPrevMonth} className="h-8 w-8 rounded-lg border hover:bg-gray-50" title="Previous month">‹</button>
            <div className="font-semibold">{MONTH_NAMES[viewMonth - 1]} {viewYear}</div>
            <button onClick={gotoNextMonth} className="h-8 w-8 rounded-lg border hover:bg-gray-50" title="Next month">›</button>
          </div>

          {/* Week header */}
          <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-1">
            {WEEKDAY.map(d => <div key={d} className="text-center py-1">{d}</div>)}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstIdx }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map(d => (
              <button
                key={d}
                onClick={() => onDayClick(d)}
                className={`py-2 rounded-lg border text-sm text-center hover:bg-gray-50 ${
                  d === selDay ? 'bg-black text-white border-black' : 'bg-white'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Time */}
          <div className="mt-3 flex items-center justify-between">
            <label className="text-sm text-gray-600">Time</label>
            <input
              type="time"
              value={timeValue}
              onChange={onTimeChange}
              className="rounded-lg border px-2 py-1 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={setNow} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm">Now</button>
              <button onClick={clearAll} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm">Clear</button>
            </div>
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg border bg-black text-white text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Page
========================= */

interface Props { id: string; }

const AdminEventDetailPage: NextPage<Props> = ({ id }) => {
  useAdminGuard();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const [indexUrl, setIndexUrl] = useState<string | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  /* ----- Load event + media ----- */

  async function loadEvent() {
    setLoadingEvent(true);
    try {
      const j = await fetchJSON<{ event: EventItem }>(`/api/admin/events/get?id=${encodeURIComponent(id)}`);
      setEvent(j.event);
    } finally {
      setLoadingEvent(false);
    }
  }

  async function loadMedia(eid: string) {
    setIndexUrl(null);
    setLoadingMedia(true);
    try {
      const j = await fetchJSON<{ items: MediaItem[] }>(
        `/api/admin/events/media-list?groupId=${encodeURIComponent(eid)}&limit=300`
      );
      setMedia(j.items || []);
      setIndexUrl(null);
    } catch (e: unknown) {
      if (e?.details?.error === 'index_required' && e?.details?.createIndexUrl) {
        setIndexUrl(String(e.details.createIndexUrl));
      } else {
        alert(e?.message || 'Failed to load media');
      }
    } finally {
      setLoadingMedia(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadEvent();
    })();
  }, [id]);

  useEffect(() => {
    if (event?.id) void loadMedia(event.id);
  }, [event?.id]);

  /* ----- Update event fields ----- */

  async function patchEvent(patch: Partial<EventItem>) {
    if (!event) return;
    const payload: unknown = { id: event.id };
    if (typeof patch.title === 'string') payload.title = patch.title;
    if (typeof patch.description === 'string') payload.description = patch.description;
    if (typeof (patch as unknown).dateISO === 'string') payload.dateISO = (patch as unknown).dateISO;
    if (typeof (patch as unknown).location === 'string') payload.location = (patch as unknown).location;
    if (typeof patch.published === 'boolean') payload.published = patch.published;
    if (typeof (patch as unknown).primaryMediaId === 'string') payload.primaryMediaId = (patch as unknown).primaryMediaId;

    await fetchJSON('/api/admin/events/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const updated = { ...event, ...patch } as EventItem;
    setEvent(updated);
  }

  async function deleteEvent() {
    if (!event) return;
    if (!confirm('Delete this event and all its media?')) return;
    await fetchJSON('/api/admin/events/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: event.id }),
    });
    // Redirect back to admin events list
    window.location.href = '/auth/admin/events';
  }

  /* ----- Upload helpers ----- */

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
    if (!event) { alert('Event not loaded yet.'); return; }
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    setUploadCount(list.length);

    try {
      let firstUpload = !event.primaryMediaUrl;
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

        await fetchJSON('/api/admin/events/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            type: isVideo ? 'video' : 'image',
            title: file.name.replace(/\.[^.]+$/, ''),
            filename: file.name,
            contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
            data: b64,
            thumbData,
            thumbContentType: 'image/jpeg',
            setAsPrimary: firstUpload, // first becomes cover if none exists
          }),
        });

        firstUpload = false;
      }

      // Reload media and refresh header counters/cover
      await loadMedia(event.id);
      await loadEvent();
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
    await loadMedia(event!.id);
    await loadEvent();
  }

  async function renameMedia(m: MediaItem, title: string) {
    await fetchJSON('/api/admin/events/update-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: m.id, title }),
    });
    setMedia(prev => prev.map(x => (x.id === m.id ? { ...x, title } : x)));
  }

  async function setPrimaryMedia(m: MediaItem) {
    await patchEvent({ primaryMediaId: m.id } as unknown);
    await loadEvent();
  }

  /* ----- UI helpers ----- */

  const headerCounts = useMemo(() => {
    if (!event) return '';
    return `${event.imageCount || 0} photos · ${event.videoCount || 0} videos`;
  }, [event?.imageCount, event?.videoCount]);

  /* =========================
     Render
  ========================= */

  return (
    <>
      <Head><title>Admin • Event</title></Head>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Admin / Event</h1>
            <p className="text-gray-600 mt-1">Edit details and manage media for this event.</p>
          </div>
          <Link
            href="/auth/admin/events"
            className="rounded-xl border px-4 py-2 hover:bg-gray-50"
            title="Back to events"
          >
            ← Back
          </Link>
        </div>

        {/* Event editor */}
        <div id="event-editor" className="mt-6 rounded-2xl border bg-white">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Event Editor</h2>
            {event ? (
              <button onClick={deleteEvent} className="text-red-600 hover:underline">Delete event</button>
            ) : null}
          </div>

          {loadingEvent ? (
            <div className="p-4">Loading…</div>
          ) : !event ? (
            <div className="p-4 text-red-600">Event not found.</div>
          ) : (
            <div className="p-4 space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-gray-600">Title</div>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={event.title}
                    onChange={(e) => patchEvent({ title: e.target.value })}
                  />
                </label>

                <label className="block">
                  <div className="text-sm text-gray-600">Publish</div>
                  <div className="mt-2">
                    <input
                      type="checkbox"
                      checked={event.published}
                      onChange={(e) => patchEvent({ published: e.target.checked })}
                    />
                    <span className="ml-2 text-sm">{event.published ? 'Published' : 'Draft'}</span>
                  </div>
                </label>

                <label className="block">
                  <div className="text-sm text-gray-600">Date & time</div>
                  <DateTimePicker
                    value={normalizeLocalDatetimeStr(event.dateISO)}
                    onChange={(val) => patchEvent({ dateISO: val } as unknown)}
                  />
                </label>

                <label className="block">
                  <div className="text-sm text-gray-600">Location</div>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={event.location || ''}
                    onChange={(e) => patchEvent({ location: e.target.value } as unknown)}
                  />
                </label>

                <label className="block md:col-span-2">
                  <div className="text-sm text-gray-600">Description</div>
                  <textarea
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    rows={3}
                    value={event.description}
                    onChange={(e) => patchEvent({ description: e.target.value })}
                  />
                </label>
              </div>

              {/* 🔔 Index-required banner */}
              {indexUrl ? (
                <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                  This event media view needs a Firestore composite index.
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
                    <div className="font-medium">Add media to “{event.title}”</div>
                    <div className="text-xs text-gray-500">Drag & drop or pick multiple images/videos</div>
                    <div className="text-xs text-gray-500 mt-1">{headerCounts}</div>
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

              {/* Media grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Media ({media.length})</div>
                  <div className="text-xs text-gray-500">Click the star ★ to set event cover</div>
                </div>

                {loadingMedia ? (
                  <div>Loading…</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {media.map((m) => (
                      <div
                        key={m.id}
                        className="relative group rounded-xl overflow-hidden border bg-gray-50"
                        title={m.title}
                      >
                        <button
                          onClick={() => setPrimaryMedia(m)}
                          title="Set as cover"
                          className={`absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-xs ${
                            event.primaryMediaId === m.id ? 'bg-black text-white' : 'bg-white/80 hover:bg-white'
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
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                Video
                              </div>
                            )
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.url}
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
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

/* =========================
   SSR to pass id
========================= */
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { id } = ctx.params || {};
  if (!id || typeof id !== 'string') return { notFound: true };
  return { props: { id } };
};

export default AdminEventDetailPage;
