import type { Metadata } from 'next';
import { ClientBooking } from './ClientBooking';

export const metadata: Metadata = {
  title: 'Client Booking',
  robots: { index: false },
};

export default function ClientsPage() {
  return (
    <div className="section-padding">
      <div className="container-content">
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-4">
          Book a Meeting
        </h1>
        <p className="text-lg text-text-secondary mb-10">
          Select a meeting type below to schedule time with Alpine Tax.
        </p>

        <ClientBooking />
      </div>
    </div>
  );
}
