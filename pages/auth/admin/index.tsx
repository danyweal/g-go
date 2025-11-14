// app/auth/admin/page.tsx
'use client';

import Link from 'next/link';
import Head from 'next/head';
import useAdminGuard from '@/utils/useAdminGuard';

type CardProps = {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  aria?: string;
};

function DashCard({ href, title, desc, icon, aria }: CardProps) {
  return (
    <Link
      href={href}
      aria-label={aria || title}
      className="group relative block rounded-2xl p-[1px] bg-gradient-to-br from-palestine-green/30 via-emerald-400/20 to-palestine-red/30 hover:from-palestine-green/60 hover:to-palestine-red/60 transition-colors"
    >
      <div className="rounded-2xl bg-white/90 backdrop-blur-sm p-6 shadow-sm ring-1 ring-black/5 transition-all group-hover:shadow-xl group-hover:-translate-y-0.5">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-xl p-3 bg-gradient-to-br from-neutral-100 to-white ring-1 ring-black/5 shadow-sm group-hover:shadow-md">
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-neutral-600 leading-relaxed">{desc}</p>
          </div>
        </div>

        {/* bottom accent */}
        <div className="mt-4 h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
          <div className="h-full w-0 group-hover:w-full transition-all duration-500 bg-gradient-to-r from-palestine-green to-palestine-red" />
        </div>
      </div>
    </Link>
  );
}

function IconNews() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-palestine-green" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h7M7 12h10M7 16h6" />
    </svg>
  );
}
function IconEvents() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}
function IconGallery() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-neutral-700" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 16l5-5 4 4 3-3 4 4" />
      <circle cx="8" cy="9" r="1.5" />
    </svg>
  );
}
function IconDonations() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-palestine-red" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s-7-4.35-7-10.1A4.9 4.9 0 0 1 12 7a4.9 4.9 0 0 1 7 3.9C19 16.65 12 21 12 21Z" />
      <path d="M9.5 11.5h5" />
    </svg>
  );
}
function IconComments() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-neutral-700" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.3 0-2.5-.25-3.6-.71L3 21l1.21-5.8A8.5 8.5 0 1 1 21 12Z" />
      <path d="M8 12h8M8 8h8M8 16h5" />
    </svg>
  );
}
function IconJoin() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M20 8v3m-1.5-1.5H22" />
    </svg>
  );
}

/** NEW: Unified Directory (Stores + Services) icon */
function IconDirectory() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="1.8">
      {/* storefront */}
      <path d="M3 10l2-5h14l2 5" />
      <path d="M4 10h16v9H4z" />
      {/* wrench as overlay for services */}
      <path d="M14.5 6.5l3 3M17 5a2.5 2.5 0 0 1 2 4l-5 5-3 1 1-3 5-5Z" />
    </svg>
  );
}

export default function AdminDashboard() {
  const { ready } = useAdminGuard();
  if (!ready) return null;

  return (
    <>
      <Head><title>Admin Dashboard</title></Head>

      {/* Decorative background */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-palestine-green/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-palestine-red/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 via-palestine-green to-palestine-red">
                Admin Dashboard
              </span>
            </h1>
            <p className="mt-2 text-neutral-600">
              Manage News, Events, Gallery, Donations, Join applications and moderate Comments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* NEW: Unified Directory (Stores + Services) */}
            <DashCard
              href="/auth/admin/store"
              title="Directory (Stores & Services)"
              desc="Create & publish Stores and Services in one place. Multi-category, media, contact & delivery details."
              icon={<IconDirectory />}
            />

            <DashCard
              href="/auth/admin/news"
              title="News"
              desc="Create, edit, publish/unpublish, delete news posts."
              icon={<IconNews />}
            />
            <DashCard
              href="/auth/admin/events"
              title="Events"
              desc="Create, edit, publish/unpublish, delete events."
              icon={<IconEvents />}
            />
            <DashCard
              href="/auth/admin/gallery"
              title="Community activities"
              desc="Upload images/videos, manage visibility."
              icon={<IconGallery />}
            />
            <DashCard
              href="/auth/admin/donations"
              title="Donations"
              desc="Create campaigns, upload media, and record donations."
              icon={<IconDonations />}
            />
            {/* Join admin */}
            <DashCard
              href="/auth/admin/join"
              title="Join"
              desc="Review membership applications, verify payments, export CSV."
              icon={<IconJoin />}
            />
            <DashCard
              href="/auth/admin/comments"
              title="Comments"
              desc="Approve, reject and delete media comments."
              icon={<IconComments />}
            />
          </div>
        </div>
      </div>
    </>
  );
}
