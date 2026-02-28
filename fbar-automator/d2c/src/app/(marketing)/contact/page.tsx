import type { Metadata } from "next";
import { Mail, Clock, CalendarDays, MessageSquare } from "lucide-react";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Reach FBAR Direct support for questions about foreign bank account reporting, filing help, billing, or technical issues. We respond within 1 business day.",
};

export default function ContactPage() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-doc mx-auto">
        {/* Page heading */}
        <div className="mb-12 text-center">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-gov-blue mb-3">
            Contact Us
          </h1>
          <p className="text-text-secondary max-w-xl mx-auto">
            Have a question about your FBAR filing? We&apos;re here to help.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Left column -- contact info cards */}
          <div className="lg:col-span-2 space-y-6">
            <InfoCard
              icon={<Mail className="h-5 w-5 text-gov-blue" aria-hidden="true" />}
              heading="Email"
            >
              <a
                href="mailto:support@fbardirect.com"
                className="text-gov-blue font-medium hover:underline"
              >
                support@fbardirect.com
              </a>
            </InfoCard>

            <InfoCard
              icon={<Clock className="h-5 w-5 text-gov-blue" aria-hidden="true" />}
              heading="Response Time"
            >
              <p className="text-text-secondary text-sm">Within 1 business day</p>
            </InfoCard>

            <InfoCard
              icon={<CalendarDays className="h-5 w-5 text-gov-blue" aria-hidden="true" />}
              heading="Hours"
            >
              <p className="text-text-secondary text-sm">
                Monday&ndash;Friday, 9 am&ndash;5 pm MT
              </p>
            </InfoCard>

            <InfoCard
              icon={<MessageSquare className="h-5 w-5 text-gov-blue" aria-hidden="true" />}
              heading="Urgent Filing Questions?"
            >
              <p className="text-text-secondary text-sm">
                For time-sensitive filing questions, try our AI assistant using
                the chat icon in the bottom-right corner of your screen.
              </p>
            </InfoCard>
          </div>

          {/* Right column -- contact form */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-border-gray p-6 md:p-8 rounded shadow-sm">
              <h2 className="font-heading text-xl font-bold text-gov-blue mb-6">
                Send Us a Message
              </h2>
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Info card sub-component ---------- */

function InfoCard({
  icon,
  heading,
  children,
}: {
  icon: React.ReactNode;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border-gray p-5 rounded shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <h3 className="font-semibold text-text-primary text-sm">{heading}</h3>
      </div>
      <div className="ml-8">{children}</div>
    </div>
  );
}
