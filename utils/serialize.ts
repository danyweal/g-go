// utils/serialize.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

export type DateEncoding = 'iso' | 'millis';
export type BigIntEncoding = 'string' | 'number' | 'omit';

export interface SerializeOptions {
  date?: DateEncoding;            // default: 'iso'
  timestamp?: DateEncoding;       // Firestore Timestamp -> 'iso' | 'millis' (default: 'iso')
  bigInt?: BigIntEncoding;        // default: 'string'
  mapAs?: 'object' | 'entries';   // default: 'object' (entries = [key,value][])
  includeNullForUndefined?: boolean; // default: false (omit undefined in objects)
  maxDepth?: number;              // default: 20 (safety valve)
}

const DEFAULTS: Required<SerializeOptions> = {
  date: 'iso',
  timestamp: 'iso',
  bigInt: 'string',
  mapAs: 'object',
  includeNullForUndefined: false,
  maxDepth: 20,
};

// Firestore Timestamp structural duck-typing
function isFirestoreTimestamp(v: any): boolean {
  return !!v && typeof v.toDate === 'function' && typeof v.toMillis === 'function';
}

// Prisma Decimal or any object that exposes toJSON() cleanly
function hasToJSON(v: any): boolean {
  return !!v && typeof v.toJSON === 'function';
}

function isPlainObject(v: any): v is Record<string, any> {
  if (Object.prototype.toString.call(v) !== '[object Object]') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === null || proto === Object.prototype;
}

function serializeDate(d: Date, how: DateEncoding) {
  return how === 'millis' ? d.getTime() : d.toISOString();
}

function serializeBigInt(b: bigint, how: BigIntEncoding) {
  if (how === 'omit') return undefined;
  if (how === 'number') {
    // Beware of precision loss for big values; string is safer.
    const asNum = Number(b);
    if (!Number.isFinite(asNum)) return b.toString();
    return asNum;
  }
  return b.toString();
}

function serializeError(e: Error) {
  return {
    name: e.name,
    message: e.message,
    // Stack can be large; include but it's fine to strip if you prefer
    stack: e.stack,
  };
}

function serializeURL(u: URL) {
  return u.toString();
}

function serializeRegExp(r: RegExp) {
  return r.toString();
}

function serializeBuffer(b: any) {
  // Node Buffer -> base64 string
  if (typeof b?.toString === 'function') return b.toString('base64');
  return undefined;
}

/**
 * Deeply converts a value into a JSON-serializable structure.
 * - Handles Date, Firestore Timestamp, BigInt, Map, Set, URL, RegExp, Error, Buffer
 * - Omits functions/symbols
 * - Avoids circular references
 */
export function serializeProps<T>(input: T, opts: SerializeOptions = {}): T {
  const o = { ...DEFAULTS, ...opts };
  const seen = new WeakSet<object>();

  const walk = (value: any, depth: number): any => {
    if (value === null) return null;
    if (value === undefined) return o.includeNullForUndefined ? null : undefined;
    if (depth > o.maxDepth) return undefined;

    const t = typeof value;

    if (t === 'string' || t === 'number' || t === 'boolean') return value;
    if (t === 'bigint') return serializeBigInt(value as bigint, o.bigInt);
    if (t === 'symbol' || t === 'function') return undefined;

    // Dates
    if (value instanceof Date) return serializeDate(value, o.date);

    // Firestore Timestamp
    if (isFirestoreTimestamp(value)) {
      return o.timestamp === 'millis'
        ? value.toMillis()
        : value.toDate().toISOString();
    }

    // URL
    if (typeof URL !== 'undefined' && value instanceof URL) return serializeURL(value);

    // RegExp
    if (value instanceof RegExp) return serializeRegExp(value);

    // Error
    if (value instanceof Error) return serializeError(value);

    // Buffer (Node)
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function' && Buffer.isBuffer?.(value)) {
      return serializeBuffer(value);
    }

    // Objects providing a clean toJSON (e.g., Prisma Decimal)
    if (hasToJSON(value)) {
      try {
        const j = value.toJSON();
        return walk(j, depth + 1);
      } catch {
        // fall through to generic handling
      }
    }

    // Arrays
    if (Array.isArray(value)) {
      const out: any[] = [];
      for (let i = 0; i < value.length; i++) {
        const v = walk(value[i], depth + 1);
        // In arrays, undefined becomes null to keep indexes stable
        out.push(v === undefined ? null : v);
      }
      return out;
    }

    // Map
    if (value instanceof Map) {
      if (o.mapAs === 'entries') {
        const arr: any[] = [];
        value.forEach((v, k) => arr.push([walk(k, depth + 1), walk(v, depth + 1)]));
        return arr;
      }
      const obj: Record<string, any> = {};
      value.forEach((v, k) => {
        const key = typeof k === 'string' ? k : String(k);
        const sv = walk(v, depth + 1);
        if (sv !== undefined) obj[key] = sv;
      });
      return obj;
    }

    // Set
    if (value instanceof Set) {
      const arr: any[] = [];
      value.forEach((v) => arr.push(walk(v, depth + 1)));
      return arr;
    }

    // Plain object (safe recursive)
    if (isPlainObject(value)) {
      if (seen.has(value)) return undefined; // prevent circular refs
      seen.add(value);
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        const sv = walk(v, depth + 1);
        if (sv !== undefined) out[k] = sv;
        else if (o.includeNullForUndefined) out[k] = null;
      }
      seen.delete(value);
      return out;
    }

    // Fallback: toString for unknown instances (keeps it JSON-safe)
    try {
      const s = String(value);
      return s === '[object Object]' ? undefined : s;
    } catch {
      return undefined;
    }
  };

  // We cast back to T for ergonomic return in GSSP; structurally it's JSON-safe.
  return walk(input, 0) as T;
}

/**
 * Convenience wrapper for getServerSideProps:
 * Ensures the returned `props` are JSON-serializable.
 *
 * Usage:
 *   export const getServerSideProps = withSerializedProps(async (ctx) => {
 *     const data = await fetchStuff();
 *     return { props: { data } };
 *   });
 */
import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult } from 'next';

export function withSerializedProps<P extends Record<string, any>>(
  gssp: (ctx: GetServerSidePropsContext) => Promise<GetServerSidePropsResult<P>>,
  options?: SerializeOptions
): GetServerSideProps<P> {
  return async (ctx) => {
    const res = await gssp(ctx);
    if ('props' in res) {
      return {
        ...res,
        props: serializeProps(res.props, options),
      };
    }
    return res;
  };
}

/**
 * Optional: client-side helper to revive ISO strings back to Date instances.
 * Only use if you truly need Date objects on the client.
 */
const ISO_DATE_RX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export function reviveDates<T>(data: T): T {
  const walk = (v: any): any => {
    if (v == null) return v;
    if (typeof v === 'string' && ISO_DATE_RX.test(v)) {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? v : d;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (isPlainObject(v)) {
      const out: Record<string, any> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(data) as T;
}
