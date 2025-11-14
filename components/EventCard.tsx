// components/EventCard.tsx

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { EventItem } from '../types';

interface EventCardProps {
  event: EventItem;
  /** If provided, replaces the default details link */
  rsvpUrl?: string;
  /** Optional callback instead of links */
  onViewDetails?: () => void;
  /** Allow parent to inject layout classes (e.g., h-full) */
  className?: string;
}

/**
 * Formats a start/end ISO string into a human-friendly range.
 * Same-day events show date once and time range; multi-day show full start → end.
 */
function formatDateRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const dateOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    const dateStr = start.toLocaleDateString('en-GB', dateOptions);
    const timeStr = `${start.toLocaleTimeString('en-GB', timeOptions)} - ${end
      .toLocaleTimeString('en-GB', timeOptions)
      .replace(/^0/, '')}`;
    return (
      <div className="space-y-1">
        <div className="font-medium">{dateStr}</div>
        <div className="text-sm text-palestine-muted">{timeStr}</div>
      </div>
    );
  } else {
    const startStr = `${start.toLocaleDateString('en-GB', dateOptions)} ${start.toLocaleTimeString(
      'en-GB',
      timeOptions
    )}`;
    const endStr = `${end.toLocaleDateString('en-GB', dateOptions)} ${end.toLocaleTimeString(
      'en-GB',
      timeOptions
    )}`;
    return (
      <div className="space-y-1">
        <div className="font-medium">{startStr}</div>
        <div className="text-sm text-palestine-muted">to {endStr}</div>
      </div>
    );
  }
}

export default function EventCard({ event, rsvpUrl, onViewDetails, className }: EventCardProps) {
  const now = new Date();
  const ends = new Date(event.endTime);
  const isPast = ends.getTime() < now.getTime();

  // allow optional videoUrl without changing the global EventItem type
  const videoUrl = (event as unknown)?.videoUrl as string | undefined;

  return (
    <div
      className={`card group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-black/5 ${className ?? ''}`}
      aria-label={`Event: ${event.title}`}
    >
      <div className="relative overflow-hidden">
        {videoUrl ? (
          <div className="relative w-full aspect-[16/9]">
            <video
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              muted
              loop
              autoPlay
              playsInline
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        ) : event.imageUrl ? (
          <div className="relative w-full aspect-[16/9]">
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              priority={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        ) : (
          <div className="relative w-full aspect-[16/9] flex items-center justify-center bg-palestine-green/10">
            <div className="text-center px-4">
              <div className="text-xl font-bold text-palestine-dark">{event.title}</div>
              <div className="mt-1 text-sm text-palestine-muted">No media provided</div>
            </div>
          </div>
        )}
        <div className="absolute top-4 left-4 flex gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              isPast ? 'bg-gray-200 text-gray-600' : 'bg-palestine-green text-white'
            }`}
          >
            {isPast ? 'Past' : 'Upcoming'}
          </span>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-xl font-bold leading-snug">{event.title}</h3>

        <div className="mt-2">{formatDateRange(event.startTime, event.endTime)}</div>

        {event.location && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 11c1.656 0 3-1.344 3-3S13.656 5 12 5 9 6.344 9 8s1.344 3 3 3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21s7-4.5 7-10.5S13.657 3 12 3 5 6 5 10.5 12 21 12 21z"
              />
            </svg>
            <span>{event.location}</span>
          </div>
        )}

        {event.description && (
          <p className="mt-4 text-sm text-gray-600 line-clamp-3">{event.description}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          {rsvpUrl ? (
            <Link href={rsvpUrl} legacyBehavior>
              <a
                className="inline-flex items-center text-sm font-medium px-4 py-2 bg-palestine-red text-white rounded-xl hover:brightness-105 transition"
                aria-label={`RSVP for ${event.title}`}
              >
                RSVP
              </a>
            </Link>
          ) : onViewDetails ? (
            <button
              onClick={onViewDetails}
              className="text-sm font-medium px-4 py-2 bg-palestine-green text-white rounded-xl hover:brightness-105 transition"
              aria-label={`View details for ${event.title}`}
            >
              View details
            </button>
          ) : (
            <Link href={`/events/${event.id}`} legacyBehavior>
              <a
                className="text-sm font-medium px-4 py-2 bg-palestine-green text-white rounded-xl hover:brightness-105 transition"
                aria-label={`View details for ${event.title}`}
              >
                View details
              </a>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
