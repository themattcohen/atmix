import { useState, useEffect, useRef, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Scroll-reveal hook (IntersectionObserver, fires once)
// ---------------------------------------------------------------------------
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

// ---------------------------------------------------------------------------
// Reveal wrapper component
// ---------------------------------------------------------------------------
function Reveal({
  children,
  className = '',
  animation = 'fade-in',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  animation?: 'fade-in' | 'slide-in-left' | 'slide-in-right' | 'scale-in';
  delay?: number;
}) {
  const { ref, isVisible } = useScrollReveal();

  const base: Record<string, string> = {
    'fade-in': 'translate-y-8 opacity-0',
    'slide-in-left': '-translate-x-10 opacity-0',
    'slide-in-right': 'translate-x-10 opacity-0',
    'scale-in': 'scale-95 opacity-0',
  };
  const visible = 'translate-y-0 translate-x-0 scale-100 opacity-100';

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${isVisible ? visible : base[animation]} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper for consistent padding
// ---------------------------------------------------------------------------
function Section({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`px-6 py-20 md:py-28 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const SERVICES = [
  {
    title: 'Mobile Blood Draws',
    description: 'Routine and specialty lab draws at your home, office, or facility. We work with all major laboratories.',
    features: ['Routine CBC, CMP, Lipid Panels', 'Thyroid & Hormone Panels', 'Glucose Tolerance Tests', 'Pediatric Draws Available'],
    headerColor: 'bg-audit-iv',
  },
  {
    title: 'Specialty Testing',
    description: 'Advanced diagnostics including timed specimens, chain of custody, and specialty collection protocols.',
    features: ['Timed & Fasting Specimens', 'DOT & Non-DOT Drug Testing', 'Genetic Testing Kit Collection', 'Allergy & Autoimmune Panels'],
    headerColor: 'bg-audit-navy',
  },
  {
    title: 'Corporate Wellness',
    description: 'On-site blood draws for annual physicals, biometric screenings, and wellness programs.',
    features: ['On-Site Biometric Screenings', 'Annual Physical Labs', 'Custom Wellness Panels', 'Flexible Group Scheduling'],
    headerColor: 'bg-labs-accent',
  },
];

const STEPS = [
  {
    phase: 1,
    title: 'Book Online',
    description: 'Choose your date, time, and location. Same-day appointments often available.',
  },
  {
    phase: 2,
    title: 'We Come to You',
    description: 'A licensed phlebotomist arrives at your door with everything needed.',
  },
  {
    phase: 3,
    title: 'Quick, Easy Draw',
    description: 'Professional specimen collection in under 10 minutes. Comfortable and calm.',
  },
  {
    phase: 4,
    title: 'Results to Your Doctor',
    description: 'Specimens couriered to your lab. Results typically within 24-48 hours.',
  },
];

const DIFFERENTIATORS = [
  { title: 'Licensed & Insured', description: 'Nationally certified, background-checked phlebotomists.' },
  { title: 'Same-Day Available', description: 'Book as little as 2 hours ahead. Early AM and evening slots.' },
  { title: 'All Major Labs', description: 'Quest, Labcorp, Sonic, and any physician-specified laboratory.' },
  { title: 'HIPAA Compliant', description: 'Enterprise-grade security for your medical information.' },
  { title: 'Transparent Pricing', description: 'No hidden fees. No insurance headaches. Clear pricing upfront.' },
  { title: '546+ Five-Star Reviews', description: 'Rated 5.0 on Google across our family of services.' },
];

const PRICING_TIERS = [
  {
    name: 'Standard Draw',
    price: 99,
    tagline: 'Single patient, single lab order',
    features: ['Mobile visit to your location', '1 lab order', 'Standard collection', 'Same-day lab delivery', 'Denver metro included'],
    highlighted: false,
  },
  {
    name: 'Comprehensive',
    price: 149,
    tagline: 'Multiple tests, priority scheduling',
    features: ['Everything in Standard', 'Up to 3 lab orders', 'Fasting-friendly scheduling', 'Priority morning slots', 'Direct results coordination'],
    highlighted: true,
  },
  {
    name: 'Executive Panel',
    price: 199,
    tagline: 'Full workup with premium service',
    features: ['Everything in Comprehensive', 'Unlimited lab orders', 'Specialty collection protocols', 'Extended appointment time', 'Dedicated coordinator'],
    highlighted: false,
  },
];

const CITIES = [
  'Denver', 'Aurora', 'Lakewood', 'Arvada', 'Westminster', 'Thornton',
  'Centennial', 'Highlands Ranch', 'Boulder', 'Broomfield', 'Littleton',
  'Castle Rock', 'Parker', 'Greenwood Village', 'Englewood', 'Golden',
  'Commerce City', 'Northglenn', 'Lone Tree', 'Cherry Hills Village',
];

const TESTIMONIALS = [
  {
    name: 'Sarah M.',
    location: 'Denver',
    quote: 'I have a terrible needle phobia and the phlebotomist was incredibly patient. Done in under five minutes at my kitchen table. I will never go back to a lab waiting room.',
  },
  {
    name: 'James R.',
    location: 'Aurora',
    quote: 'Booked at 7am, they were at my door by 9. Results to my doctor the next day. The convenience is unreal for someone with my schedule.',
  },
  {
    name: 'Dr. Lisa Chen',
    location: 'Greenwood Village',
    quote: 'We refer our elderly and mobility-limited patients to U.S. Mobile Labs. Professional, reliable, and they coordinate directly with our office.',
  },
];

const FAQ_ITEMS = [
  { question: "Do I need a doctor's order?", answer: "Yes, we require a lab requisition or doctor's order for all blood draws. If you don't have one, we can help connect you with a provider who can place one." },
  { question: 'Which labs do you work with?', answer: 'We work with all major reference laboratories including Quest Diagnostics, Labcorp, Sonic Healthcare, and any physician-specified lab.' },
  { question: 'How quickly can I get an appointment?', answer: 'Most appointments are available same-day. You can book as little as 2 hours in advance, with early morning and evening slots available.' },
  { question: 'What areas do you serve?', answer: 'We serve the entire Denver metro area and beyond -- over 20 communities from Boulder to Castle Rock, Lakewood to Aurora.' },
  { question: 'Is my information secure?', answer: 'Absolutely. We are fully HIPAA compliant. All patient data is encrypted and handled according to federal healthcare privacy standards.' },
  { question: 'How does billing work?', answer: 'Our mobile draw fee is a flat rate paid at booking. Laboratory processing is billed separately through your insurance by the lab, just like a traditional visit.' },
  { question: 'Do you draw blood from children?', answer: 'Yes. Our phlebotomists are experienced with pediatric draws. Many parents find children are significantly calmer at home than in a clinical setting.' },
];

// ---------------------------------------------------------------------------
// Password gate
// ---------------------------------------------------------------------------
function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => {
    try { return sessionStorage.getItem('usml-v2-unlocked') === '1'; } catch { return false; }
  });
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.toLowerCase().trim() === 'david') {
      setUnlocked(true);
      try { sessionStorage.setItem('usml-v2-unlocked', '1'); } catch { /* noop */ }
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-audit-dark px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">U.S. Mobile Labs</h1>
        <p className="mb-8 text-sm text-gray-400">Website preview. Enter the password to continue.</p>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Password"
          autoFocus
          className={`w-full rounded-lg border bg-white/5 px-4 py-3 text-center text-white placeholder-gray-500 outline-none transition-colors ${
            error ? 'border-red-500 shake' : 'border-white/20 focus:border-audit-iv'
          }`}
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-gradient-to-r from-audit-medics-dark to-audit-iv-dark px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          View Site
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ accordion row
// ---------------------------------------------------------------------------
function FAQRow({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="flex w-full items-center justify-between py-3 text-left hover:bg-gray-50 transition-colors rounded px-1 -mx-1"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-gray-700 pr-4">{question}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="rounded-lg bg-gray-50 px-3 py-3 mb-2">
            <p className="text-sm leading-relaxed text-gray-600">{answer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Star SVG (filled)
// ---------------------------------------------------------------------------
function StarIcon() {
  return (
    <svg className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function USMobileLabsV2() {
  return (
    <PasswordGate>
      <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">
        <BrandBar />
        <HeroSection />
        <IntroSection />
        <ServicesSection />
        <HowItWorksSection />
        <WhyUsSection />
        <PricingSection />
        <ServiceAreasSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
        <FooterSection />
      </div>
    </PasswordGate>
  );
}

// ===========================================================================
// Brand Bar
// ===========================================================================
function BrandBar() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-audit-dark/95 backdrop-blur-sm px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-white">U.S. Mobile Labs</span>
        <span className="text-xs text-gray-500">|</span>
        <span className="text-xs text-gray-400">A U.S. Mobile IV Company</span>
      </div>
      <a
        href="#pricing"
        className="rounded-full bg-labs-accent px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
      >
        Book a Draw
      </a>
    </nav>
  );
}

// ===========================================================================
// Section 1 -- Hero
// ===========================================================================
function HeroSection() {
  const [showChevron, setShowChevron] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowChevron(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-audit-dark px-6 text-center">
      {/* Split gradient glows -- left teal, right amber */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-full w-1/2 bg-gradient-to-br from-audit-iv/15 via-transparent to-transparent" />
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-bl from-labs-accent/15 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-3xl">
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
          Mobile Blood Draws. Done Right.
        </h1>
        <div className="mb-6 flex flex-col items-center">
          <p className="text-lg text-gray-300 sm:text-xl">U.S. Mobile Labs</p>
          <div className="mt-2 h-0.5 w-12 bg-audit-iv" aria-hidden="true" />
        </div>
        <p className="text-base text-gray-400">
          From the team behind U.S. Mobile IV. Licensed phlebotomists come to you -- anywhere in Denver metro.
        </p>
      </div>

      {/* Bouncing chevron */}
      <div
        className={`absolute bottom-10 transition-opacity duration-700 ${
          showChevron ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        <svg
          className="h-8 w-8 animate-bounce text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}

// ===========================================================================
// Section 2 -- Intro (matches IV.tsx DiscoverySection)
// ===========================================================================
function IntroSection() {
  return (
    <Section className="bg-audit-cream">
      <Reveal>
        <h2 className="mb-6 text-3xl font-bold text-audit-dark sm:text-4xl">
          Lab Draws, Reimagined
        </h2>
      </Reveal>
      <Reveal delay={100}>
        <p className="mb-12 max-w-3xl text-lg leading-relaxed text-gray-700">
          Lab waiting rooms are broken -- long waits, cold chairs, inconvenient hours. We
          bring the draw to you. Same licensed team, same quality standards, same company
          you already trust for mobile IV therapy.
        </p>
      </Reveal>

      {/* Entity diagram */}
      <Reveal animation="scale-in" delay={200}>
        <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr]">
          {/* IV box */}
          <div className="rounded-xl border-2 border-audit-iv/30 bg-white p-6 shadow-sm">
            <h3 className="mb-4 border-b-2 border-audit-iv pb-2 text-lg font-bold text-audit-iv-dark">
              U.S. Mobile IV
            </h3>
            <p className="mb-1 text-sm font-medium uppercase tracking-wide text-gray-500">What They Do</p>
            <ul className="space-y-1.5 text-sm text-gray-700" role="list">
              <li>IV hydration therapy</li>
              <li>Vitamin infusions</li>
              <li>NAD+ & weight loss</li>
              <li>546 Google reviews (5.0)</li>
            </ul>
          </div>

          {/* Shared center */}
          <div className="flex flex-col items-center justify-center">
            <div className="hidden w-px h-6 bg-gray-300 md:block" aria-hidden="true" />
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 text-center shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Shared
              </p>
              <ul className="space-y-1 text-sm text-gray-600" role="list">
                <li>USMM LLC</li>
                <li>Licensed Staff</li>
                <li>Brand Trust</li>
                <li>Denver Metro Coverage</li>
              </ul>
            </div>
            <div className="hidden w-px h-6 bg-gray-300 md:block" aria-hidden="true" />
          </div>

          {/* Labs box */}
          <div className="rounded-xl border-2 border-labs-accent/30 bg-white p-6 shadow-sm">
            <h3 className="mb-4 border-b-2 border-labs-accent pb-2 text-lg font-bold text-labs-accent-dark">
              U.S. Mobile Labs
            </h3>
            <p className="mb-1 text-sm font-medium uppercase tracking-wide text-gray-500">What We Do</p>
            <ul className="space-y-1.5 text-sm text-gray-700" role="list">
              <li>Mobile blood draws</li>
              <li>Specialty testing</li>
              <li>Corporate wellness</li>
              <li>All major laboratories</li>
            </ul>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

// ===========================================================================
// Section 3 -- Services
// ===========================================================================
function ServicesSection() {
  return (
    <Section className="bg-white">
      <Reveal>
        <h2 className="mb-10 text-3xl font-bold text-audit-dark sm:text-4xl">
          What We Offer
        </h2>
      </Reveal>

      <div className="grid gap-8 md:grid-cols-3">
        {SERVICES.map((service, i) => (
          <Reveal key={i} animation="scale-in" delay={i * 100}>
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 shadow-md">
              <div className={`${service.headerColor} px-6 py-4`}>
                <h3 className="text-lg font-bold text-white">{service.title}</h3>
              </div>
              <div className="flex flex-1 flex-col px-6 py-5">
                <p className="mb-4 text-sm leading-relaxed text-gray-600">{service.description}</p>
                <ul className="mt-auto space-y-2" role="list">
                  {service.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-audit-navy/40" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ===========================================================================
// Section 4 -- How It Works (matches IV.tsx RoadmapSection)
// ===========================================================================
function HowItWorksSection() {
  return (
    <Section className="bg-audit-cream">
      <Reveal>
        <h2 className="mb-12 text-3xl font-bold text-audit-dark sm:text-4xl">
          How It Works
        </h2>
      </Reveal>

      {/* Desktop: horizontal timeline */}
      <div className="hidden lg:block">
        <div className="relative">
          {/* Connector line */}
          <div
            className="absolute left-0 right-0 top-6 h-0.5 bg-gray-300"
            aria-hidden="true"
          />
          <div className="grid grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="relative">
                  {/* Circle node */}
                  <div
                    className="relative z-10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-audit-navy text-sm font-bold text-white shadow-md"
                    aria-hidden="true"
                  >
                    {step.phase}
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-1 text-base font-bold text-gray-900">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-gray-600">{step.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile / tablet: vertical timeline */}
      <div className="lg:hidden">
        <div className="relative border-l-2 border-gray-300 pl-8">
          {STEPS.map((step, i) => (
            <Reveal key={i} delay={i * 100}>
              <div className="relative mb-10 last:mb-0">
                {/* Circle node */}
                <div
                  className="absolute -left-[2.55rem] top-0 flex h-10 w-10 items-center justify-center rounded-full bg-audit-navy text-sm font-bold text-white shadow-md"
                  aria-hidden="true"
                >
                  {step.phase}
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-1 text-base font-bold text-gray-900">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{step.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ===========================================================================
// Section 5 -- Why Us (matches IV.tsx OpportunitiesSection)
// ===========================================================================
function WhyUsSection() {
  return (
    <Section className="bg-white">
      <Reveal>
        <h2 className="mb-2 text-3xl font-bold text-audit-dark sm:text-4xl">
          Why Denver Trusts Us
        </h2>
        <p className="mb-10 text-sm text-gray-500">
          Six reasons patients and providers choose U.S. Mobile Labs.
        </p>
      </Reveal>

      <div className="space-y-4">
        {DIFFERENTIATORS.map((item, i) => (
          <Reveal key={i} delay={i * 80}>
            <div className="flex gap-5 rounded-xl border border-gray-200 bg-gray-50 p-5 transition-shadow hover:shadow-md">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-audit-medics-dark to-audit-iv-dark text-sm font-bold text-white">
                {i + 1}
              </div>
              <div>
                <h3 className="mb-1 text-base font-bold text-gray-900">{item.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{item.description}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ===========================================================================
// Section 6 -- Pricing (dark section)
// ===========================================================================
function PricingSection() {
  return (
    <Section className="bg-audit-dark" id="pricing">
      <Reveal>
        <h2 className="mb-2 text-3xl font-bold text-white sm:text-4xl">
          Transparent Pricing
        </h2>
        <p className="mb-10 text-sm text-gray-400">
          Flat-rate mobile draw fee. Lab processing billed separately through your insurance.
        </p>
      </Reveal>

      <div className="grid gap-6 md:grid-cols-3">
        {PRICING_TIERS.map((tier, i) => (
          <Reveal key={i} animation="scale-in" delay={i * 100}>
            <div
              className={`flex h-full flex-col rounded-xl border p-6 ${
                tier.highlighted
                  ? 'border-labs-accent/50 bg-white/10 ring-2 ring-labs-accent'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              {tier.highlighted && (
                <span className="mb-3 inline-block self-start rounded-full bg-labs-accent px-3 py-0.5 text-xs font-semibold text-white">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-bold text-white">{tier.name}</h3>
              <p className="mb-4 text-xs text-gray-400">{tier.tagline}</p>
              <p className="mb-5 text-3xl font-bold text-white">
                ${tier.price}
              </p>
              <ul className="mt-auto space-y-2" role="list">
                {tier.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-audit-iv/60" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Corporate callout */}
      <Reveal delay={400}>
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5 text-center">
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-white">Corporate & group pricing available.</span>{' '}
            On-site draws for 10+ employees start at $79 per person.{' '}
            <a href="#contact" className="text-labs-accent-light underline underline-offset-2 hover:text-labs-accent">
              Contact us
            </a>
          </p>
        </div>
      </Reveal>
    </Section>
  );
}

// ===========================================================================
// Section 7 -- Service Areas
// ===========================================================================
function ServiceAreasSection() {
  return (
    <Section className="bg-white">
      <Reveal>
        <h2 className="mb-2 text-3xl font-bold text-audit-dark sm:text-4xl">
          Serving Greater Denver
        </h2>
        <p className="mb-10 text-sm text-gray-500">
          From Boulder to Castle Rock, Lakewood to Aurora -- we cover the entire metro.
        </p>
      </Reveal>

      <Reveal delay={100}>
        <div className="flex flex-wrap gap-3 justify-center">
          {CITIES.map((city) => (
            <span
              key={city}
              className="rounded-full border border-audit-iv/20 bg-audit-cream px-4 py-2 text-sm font-medium text-audit-navy transition-colors hover:bg-audit-iv hover:text-white"
            >
              {city}
            </span>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

// ===========================================================================
// Section 8 -- Testimonials
// ===========================================================================
function TestimonialsSection() {
  return (
    <Section className="bg-audit-cream">
      <Reveal>
        <h2 className="mb-10 text-3xl font-bold text-audit-dark sm:text-4xl">
          What Patients Say
        </h2>
      </Reveal>

      <div className="grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={i} animation="scale-in" delay={i * 100}>
            <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              {/* Stars */}
              <div className="mb-4 flex gap-0.5" aria-label="5 out of 5 stars">
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
              </div>
              <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-600 italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <p className="text-sm font-bold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">{t.location}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ===========================================================================
// Section 9 -- FAQ (matches IV.tsx accordion)
// ===========================================================================
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Section className="bg-gray-50">
      <Reveal>
        <h2 className="mb-10 text-3xl font-bold text-audit-dark sm:text-4xl">
          Common Questions
        </h2>
      </Reveal>

      <Reveal delay={100}>
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-gray-200 bg-white px-6 py-2 shadow-sm">
          {FAQ_ITEMS.map((item, i) => (
            <FAQRow
              key={i}
              question={item.question}
              answer={item.answer}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

// ===========================================================================
// Section 10a -- CTA
// ===========================================================================
function CTASection() {
  return (
    <section className="bg-gradient-to-r from-audit-medics-dark to-audit-iv-dark px-6 py-20 text-center md:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Ready to Skip the Lab?
          </h2>
          <p className="mb-8 text-lg text-white/80">
            Book a mobile blood draw in under 60 seconds.
          </p>
          <a
            href="#pricing"
            className="inline-block rounded-full bg-labs-accent px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
          >
            Book Your Draw
          </a>
          <p className="mt-6 text-sm text-white/60">
            Or call us: (720) 730-4998
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ===========================================================================
// Section 10b -- Footer
// ===========================================================================
function FooterSection() {
  return (
    <footer className="bg-audit-navy px-6 py-16 text-center">
      <p className="text-lg font-semibold text-white">U.S. Mobile Labs</p>
      <p className="mt-2 text-sm text-gray-300">
        A U.S. Mobile IV Company
      </p>
      <div className="mx-auto mt-6 max-w-sm space-y-1 text-xs text-gray-400">
        <p>(720) 730-4998</p>
        <p>info@usmobilelabs.com</p>
        <p>Mon - Sat, 7am - 7pm</p>
      </div>
      <p className="mt-8 text-sm text-gray-300">Website concept by Matt Cohen</p>
      <p className="mt-2 text-xs text-gray-400">atmix.org</p>
    </footer>
  );
}
