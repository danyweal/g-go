// pages/auth/admin/events.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import useAdminGuard from '@/utils/useAdminGuard';

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

function useEvents() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [after, setAfter] = useState<number | null>(null);

  const load = async (reset = false): Promise<EventItem[]> => {
    const q = reset ? '' : (after ? `&after=${after}` : '');
    const j = await fetchJSON<{ items: EventItem[]; nextAfter: number | null }>(
      `/api/admin/events/list?limit=50${q}`
    );
    const nextAfter = j.nextAfter ?? null;
    const add = (j.items || []) as EventItem[];

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

function normalizeLocalDatetimeStr(s: string | null | undefined) {
  return s ? String(s).slice(0, 16) : '';
}

/* ===========================
   Lightweight DateTime Picker
   - No external libs
   - Outputs "YYYY-MM-DDTHH:mm"
=========================== */

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

  // Sync when parent value changes externally
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
      {/* Text input with calendar button */}
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
            <button onClick={gotoPrevMonth} className="h-8 w-8 rounded-lg border hover:bg-gray-50" title="Prev month">‹</button>
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
            {days.map(d => {
              const isSel = d === selDay && viewMonth === (parsed?.month ?? viewMonth) && viewYear === (parsed?.year ?? viewYear);
              return (
                <button
                  key={d}
                  onClick={() => onDayClick(d)}
                  className={`py-2 rounded-lg border text-sm text-center hover:bg-gray-50 ${
                    d === selDay ? 'bg-black text-white border-black' : 'bg-white'
                  }`}
                >
                  {d}
                </button>
              );
            })}
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

/* ===========================
   Admin Events Page (same as before,
   but date field uses DateTimePicker)
=========================== */

export default function AdminEventsPage() {
  useAdminGuard();

  const { items: events, setItems: setEvents, loading: eventsLoading, load } = useEvents();
  const [active, setActive] = useState<EventItem | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const [indexUrl, setIndexUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    dateISO: '',
    location: '',
    published: false,
  });
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  useEffect(() => {
    if (!eventsLoading && !active && events.length > 0) void openEvent(events[0]);
  }, [eventsLoading, events, active]);

  async function createEvent() {
    setSaving(true);
    try {
      const j = await fetchJSON<{ id: string }>('/api/admin/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const created: EventItem = {
        id: j.id,
        title: form.title,
        description: form.description,
        dateISO: form.dateISO || null,
        location: form.location || null,
        published: form.published,
        primaryMediaId: null,
        primaryMediaUrl: '',
        createdAtMillis: Date.now(),
        mediaCount: 0,
        imageCount: 0,
        videoCount: 0,
      };

      setEvents(prev => [created, ...prev]);
      setForm({ title: '', description: '', dateISO: '', location: '', published: false });

      await openEvent(created);

      const latest = await load(true);
      const refreshed = latest.find(x => x.id === created.id);
      if (refreshed) setActive(refreshed);
    } finally { setSaving(false); }
  }

  async function openEvent(ei: EventItem) {
    setIndexUrl(null);
    setActive(ei);
    setLoadingMedia(true);
    try {
      const j = await fetchJSON<{ items: MediaItem[] }>(
        `/api/admin/events/media-list?groupId=${ei.id}&limit=200`
      );
      setMedia(j.items || []);
      setIndexUrl(null);
    } catch (e: unknown) {
      if (e?.details?.error === 'index_required' && e?.details?.createIndexUrl) {
        setIndexUrl(e.details.createIndexUrl as string);
      } else {
        alert(e?.message || 'Failed to load media');
      }
    } finally { setLoadingMedia(false); }

    setTimeout(() => {
      document.getElementById('event-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async function updateEvent(patch: Partial<EventItem>) {
    if (!active) return;
    const payload: unknown = { id: active.id };
    if (typeof patch.title === 'string') payload.title = patch.title;
    if (typeof patch.description === 'string') payload.description = patch.description;
    if (typeof patch.published === 'boolean') payload.published = patch.published;
    if (typeof (patch as unknown).primaryMediaId === 'string') payload.primaryMediaId = (patch as unknown).primaryMediaId;
    if (typeof (patch as unknown).dateISO === 'string') payload.dateISO = (patch as unknown).dateISO;
    if (typeof (patch as unknown).location === 'string') payload.location = (patch as unknown).location;

    await fetchJSON('/api/admin/events/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const updated = { ...active, ...patch } as EventItem;
    setActive(updated);
    setEvents(prev => prev.map(x => (x.id === updated.id ? updated : x)));
  }

  async function deleteEvent() {
    if (!active) return;
    if (!confirm('Delete this event and all media?')) return;

    await fetchJSON('/api/admin/events/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: active.id }),
    });

    setEvents(prev => prev.filter(x => x.id !== active.id));
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
    if (!active) { alert('Please select or create an event first.'); return; }
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

        await fetchJSON('/api/admin/events/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: active.id,
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

      await openEvent(active);
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
    await fetchJSON('/api/admin/events/delete-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id }),
    });
    setMedia(prev => prev.filter(x => x.id !== m.id));

    const latest = await load(true);
    if (active) {
      const refreshed = latest.find(x => x.id === active.id);
      if (refreshed) setActive(refreshed);
    }
  }

  async function renameMedia(m: MediaItem, title: string) {
    await fetchJSON('/api/admin/events/update-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: m.id, title }),
    });
    setMedia(prev => prev.map(x => (x.id === m.id ? { ...x, title } : x)));
  }

  const headerCounts = useMemo(() => {
    if (!active) return '';
    return `${active.imageCount || 0} photos · ${active.videoCount || 0} videos`;
  }, [active?.imageCount, active?.videoCount]);

  return (
    <>
      <Head><title>Admin • Events</title></Head>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-extrabold">Admin / Events</h1>
        <p className="text-gray-600 mt-1">
          Create an event (title, date & location, description), then upload images/videos under it. Toggle publish when ready.
        </p>

        {/* Create event */}
        <div className="mt-6 rounded-2xl border p-4 bg-white">
          <h2 className="font-semibold text-lg">Create New Event</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="rounded-xl border px-3 py-2"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm(v => ({ ...v, title: e.target.value }))}
            />
            {/* DateTime Picker (create) */}
            <DateTimePicker
              value={normalizeLocalDatetimeStr(form.dateISO)}
              onChange={(val) => setForm(v => ({ ...v, dateISO: val }))}
              className=""
            />
            <input
              className="rounded-xl border px-3 py-2"
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm(v => ({ ...v, location: e.target.value }))}
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
              onClick={createEvent}
              className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: events list */}
          <div className="rounded-2xl border bg-white">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Events</h2>
            </div>
            <div className="p-4 max-h:[70vh] lg:max-h-[70vh] overflow-auto divide-y">
              {eventsLoading ? (
                <div>Loading…</div>
              ) : events.length === 0 ? (
                <div>No events yet.</div>
              ) : (
                events.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => openEvent(e)}
                    className={`w-full text-left py-3 ${active?.id === e.id ? 'bg-gray-50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{e.title}</div>
                        <div className="text-xs text-gray-500">
                          {e.dateISO ? e.dateISO : 'No date'} {e.location ? `· ${e.location}` : ''}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {e.imageCount || 0} photos · {e.videoCount || 0} videos
                        </div>
                      </div>
                      <div
                        className={`text-xs px-2 py-1 rounded-full border ${
                          e.published
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}
                      >
                        {e.published ? 'Published' : 'Draft'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: editor + uploader */}
          <div id="event-editor" className="rounded-2xl border bg-white">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Event Editor</h2>
              {active ? (
                <button onClick={deleteEvent} className="text-red-600 hover:underline">
                  Delete event
                </button>
              ) : null}
            </div>

            {!active ? (
              <div className="p-4 text-gray-500">Select an event to edit and upload media.</div>
            ) : (
              <div className="p-4 space-y-6">
                {/* Meta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-sm text-gray-600">Title</div>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={active.title}
                      onChange={(e) => updateEvent({ title: e.target.value }) as unknown}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm text-gray-600">Publish</div>
                    <div className="mt-2">
                      <input
                        type="checkbox"
                        checked={active.published}
                        onChange={(e) => updateEvent({ published: e.target.checked })}
                      />
                      <span className="ml-2 text-sm">{active.published ? 'Published' : 'Draft'}</span>
                    </div>
                  </label>

                  <label className="block">
                    <div className="text-sm text-gray-600">Date & time</div>
                    {/* DateTime Picker (editor) */}
                    <DateTimePicker
                      value={normalizeLocalDatetimeStr(active.dateISO)}
                      onChange={(val) => updateEvent({ dateISO: val } as unknown)}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm text-gray-600">Location</div>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={active.location || ''}
                      onChange={(e) => updateEvent({ location: e.target.value } as unknown)}
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <div className="text-sm text-gray-600">Description</div>
                    <textarea
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      rows={3}
                      value={active.description}
                      onChange={(e) => updateEvent({ description: e.target.value }) as unknown}
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
                      <div className="font-medium">Add media to “{active.title}”</div>
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
                            onClick={() => updateEvent({ primaryMediaId: m.id } as unknown)}
                            title="Set as cover"
                            className={`absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-xs ${
                              active.primaryMediaId === m.id ? 'bg-black text-white' : 'bg-white/80 hover:bg-white'
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
      </div>
    </>
  );
}
