import * as React from 'react';

export default function FlagWave({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 -z-10 overflow-hidden ${className}`}
    >
      {/* moving diagonal flag bands */}
      <div
        className="absolute -inset-20 opacity-35"
        style={{
          background:
            'repeating-linear-gradient(135deg, #111 0 80px, #fff 80px 160px, #007A3D 160px 240px, #DA291C 240px 320px)',
          backgroundSize: '320px 320px',
          animation: 'flagShift 18s linear infinite',
          filter: 'saturate(1.1)',
          maskImage:
            'radial-gradient(1200px 600px at 50% 100%, black, transparent 70%)',
          WebkitMaskImage:
            'radial-gradient(1200px 600px at 50% 100%, black, transparent 70%)',
        }}
      />
      <style jsx>{`
        @keyframes flagShift {
          from { background-position: 0 0; }
          to { background-position: 640px 0; }
        }
      `}</style>
    </div>
  );
}
