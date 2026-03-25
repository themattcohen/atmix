'use client';

import { useState } from 'react';
import { siteConfig } from '@/lib/site-config';
import { CalEmbed } from '../schedule/CalEmbed';

export function ClientBooking() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {siteConfig.clientEventTypes.map((event) => {
          const isSelected = selected === event.slug;
          return (
            <button
              key={event.slug}
              onClick={() => setSelected(isSelected ? null : event.slug)}
              className={`text-left bg-white rounded-lg border p-6 transition-all hover:shadow-md ${
                isSelected
                  ? 'border-alpine-teal ring-2 ring-alpine-teal'
                  : 'border-gray-200'
              }`}
            >
              <h2 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                {event.title}
              </h2>
              <div className="flex items-center gap-3 text-sm text-text-secondary mb-3">
                <span>{event.duration} min</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  event.location === 'Zoom'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {event.location === 'Zoom' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V16a2 2 0 0 1-2 2h-4" />
                      <rect x="1" y="8" width="14" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                  )}
                  {event.location}
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                {event.slug === 'tax-planning-meeting' && 'In-depth session to review your tax strategy and identify savings opportunities.'}
                {event.slug === 'tax-review-meeting' && 'Walk through your completed return and ask any questions before filing.'}
                {event.slug === 'phonecall' && 'Quick call for questions, updates, or follow-ups on your account.'}
              </p>
              <span className="btn-primary inline-block text-center w-full text-sm">
                {isSelected ? 'Selected' : 'Book Now'}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8"
          style={{ minHeight: 500 }}
        >
          <CalEmbed calLink={`alpinetax/${selected}`} />
        </div>
      )}
    </>
  );
}
