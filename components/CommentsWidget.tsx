import React from 'react';

export default function CommentsWidget({ mediaId }: { mediaId: string }) {
  const [comments, setComments] = React.useState<unknown[]>([]);
  const [content, setContent] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/media/${mediaId}`);
    const data = await res.json();
    if (data.ok) setComments(data.comments);
    setLoading(false);
  };
  React.useEffect(() => { load(); }, [mediaId]);

  const submit = async () => {
    if (!content.trim()) return;
    const res = await fetch('/api/media/comment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaId, content }) });
    const data = await res.json();
    if (data.ok) { setContent(''); alert('Comment submitted for approval'); }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <textarea className="w-full border rounded p-2" placeholder="Write a comment…" value={content} onChange={e=>setContent(e.target.value)} />
        <button className="px-3 py-1.5 rounded bg-black text-white" onClick={submit}>Send</button>
      </div>
      <div className="space-y-2">
        {loading ? <p>Loading comments…</p> : comments.length === 0 ? <p className="text-sm text-neutral-500">No comments yet.</p> : (
          comments.map((c:unknown) => (
            <div key={c.id} className="border rounded p-3 bg-white">
              <div className="text-sm font-semibold">{c.authorName || 'Anonymous'}</div>
              <div>{c.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
