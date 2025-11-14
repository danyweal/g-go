// psanw full app/lib/firebase/converters.ts
import type { FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions } from "firebase/firestore";

export type Millis = number;

export interface EventDoc {
  id: string;
  title: string;
  thumbUrl: string | null;
  coverUrl?: string | null;
  createdAtMillis: Millis;
  publishedAtMillis?: Millis | null;
  // add fields you actually store...
}

// Timestamp → millis helper
export function toMillis(v: unknown): Millis | null {
  // supports Firestore Timestamp, Date, or millis
  // @ts-expect-error duck type okay here, we guard
  if (v && typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

export const eventConverter: FirestoreDataConverter<EventDoc> = {
  toFirestore(e) {
    return {
      title: e.title,
      thumbUrl: e.thumbUrl ?? null,
      coverUrl: e.coverUrl ?? null,
      createdAt: e.createdAtMillis,
      publishedAt: e.publishedAtMillis ?? null,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, _options: SnapshotOptions): EventDoc {
    const d = snapshot.data() as Record<string, unknown>;
    return {
      id: snapshot.id,
      title: String(d.title ?? ""),
      thumbUrl: (d.thumbUrl as string | null) ?? null,
      coverUrl: (d.coverUrl as string | null) ?? null,
      createdAtMillis: toMillis(d.createdAt) ?? toMillis(d.created_at) ?? Date.now(),
      publishedAtMillis: toMillis(d.publishedAt) ?? toMillis(d.published_at),
    };
  }
};
