'use client';

import Image from 'next/image';

export type TeamMember = {
  name: string;
  role: string;
  photo?: string; // path to image in /public/images/team/
  bio?: string;
  social?: { label: string; href: string }[];
};

export default function TeamMemberCard({ member }: { member: TeamMember }) {
  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden flex flex-col">
      <div className="relative">
        {member.photo ? (
          <Image
            src={member.photo}
            alt={member.name}
            width={400}
            height={192}
            className="w-full h-48 object-cover"
            style={{ objectFit: 'cover' }}
            priority={false}
          />
        ) : (
          <div className="w-full h-48 bg-palestine-light flex items-center justify-center">
            <div className="text-xl font-semibold text-palestine-muted">{member.name[0]}</div>
          </div>
        )}
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{member.name}</h3>
            <div className="text-sm text-palestine-muted">{member.role}</div>
          </div>
        </div>
        {member.bio && <p className="mt-3 text-sm text-gray-700 flex-grow">{member.bio}</p>}
        {member.social && (
          <div className="mt-4 flex gap-3">
            {member.social.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="text-sm underline hover:text-palestine-green"
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
