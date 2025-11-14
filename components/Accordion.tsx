// components/Accordion.tsx
import React, { useState, ReactNode, KeyboardEvent } from 'react';

export interface AccordionItem {
  title: string;
  children: ReactNode;
  /** Optional unique key; if omitted, title is used (assumed unique) */
  key?: string;
}

interface AccordionProps {
  items: AccordionItem[];
  /** If true, allows multiple panels open; otherwise only one at a time */
  multiple?: boolean;
  /** Controlled open indices (0-based) */
  defaultOpenIndices?: number[];
}

export default function Accordion({
  items,
  multiple = false,
  defaultOpenIndices = [],
}: AccordionProps) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(
    () => new Set(defaultOpenIndices)
  );

  const toggle = (index: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        if (!multiple) next.clear();
        next.add(index);
      }
      return next;
    });
  };

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    const last = items.length - 1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = index === last ? 0 : index + 1;
      document.getElementById(`accordion-btn-${next}`)?.focus();
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = index === 0 ? last : index - 1;
      document.getElementById(`accordion-btn-${prev}`)?.focus();
    }
    if (e.key === 'Home') {
      e.preventDefault();
      document.getElementById(`accordion-btn-0`)?.focus();
    }
    if (e.key === 'End') {
      e.preventDefault();
      document.getElementById(`accordion-btn-${last}`)?.focus();
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      toggle(index);
    }
  };

  return (
    <div className="w-full space-y-4">
      {items.map((item, idx) => {
        const isOpen = openIndices.has(idx);
        const id = (item.key || item.title).replace(/\s+/g, '-');
        const panelId = `accordion-panel-${id}-${idx}`;
        const buttonId = `accordion-btn-${idx}`;

        return (
          <div
            key={item.key || idx}
            className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
          >
            <h3 className="m-0">
              <button
                id={buttonId}
                aria-controls={panelId}
                aria-expanded={isOpen}
                onClick={() => toggle(idx)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className="w-full flex justify-between items-center px-5 py-4 text-left bg-white hover:bg-palestine-light/30 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-palestine-accent font-medium"
              >
                <span>{item.title}</span>
                <span
                  aria-hidden="true"
                  className={`ml-4 flex-shrink-0 transition-transform duration-300 ${
                    isOpen ? 'rotate-180' : 'rotate-0'
                  }`}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`px-5 pt-0 overflow-hidden transition-[max-height] duration-300 bg-white ${
                isOpen ? 'pb-5' : 'max-h-0 pb-0'
              }`}
              style={{
                maxHeight: isOpen ? undefined : 0,
              }}
            >
              <div className="pt-4 text-sm text-gray-700">{item.children}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
