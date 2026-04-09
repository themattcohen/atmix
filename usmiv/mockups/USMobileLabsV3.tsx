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
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const NAV_LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Areas', href: '#areas' },
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
    try { return sessionStorage.getItem('usml-v3-unlocked') === '1'; } catch { return false; }
  });
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.toLowerCase().trim() === 'david') {
      setUnlocked(true);
      try { sessionStorage.setItem('usml-v3-unlocked', '1'); } catch { /* noop */ }
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-iv-light px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm text-center">
        <h1 className="mb-2 font-opensans text-2xl font-bold text-audit-navy">U.S. Mobile Labs</h1>
        <p className="mb-8 font-opensans text-sm text-[#081E2B]/60">Website concept -- Version 3. Enter the password to continue.</p>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Password"
          autoFocus
          className={`w-full rounded-[10px] border bg-white px-4 py-3 text-center font-opensans text-[#081E2B] placeholder-gray-400 outline-none transition-colors ${
            error ? 'border-red-500' : 'border-iv-border focus:border-audit-iv'
          }`}
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-[10px] bg-[#C17B3A] px-6 py-3 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
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
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="flex w-full items-center justify-between py-4 text-left"
        aria-expanded={isOpen}
      >
        <span className="font-opensans text-[17.6px] font-bold text-[#081E2B] pr-4">{question}</span>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center font-opensans text-xl font-light text-audit-navy transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
          aria-hidden="true"
        >
          +
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <p className="pb-4 font-opensans text-[17.6px] leading-relaxed text-[#081E2B]/70">{answer}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Amber checkmark icon (v3 uses amber instead of teal for checkmarks)
// ---------------------------------------------------------------------------
function AmberCheck() {
  return (
    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C17B3A]" aria-hidden="true">
      <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function USMobileLabsV3() {
  return (
    <PasswordGate>
      <div className="min-h-screen bg-white font-opensans text-[#081E2B] antialiased">
        <Navigation />
        <HeroSection />
        <DarkSection />
        <HowItWorksSection />
        <ServiceCardsSection />
        <PhlebotomyServicesSection />
        <FAQSection />
        <FooterSection />
      </div>
    </PasswordGate>
  );
}

// ===========================================================================
// Navigation (sticky, white bg, amber BOOK TODAY button)
// ===========================================================================
function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${scrolled ? 'shadow-sm' : ''} border-b border-gray-200`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo -- amber bar accent instead of teal */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-sm bg-[#C17B3A]" aria-hidden="true" />
            <span className="font-opensans text-lg font-bold tracking-wide text-[#081E2B]">
              U.S. MOBILE LABS
            </span>
          </div>
          <span className="ml-3 font-opensans text-[11px] italic text-gray-400">
            - We come to you! -
          </span>
        </div>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-opensans text-[15px] text-[#081E2B] transition-colors hover:text-audit-navy"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Book Today button -- amber bg instead of navy */}
        <a
          href="#pricing"
          className="hidden rounded-[10px] bg-[#C17B3A] px-5 py-2.5 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90 md:inline-block"
        >
          BOOK TODAY
        </a>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center md:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <div className="space-y-1.5">
            <span className={`block h-0.5 w-6 bg-[#081E2B] transition-transform duration-300 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-6 bg-[#081E2B] transition-opacity duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-6 bg-[#081E2B] transition-transform duration-300 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-200 bg-white px-6 py-4 md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block py-2 font-opensans text-[15px] text-[#081E2B]"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#pricing"
            onClick={() => setMobileOpen(false)}
            className="mt-3 block rounded-[10px] bg-[#C17B3A] px-5 py-2.5 text-center font-montserrat text-sm font-semibold text-white"
          >
            BOOK TODAY
          </a>
        </div>
      )}
    </nav>
  );
}

// ===========================================================================
// Hero Section (white bg, two columns, mixed teal+amber circles, amber blob)
// ===========================================================================
function HeroSection() {
  return (
    <section className="bg-white px-6 py-16 md:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        {/* Left column */}
        <div>
          <Reveal>
            <h1 className="font-opensans text-[40px] font-bold leading-tight text-audit-navy">
              Mobile Blood Draws and Lab Services When You Need Them In Colorado
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-6 font-opensans text-[17.6px] leading-relaxed text-[#081E2B]">
              From the team behind U.S. Mobile IV, our licensed phlebotomists come to your home, office, or facility. No waiting rooms. No trip fee. Results sent directly to your provider.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#services"
                className="rounded-[10px] bg-audit-iv px-5 py-2.5 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                All Services
              </a>
              <a
                href="#pricing"
                className="rounded-[10px] bg-[#C17B3A] px-5 py-2.5 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Request Service
              </a>
            </div>
          </Reveal>
        </div>

        {/* Right column -- circles with mixed teal+amber borders, amber-tinted blob behind */}
        <Reveal delay={200}>
          <div className="relative flex items-center justify-center py-8">
            {/* Amber-tinted abstract blob behind circles */}
            <div
              className="absolute inset-0 m-auto h-56 w-56 rounded-full bg-[#C17B3A]/8 blur-2xl"
              aria-hidden="true"
            />

            {/* Large circle -- teal border (family color) */}
            <div className="relative flex h-52 w-52 items-center justify-center rounded-full border-4 border-audit-iv bg-iv-light">
              <svg className="h-16 w-16 text-audit-iv" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            {/* Top-right small circle -- teal border */}
            <div className="absolute -top-2 right-8 flex h-24 w-24 items-center justify-center rounded-full border-4 border-audit-iv bg-iv-light md:right-4">
              <svg className="h-8 w-8 text-audit-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            {/* Bottom-right small circle -- amber border (v3 differentiation) */}
            <div className="absolute -bottom-2 right-12 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#C17B3A] bg-[#C17B3A]/5 md:right-8">
              <svg className="h-7 w-7 text-[#C17B3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>

            {/* Floating feature badges -- amber, teal, navy backgrounds */}
            <div className="absolute -left-4 top-4 rounded-[10px] bg-[#C17B3A] px-3 py-2 font-opensans text-xs font-semibold text-white shadow-sm md:left-0">
              Licensed Phlebotomists
            </div>
            <div className="absolute -left-2 bottom-8 rounded-[10px] bg-audit-iv px-3 py-2 font-opensans text-xs font-semibold text-white shadow-sm md:left-2">
              Same-Day, No Trip Fee
            </div>
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 rounded-[10px] bg-audit-navy px-3 py-2 font-opensans text-xs font-semibold text-white shadow-sm md:right-0">
              All Major Labs
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ===========================================================================
// Dark Section (full-width dark bg, two columns, amber checkmarks)
// ===========================================================================
function DarkSection() {
  return (
    <section className="bg-audit-dark px-6 py-16">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
        {/* Left -- heading and body */}
        <Reveal>
          <div>
            <h2 className="font-opensans text-[30.5px] font-bold leading-snug text-white">
              Professional Mobile Lab Draws Designed for Your Convenience
            </h2>
            <p className="mt-6 font-opensans text-[17.6px] leading-relaxed text-white/70">
              Whether you need routine bloodwork, fasting panels, or specialty collections, our team handles it all. We bring the lab to your door so you can focus on what matters -- your health.
            </p>
          </div>
        </Reveal>

        {/* Right -- amber checkmark bullets */}
        <Reveal delay={150}>
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <AmberCheck />
              <p className="font-opensans text-[17.6px] leading-relaxed text-white">
                Skip the waiting room with blood draws at your door
              </p>
            </div>
            <div className="flex items-start gap-4">
              <AmberCheck />
              <p className="font-opensans text-[17.6px] leading-relaxed text-white">
                Licensed phlebotomists collect specimens in under 10 minutes
              </p>
            </div>
            <div className="flex items-start gap-4">
              <AmberCheck />
              <p className="font-opensans text-[17.6px] leading-relaxed text-white">
                All major labs accepted -- Quest, Labcorp, Sonic, and more
              </p>
            </div>
            <div className="flex items-start gap-4">
              <AmberCheck />
              <p className="font-opensans text-[17.6px] leading-relaxed text-white">
                Same-day scheduling with early morning and evening availability
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ===========================================================================
// How It Works (light blue bg, 3 white cards, amber step circles)
// ===========================================================================
function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-iv-light px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="mb-12 text-center font-opensans text-[30.5px] font-bold text-audit-navy">
            How Mobile Lab Draws Work
          </h2>
        </Reveal>

        <div className="grid gap-8 md:grid-cols-3">
          <Reveal delay={0}>
            <div className="rounded-[10px] border border-iv-border bg-white p-6 text-center">
              {/* Amber step circle instead of teal */}
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#C17B3A]/10">
                <svg className="h-7 w-7 text-[#C17B3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <h3 className="mb-2 font-opensans text-lg font-bold text-audit-navy">Book Your Appointment</h3>
              <p className="font-opensans text-[15px] leading-relaxed text-[#081E2B]/70">
                Schedule online or by phone. Choose your date, time, and location. Same-day appointments often available.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="rounded-[10px] border border-iv-border bg-white p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#C17B3A]/10">
                <svg className="h-7 w-7 text-[#C17B3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
              </div>
              <h3 className="mb-2 font-opensans text-lg font-bold text-audit-navy">We Come to You</h3>
              <p className="font-opensans text-[15px] leading-relaxed text-[#081E2B]/70">
                A licensed phlebotomist arrives at your home, office, or facility with all supplies and equipment needed.
              </p>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="rounded-[10px] border border-iv-border bg-white p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#C17B3A]/10">
                <svg className="h-7 w-7 text-[#C17B3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              </div>
              <h3 className="mb-2 font-opensans text-lg font-bold text-audit-navy">Fast Results</h3>
              <p className="font-opensans text-[15px] leading-relaxed text-[#081E2B]/70">
                Specimens are couriered to your lab the same day. Results typically delivered to your provider within 24-48 hours.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// Service Cards (dark navy cards, amber bottom accent bar, amber pricing)
// ===========================================================================
function ServiceCardsSection() {
  return (
    <section id="pricing" className="bg-white px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="mb-12 text-center font-opensans text-[30.5px] font-bold text-audit-navy">
            Our Mobile Lab Draw Services
          </h2>
        </Reveal>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Card 1: Standard Draw */}
          <Reveal delay={0}>
            <div className="relative flex h-full flex-col overflow-hidden rounded-[10px] bg-audit-dark p-6 text-center text-white">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <svg className="h-8 w-8 text-audit-iv" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <h3 className="mb-1 font-opensans text-xl font-bold text-white">Standard Draw</h3>
              <p className="mb-2 font-opensans text-2xl font-bold text-[#C17B3A]">$99</p>
              <p className="mb-6 flex-1 font-opensans text-[15px] leading-relaxed text-white/70">
                Routine labs, CBC, CMP, lipid panels. Single patient, single lab order with same-day delivery.
              </p>
              <a
                href="#pricing"
                className="mt-auto rounded-[10px] bg-audit-iv px-4 py-2 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                VIEW DETAILS
              </a>
              {/* Amber accent bar at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#C17B3A]" aria-hidden="true" />
            </div>
          </Reveal>

          {/* Card 2: Comprehensive Panel -- highlighted with amber ring */}
          <Reveal delay={100}>
            <div className="relative flex h-full flex-col overflow-hidden rounded-[10px] border-2 border-[#C17B3A] bg-audit-dark p-6 text-center text-white">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <svg className="h-8 w-8 text-audit-iv" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
              </div>
              <h3 className="mb-1 font-opensans text-xl font-bold text-white">Comprehensive Panel</h3>
              <p className="mb-2 font-opensans text-2xl font-bold text-[#C17B3A]">$149</p>
              <p className="mb-6 flex-1 font-opensans text-[15px] leading-relaxed text-white/70">
                Multiple tests, priority scheduling. Up to 3 lab orders with fasting-friendly early morning slots.
              </p>
              <a
                href="#pricing"
                className="mt-auto rounded-[10px] bg-audit-iv px-4 py-2 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                VIEW DETAILS
              </a>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#C17B3A]" aria-hidden="true" />
            </div>
          </Reveal>

          {/* Card 3: Executive Screening */}
          <Reveal delay={200}>
            <div className="relative flex h-full flex-col overflow-hidden rounded-[10px] bg-audit-dark p-6 text-center text-white">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <svg className="h-8 w-8 text-audit-iv" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </div>
              <h3 className="mb-1 font-opensans text-xl font-bold text-white">Executive Screening</h3>
              <p className="mb-2 font-opensans text-2xl font-bold text-[#C17B3A]">$199</p>
              <p className="mb-6 flex-1 font-opensans text-[15px] leading-relaxed text-white/70">
                Full workup, specialty protocols. Unlimited lab orders with extended appointment time and dedicated coordinator.
              </p>
              <a
                href="#pricing"
                className="mt-auto rounded-[10px] bg-audit-iv px-4 py-2 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                VIEW DETAILS
              </a>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#C17B3A]" aria-hidden="true" />
            </div>
          </Reveal>
        </div>

        {/* View All Services button -- amber */}
        <Reveal delay={300}>
          <div className="mt-10 text-center">
            <a
              href="#services"
              className="inline-block rounded-[10px] bg-[#C17B3A] px-6 py-3 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              VIEW ALL SERVICES
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ===========================================================================
// Phlebotomy Services (text + image layout, amber dot bullets, amber circle)
// ===========================================================================
function PhlebotomyServicesSection() {
  return (
    <section id="services" className="bg-white px-6 py-16">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        {/* Left -- text content with amber dot bullets */}
        <Reveal>
          <div>
            <h2 className="font-opensans text-[30.5px] font-bold text-audit-navy">
              Our Phlebotomy Services
            </h2>
            <p className="mt-4 font-opensans text-[17.6px] leading-relaxed text-[#081E2B]">
              U.S. Mobile Labs provides comprehensive mobile phlebotomy for individuals, families, physician practices, and businesses across the Denver metro area. Every draw is performed by a nationally certified, licensed phlebotomist.
            </p>
            <ul className="mt-6 space-y-3" role="list">
              <li className="flex items-start gap-3">
                <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C17B3A]" aria-hidden="true" />
                <span className="font-opensans text-[17.6px] text-[#081E2B]">Mobile Blood Draws (routine and specialty)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C17B3A]" aria-hidden="true" />
                <span className="font-opensans text-[17.6px] text-[#081E2B]">DOT and Non-DOT Drug Testing</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C17B3A]" aria-hidden="true" />
                <span className="font-opensans text-[17.6px] text-[#081E2B]">Corporate Wellness and Biometric Screenings</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C17B3A]" aria-hidden="true" />
                <span className="font-opensans text-[17.6px] text-[#081E2B]">Genetic Testing Kit Collection</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C17B3A]" aria-hidden="true" />
                <span className="font-opensans text-[17.6px] text-[#081E2B]">Pediatric Blood Draws</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C17B3A]" aria-hidden="true" />
                <span className="font-opensans text-[17.6px] text-[#081E2B]">Timed and Fasting Specimen Collection</span>
              </li>
            </ul>
          </div>
        </Reveal>

        {/* Right -- amber-bordered circle with lab icon */}
        <Reveal delay={150}>
          <div className="flex items-center justify-center">
            <div className="flex h-64 w-64 items-center justify-center rounded-full border-4 border-[#C17B3A] bg-[#C17B3A]/5">
              <svg className="h-20 w-20 text-[#C17B3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ===========================================================================
// FAQ Section (two columns -- accordion left, CTA card right with amber top border)
// ===========================================================================
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-white px-6 py-16">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.2fr_0.8fr]">
        {/* Left -- FAQ accordion */}
        <div>
          <Reveal>
            <h2 className="mb-8 font-opensans text-[30.5px] font-bold text-audit-navy">
              Common Questions About Mobile Lab Draws
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div>
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
        </div>

        {/* Right -- CTA card with amber top border accent */}
        <Reveal delay={200}>
          <div className="flex flex-col items-center justify-center overflow-hidden rounded-[10px] border-t-4 border-[#C17B3A] bg-iv-light p-8 text-center">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-5 w-1 rounded-sm bg-[#C17B3A]" aria-hidden="true" />
              <span className="font-opensans text-lg font-bold text-[#081E2B]">U.S. MOBILE LABS</span>
            </div>
            <p className="mb-6 font-opensans text-[17.6px] font-semibold text-audit-navy">
              Not sure which service you need?
            </p>
            <p className="mb-6 font-opensans text-[15px] leading-relaxed text-[#081E2B]/70">
              Our team can help you understand your lab order and find the right mobile draw package for your needs.
            </p>
            <a
              href="#pricing"
              className="rounded-[10px] bg-[#C17B3A] px-5 py-2.5 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              CONTACT US
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ===========================================================================
// Footer (light blue bg, 4-column grid, amber HSA badge, dark bottom bar)
// ===========================================================================
function FooterSection() {
  return (
    <footer>
      {/* Main footer */}
      <div className="bg-iv-light px-6 py-12" id="areas">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
          {/* Col 1: Logo + tagline + HSA badge (amber bg) */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-5 w-1 rounded-sm bg-[#C17B3A]" aria-hidden="true" />
              <span className="font-opensans text-lg font-bold text-[#081E2B]">U.S. MOBILE LABS</span>
            </div>
            <p className="mb-4 font-opensans text-[15px] font-semibold leading-relaxed text-[#081E2B]">
              Professional mobile phlebotomy services for the Denver metro area. Licensed, insured, and HIPAA compliant.
            </p>
            <span className="inline-flex items-center gap-2 rounded-[10px] bg-[#C17B3A] px-4 py-2 font-montserrat text-sm font-bold text-white">
              <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              HSA ACCEPTED
            </span>
          </div>

          {/* Col 2: Services */}
          <div>
            <h4 className="mb-3 font-opensans text-[15px] font-bold text-[#081E2B]">Services</h4>
            <ul className="space-y-2 font-opensans text-[15px] text-[#081E2B]/70" role="list">
              <li><a href="#services" className="transition-colors hover:text-audit-navy">Mobile Blood Draws</a></li>
              <li><a href="#services" className="transition-colors hover:text-audit-navy">Specialty Testing</a></li>
              <li><a href="#services" className="transition-colors hover:text-audit-navy">Corporate Wellness</a></li>
              <li><a href="#services" className="transition-colors hover:text-audit-navy">Drug Testing</a></li>
            </ul>
          </div>

          {/* Col 3: Quick Links */}
          <div>
            <h4 className="mb-3 font-opensans text-[15px] font-bold text-[#081E2B]">Quick Links</h4>
            <ul className="space-y-2 font-opensans text-[15px] text-[#081E2B]/70" role="list">
              <li><a href="#" className="transition-colors hover:text-audit-navy">About Us</a></li>
              <li><a href="#" className="transition-colors hover:text-audit-navy">Blog</a></li>
              <li><a href="#pricing" className="transition-colors hover:text-audit-navy">Book Online</a></li>
              <li><a href="#areas" className="transition-colors hover:text-audit-navy">Service Areas</a></li>
              <li><a href="#faq" className="transition-colors hover:text-audit-navy">Contact</a></li>
            </ul>
          </div>

          {/* Col 4: Contact */}
          <div>
            <h4 className="mb-3 font-opensans text-[15px] font-bold text-[#081E2B]">Contact</h4>
            <ul className="space-y-2 font-opensans text-[15px] text-[#081E2B]/70" role="list">
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-audit-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                (720) 508-1998
              </li>
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-audit-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                Colorado, USA
              </li>
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-audit-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                7AM - 7PM Mon-Sat
              </li>
            </ul>
            {/* Social placeholder icons */}
            <div className="mt-4 flex gap-3">
              <a href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-audit-navy/10 text-audit-navy transition-colors hover:bg-audit-navy hover:text-white" aria-label="Facebook">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
              <a href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-audit-navy/10 text-audit-navy transition-colors hover:bg-audit-navy hover:text-white" aria-label="Instagram">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
              </a>
              <a href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-audit-navy/10 text-audit-navy transition-colors hover:bg-audit-navy hover:text-white" aria-label="Google">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" /></svg>
              </a>
            </div>
          </div>
        </div>

        {/* Affiliated with line */}
        <div className="mx-auto mt-8 max-w-6xl text-center">
          <p className="font-opensans text-sm text-[#081E2B]/50">
            Affiliated with U.S. Mobile IV
          </p>
        </div>
      </div>

      {/* Dark bottom bar */}
      <div className="bg-gradient-to-r from-audit-navy to-audit-dark px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 md:flex-row md:justify-between">
          <p className="font-opensans text-sm text-white/70">
            Copyright 2026 USMM LLC
          </p>
          <div className="flex flex-wrap justify-center gap-4 font-opensans text-sm text-white/70">
            <a href="#" className="transition-colors hover:text-white">Privacy Policy</a>
            <a href="#" className="transition-colors hover:text-white">Disclaimer</a>
            <a href="#" className="transition-colors hover:text-white">Terms of Use</a>
          </div>
        </div>
        <div className="mx-auto mt-3 max-w-6xl">
          <p className="text-center font-opensans text-xs italic text-white/40">
            The information provided on this website is for general informational purposes only and does not constitute medical advice. Mobile phlebotomy services require a valid physician order. U.S. Mobile Labs does not diagnose, treat, or interpret lab results. Always consult your healthcare provider regarding medical decisions.
          </p>
        </div>
      </div>
    </footer>
  );
}
