import { useState, useEffect, useRef, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Scroll-reveal hook (IntersectionObserver, fires once, respects reduced motion)
// ---------------------------------------------------------------------------
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }
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
// Section wrapper
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
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------
function IconBloodDrop({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" />
    </svg>
  );
}

function IconTestTube({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 2v6l-5 10a2 2 0 0 0 1.8 2.8h12.4A2 2 0 0 0 20 18L15 8V2" />
      <path d="M9 2h6" />
      <path d="M6 15h12" />
    </svg>
  );
}

function IconBuilding({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22V12h6v10" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" />
    </svg>
  );
}

function IconCalendar({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconVan({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12h15V7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v5z" />
      <path d="M16 12h4l3 4v2h-7V12z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
      <path d="M8 18h8" />
    </svg>
  );
}

function IconVial({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 2v6.292a4 4 0 0 0-1.17 2.828L8 18a4 4 0 0 0 8 0l-.83-6.88A4 4 0 0 0 14 8.292V2" />
      <path d="M10 2h4" />
      <path d="M8.5 14h7" />
    </svg>
  );
}

function IconClipboardCheck({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M9 2h6v3H9z" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function IconShieldCheck({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconClock({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function IconFlask({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3h6M10 3v6.5L4 20a1 1 0 0 0 .87 1.5h14.26A1 1 0 0 0 20 20l-6-10.5V3" />
      <path d="M6.5 16h11" />
    </svg>
  );
}

function IconLock({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  );
}

function IconDollar({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9.354a3.5 3.5 0 0 0-2.5-1.104h-1A2.25 2.25 0 0 0 9.25 10.5a2.25 2.25 0 0 0 2.25 2.25h1A2.25 2.25 0 0 1 14.75 15a2.25 2.25 0 0 1-2.25 2.25h-1A3.5 3.5 0 0 1 9 16.146" />
      <path d="M12 6v2M12 16v2" />
    </svg>
  );
}

function IconStar({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function IconCheck({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconX({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IconChevronDown({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconPhone({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconMail({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 6L2 7" />
    </svg>
  );
}

function IconArrowRight({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Interfaces & Data
// ---------------------------------------------------------------------------
interface Service {
  title: string;
  description: string;
  features: string[];
  icon: ReactNode;
}

interface Step {
  title: string;
  description: string;
  icon: ReactNode;
}

interface Differentiator {
  title: string;
  description: string;
  icon: ReactNode;
}

interface PricingTier {
  name: string;
  price: number;
  tagline: string;
  features: string[];
  highlighted: boolean;
}

interface Testimonial {
  name: string;
  location: string;
  quote: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

const SERVICES: Service[] = [
  {
    title: 'Mobile Blood Draws',
    description: 'Routine and specialty lab draws at your home, office, or facility. We work with all major laboratories.',
    features: ['Routine CBC, CMP, Lipid Panels', 'Thyroid & Hormone Panels', 'Glucose Tolerance Tests', 'Pediatric Draws Available'],
    icon: <IconBloodDrop className="w-7 h-7 text-usml-navy" />,
  },
  {
    title: 'Specialty Testing',
    description: 'Advanced diagnostics including timed specimens, chain of custody, and specialty collection protocols.',
    features: ['Timed & Fasting Specimens', 'DOT & Non-DOT Drug Testing', 'Genetic Testing Kit Collection', 'Allergy & Autoimmune Panels'],
    icon: <IconTestTube className="w-7 h-7 text-usml-navy" />,
  },
  {
    title: 'Corporate Wellness',
    description: 'On-site blood draws for annual physicals, biometric screenings, and wellness programs.',
    features: ['On-Site Biometric Screenings', 'Annual Physical Labs', 'Custom Wellness Panels', 'Flexible Group Scheduling'],
    icon: <IconBuilding className="w-7 h-7 text-usml-navy" />,
  },
];

const STEPS: Step[] = [
  {
    title: 'Book Online',
    description: 'Choose your date, time, and location. Same-day appointments often available.',
    icon: <IconCalendar className="w-6 h-6 text-usml-navy" />,
  },
  {
    title: 'We Come to You',
    description: 'A licensed phlebotomist arrives at your door with everything needed.',
    icon: <IconVan className="w-6 h-6 text-usml-navy" />,
  },
  {
    title: 'Quick, Easy Draw',
    description: 'Professional specimen collection in under 10 minutes. Comfortable and calm.',
    icon: <IconVial className="w-6 h-6 text-usml-navy" />,
  },
  {
    title: 'Results to Your Doctor',
    description: 'Specimens couriered to your lab. Results typically within 24-48 hours.',
    icon: <IconClipboardCheck className="w-6 h-6 text-usml-navy" />,
  },
];

const DIFFERENTIATORS: Differentiator[] = [
  { title: 'Licensed & Insured', description: 'Nationally certified, background-checked phlebotomists.', icon: <IconShieldCheck className="w-6 h-6 text-usml-sage" /> },
  { title: 'Same-Day Available', description: 'Book as little as 2 hours ahead. Early AM and evening slots.', icon: <IconClock className="w-6 h-6 text-usml-sage" /> },
  { title: 'All Major Labs', description: 'Quest, Labcorp, Sonic, and any physician-specified laboratory.', icon: <IconFlask className="w-6 h-6 text-usml-sage" /> },
  { title: 'HIPAA Compliant', description: 'Enterprise-grade security for your medical information.', icon: <IconLock className="w-6 h-6 text-usml-sage" /> },
  { title: 'Transparent Pricing', description: 'No hidden fees. No insurance headaches. Clear pricing upfront.', icon: <IconDollar className="w-6 h-6 text-usml-sage" /> },
  { title: '546+ Five-Star Reviews', description: 'Rated 5.0 on Google across our family of services.', icon: <IconStar className="w-6 h-6 text-usml-sage" /> },
];

const PRICING_TIERS: PricingTier[] = [
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

const TESTIMONIALS: Testimonial[] = [
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

const FAQ_ITEMS: FAQItem[] = [
  { question: 'Do I need a doctor\'s order?', answer: 'Yes, we require a lab requisition or doctor\'s order for all blood draws. If you don\'t have one, we can help connect you with a provider who can place one.' },
  { question: 'Which labs do you work with?', answer: 'We work with all major reference laboratories including Quest Diagnostics, Labcorp, Sonic Healthcare, and any physician-specified lab.' },
  { question: 'How quickly can I get an appointment?', answer: 'Most appointments are available same-day. You can book as little as 2 hours in advance, with early morning and evening slots available.' },
  { question: 'What areas do you serve?', answer: 'We serve the entire Denver metro area and beyond -- over 20 communities from Boulder to Castle Rock, Lakewood to Aurora.' },
  { question: 'Is my information secure?', answer: 'Absolutely. We are fully HIPAA compliant. All patient data is encrypted and handled according to federal healthcare privacy standards.' },
  { question: 'How does billing work?', answer: 'Our mobile draw fee is a flat rate paid at booking. Laboratory processing is billed separately through your insurance by the lab, just like a traditional visit.' },
  { question: 'Do you draw blood from children?', answer: 'Yes. Our phlebotomists are experienced with pediatric draws. Many parents find children are significantly calmer at home than in a clinical setting.' },
];

// ---------------------------------------------------------------------------
// Password Gate
// ---------------------------------------------------------------------------
function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => {
    try { return sessionStorage.getItem('usml-mockup-unlocked') === 'true'; } catch { return false; }
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.trim().toLowerCase() === 'david') {
      try { sessionStorage.setItem('usml-mockup-unlocked', 'true'); } catch { /* noop */ }
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-usml-dark px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm text-center">
        <h1 className="font-jakarta text-3xl font-bold text-white">U.S. Mobile Labs</h1>
        <p className="mt-3 text-gray-400">Website concept preview. Enter the password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          placeholder="Password"
          className={`mt-8 w-full rounded-lg border bg-white/5 px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors focus:border-usml-coral focus:ring-2 focus:ring-usml-coral focus:ring-offset-2 focus:ring-offset-usml-dark ${error ? 'border-red-500' : 'border-white/20'} ${shake ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-red-400">Incorrect password.</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-gradient-to-r from-usml-navy to-usml-sage px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-usml-coral focus:ring-offset-2 focus:ring-offset-usml-dark"
        >
          View Site Concept
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. HeroSection
// ---------------------------------------------------------------------------
function HeroSection() {
  const [showChevron, setShowChevron] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowChevron(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-usml-dark px-6">
      {/* Glow orbs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(27,77,110,0.35),transparent_70%)] animate-pulse-glow" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(224,122,95,0.2),transparent_70%)] animate-pulse-glow" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <p className="animate-fade-slide-up text-sm font-semibold uppercase tracking-[0.2em] text-usml-coral">
          Mobile Phlebotomy
        </p>
        <h1 className="animate-fade-slide-up mt-6 font-jakarta text-5xl font-extrabold leading-tight text-white sm:text-6xl lg:text-7xl">
          Professional Lab Draws.<br />At Your Door.
        </h1>
        <p className="animate-fade-slide-up-1 mx-auto mt-6 max-w-2xl text-lg text-gray-300 sm:text-xl">
          Licensed phlebotomists come to your home, office, or facility anywhere in the Denver metro. No lab visits. No waiting rooms. Just results.
        </p>

        <div className="animate-fade-slide-up-2 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="#pricing"
            className="inline-block rounded-full bg-usml-coral px-8 py-4 font-semibold text-white transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-usml-coral focus:ring-offset-2 focus:ring-offset-usml-dark"
          >
            Book Your Draw
          </a>
          <a
            href="#how-it-works"
            className="inline-block rounded-full border-2 border-white/30 px-8 py-4 font-semibold text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-usml-coral focus:ring-offset-2 focus:ring-offset-usml-dark"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            See How It Works
          </a>
        </div>

        <div className="animate-fade-slide-up-3 mt-12 flex flex-wrap items-center justify-center gap-x-2 text-sm text-gray-400">
          <span>546+ Five-Star Reviews</span>
          <span aria-hidden="true" className="text-gray-600">&#183;</span>
          <span>Licensed &amp; Insured</span>
          <span aria-hidden="true" className="text-gray-600">&#183;</span>
          <span>Same-Day Available</span>
        </div>
      </div>

      {/* Bouncing chevron */}
      {showChevron && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/40">
          <IconChevronDown className="w-8 h-8" />
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. ProblemSection
// ---------------------------------------------------------------------------
function ProblemSection() {
  return (
    <Section className="bg-usml-cream">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <Reveal animation="slide-in-left">
          <h2 className="font-jakarta text-3xl font-bold text-usml-dark sm:text-4xl">Skip the Waiting Room</h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-600">
            Driving across town. Taking time off work. Sitting in a sterile waiting room, flipping through last year's magazines, wondering when they'll finally call your name. Lab visits haven't changed in decades. We thought it was time they did.
          </p>
        </Reveal>

        <div className="space-y-6">
          <Reveal animation="slide-in-right" delay={100}>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="font-jakarta text-lg font-bold text-usml-dark">The Traditional Lab</h3>
              <ul className="mt-4 space-y-3">
                {['Drive across town', 'Wait 30-60 minutes', 'Sterile, impersonal environment', 'Time off work or school'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-600">
                    <IconX className="w-5 h-5 shrink-0 text-usml-coral" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal animation="slide-in-right" delay={250}>
            <div className="rounded-2xl border-2 border-usml-navy bg-white p-6">
              <h3 className="font-jakarta text-lg font-bold text-usml-dark">U.S. Mobile Labs</h3>
              <ul className="mt-4 space-y-3">
                {['We come to your door', 'Done in under 10 minutes', 'Comfortable, familiar setting', 'Zero disruption to your day'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-600">
                    <IconCheck className="w-5 h-5 shrink-0 text-usml-sage" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 3. ServicesSection
// ---------------------------------------------------------------------------
function ServicesSection() {
  return (
    <Section id="services" className="bg-white">
      <Reveal>
        <div className="text-center">
          <h2 className="font-jakarta text-3xl font-bold text-usml-dark sm:text-4xl">What We Do</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            Comprehensive mobile phlebotomy services for individuals, physicians, and businesses.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-8 md:grid-cols-3">
        {SERVICES.map((service, i) => (
          <Reveal key={service.title} delay={i * 100}>
            <div className="h-full rounded-2xl border border-gray-200 bg-white p-8 transition-shadow duration-300 hover:shadow-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-usml-navy/10">
                {service.icon}
              </div>
              <h3 className="mt-5 font-jakarta text-xl font-bold text-usml-dark">{service.title}</h3>
              <p className="mt-2 text-gray-500">{service.description}</p>
              <ul className="mt-5 space-y-2">
                {service.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <IconCheck className="mt-0.5 w-4 h-4 shrink-0 text-usml-sage" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 4. HowItWorksSection
// ---------------------------------------------------------------------------
function HowItWorksSection() {
  return (
    <Section id="how-it-works" className="bg-usml-cream">
      <Reveal>
        <div className="text-center">
          <h2 className="font-jakarta text-3xl font-bold text-usml-dark sm:text-4xl">How It Works</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            Four simple steps from booking to results.
          </p>
        </div>
      </Reveal>

      <div className="relative mt-14">
        {/* Connecting dashed line */}
        <div className="pointer-events-none absolute left-[calc(12.5%+24px)] right-[calc(12.5%+24px)] top-6 hidden border-t-2 border-dashed border-usml-navy/20 md:block" />

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 150}>
              <div className="relative text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-usml-navy text-lg font-bold text-white">
                  {i + 1}
                </div>
                <div className="mx-auto mt-4 flex h-10 w-10 items-center justify-center text-usml-navy/60">
                  {step.icon}
                </div>
                <h3 className="mt-3 font-jakarta font-semibold text-usml-dark">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 5. WhyChooseUsSection
// ---------------------------------------------------------------------------
function WhyChooseUsSection() {
  return (
    <Section className="bg-white">
      <Reveal>
        <div className="text-center">
          <h2 className="font-jakarta text-3xl font-bold text-usml-dark sm:text-4xl">Why Denver Trusts Us</h2>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {DIFFERENTIATORS.map((item, i) => (
          <Reveal key={item.title} delay={i * 80}>
            <div className="rounded-xl bg-usml-cream/60 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-usml-sage/15">
                {item.icon}
              </div>
              <h3 className="mt-4 font-jakarta font-semibold text-usml-dark">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{item.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 6. PricingSection
// ---------------------------------------------------------------------------
function PricingSection() {
  return (
    <section id="pricing" className="bg-usml-dark px-6 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="text-center">
            <h2 className="font-jakarta text-3xl font-bold text-white sm:text-4xl">Simple, Transparent Pricing</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-300">
              No surprise bills. No insurance confusion. Just straightforward pricing.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid items-start gap-8 md:grid-cols-3">
          {PRICING_TIERS.map((tier, i) => (
            <Reveal key={tier.name} animation="scale-in" delay={i * 100}>
              <div
                className={`relative rounded-2xl p-8 ${
                  tier.highlighted
                    ? 'bg-white text-usml-dark ring-2 ring-usml-coral md:scale-105'
                    : 'border border-white/10 bg-white/[0.07] text-white backdrop-blur-sm'
                }`}
              >
                {tier.highlighted && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-usml-coral px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="font-jakarta text-lg font-bold">{tier.name}</h3>
                <p className={`mt-1 text-sm ${tier.highlighted ? 'text-gray-500' : 'text-gray-400'}`}>{tier.tagline}</p>
                <div className="mt-6">
                  <span className={`text-lg ${tier.highlighted ? 'text-usml-dark' : 'text-gray-300'}`}>$</span>
                  <span className="font-jakarta text-5xl font-extrabold">{tier.price}</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <IconCheck className={`mt-0.5 w-4 h-4 shrink-0 ${tier.highlighted ? 'text-usml-sage' : 'text-white/30'}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`mt-6 w-full rounded-full py-3 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-usml-coral focus:ring-offset-2 ${
                    tier.highlighted
                      ? 'bg-usml-coral text-white hover:brightness-110 focus:ring-offset-white'
                      : 'border border-white/30 text-white hover:bg-white/10 focus:ring-offset-usml-dark'
                  }`}
                >
                  Book Your Draw
                </button>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-12 text-center">
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
            >
              <span>Teams of 10+? Corporate wellness starts at $65 per person.</span>
              <IconArrowRight className="w-4 h-4" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 7. ServiceAreasSection
// ---------------------------------------------------------------------------
function ServiceAreasSection() {
  return (
    <Section id="areas" className="bg-white">
      <Reveal>
        <div className="text-center">
          <h2 className="font-jakarta text-3xl font-bold text-usml-dark sm:text-4xl">Serving Greater Denver &amp; Beyond</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            Professional mobile phlebotomy within a 25-mile radius of Denver. Expanding across Colorado.
          </p>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {CITIES.map((city) => (
            <span
              key={city}
              className="rounded-full border border-usml-navy/10 bg-usml-cream px-5 py-2.5 text-sm font-medium text-usml-navy transition-colors duration-200 hover:bg-usml-navy hover:text-white"
            >
              {city}
            </span>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 8. TestimonialsSection
// ---------------------------------------------------------------------------
function TestimonialsSection() {
  return (
    <Section className="bg-usml-cream">
      <Reveal>
        <div className="text-center">
          <h2 className="font-jakarta text-3xl font-bold text-usml-dark sm:text-4xl">What Our Patients Say</h2>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-8 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={i * 100}>
            <div className="h-full rounded-2xl bg-white p-8 shadow-sm">
              <div className="flex gap-1" aria-label="5 out of 5 stars">
                {[...Array(5)].map((_, j) => (
                  <IconStar key={j} className="w-5 h-5 text-usml-gold" />
                ))}
              </div>
              <p className="mt-4 italic leading-relaxed text-gray-600">"{t.quote}"</p>
              <div className="mt-6">
                <p className="font-semibold text-usml-dark">{t.name}</p>
                <p className="text-sm text-gray-400">{t.location}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <p className="mt-12 text-center text-sm text-gray-500">
          546+ five-star reviews across our family of services.
        </p>
      </Reveal>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 9. FAQSection
// ---------------------------------------------------------------------------
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Section id="faq" className="bg-white">
      <Reveal>
        <div className="text-center">
          <h2 className="font-jakarta text-3xl font-bold text-usml-dark sm:text-4xl">Frequently Asked Questions</h2>
        </div>
      </Reveal>

      <Reveal>
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-gray-200">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.question}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  className="flex w-full items-center justify-between py-5 text-left font-semibold text-usml-dark transition-colors hover:text-usml-navy focus:outline-none focus:ring-2 focus:ring-usml-coral focus:ring-offset-2"
                >
                  <span>{item.question}</span>
                  <IconChevronDown
                    className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 leading-relaxed text-gray-600">{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 10. CTASection
// ---------------------------------------------------------------------------
function CTASection() {
  return (
    <section className="bg-gradient-to-br from-usml-navy via-usml-navy to-usml-sage px-6 py-20 md:py-28">
      <Reveal animation="scale-in">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-jakarta text-3xl font-bold text-white sm:text-4xl">Ready to Skip the Lab?</h2>
          <p className="mt-4 text-lg text-white/80">Book your mobile blood draw in 60 seconds.</p>
          <a
            href="#pricing"
            className="mt-8 inline-block rounded-full bg-usml-coral px-10 py-4 text-lg font-bold text-white transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-usml-coral focus:ring-offset-2 focus:ring-offset-usml-navy"
          >
            Book Your Draw
          </a>
          <p className="mt-6 text-lg text-white/80">(720) 508-1998</p>
        </div>
      </Reveal>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FooterSection
// ---------------------------------------------------------------------------
function FooterSection() {
  return (
    <footer className="bg-usml-dark px-6 py-12 text-gray-400">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
        <div>
          <p className="font-jakarta text-xl font-bold text-white">U.S. Mobile Labs</p>
          <p className="mt-2 text-sm">Professional Lab Draws. At Your Door.</p>
          <p className="mt-4 text-xs text-gray-500">A USMM LLC company</p>
        </div>

        <div>
          <p className="font-semibold text-white">Quick Links</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              { label: 'Services', href: '#services' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'FAQ', href: '#faq' },
              { label: 'Service Areas', href: '#areas' },
            ].map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-usml-coral focus:ring-offset-2 focus:ring-offset-usml-dark"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-white">Contact</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <IconPhone className="w-4 h-4 shrink-0" />
              <span>(720) 508-1998</span>
            </li>
            <li className="flex items-center gap-2">
              <IconMail className="w-4 h-4 shrink-0" />
              <span>info@usmobilelabs.com</span>
            </li>
            <li className="mt-3">Denver, Colorado</li>
            <li>Mon-Sat 7am-7pm</li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-gray-500 sm:flex-row">
        <p>&copy; {new Date().getFullYear()} U.S. Mobile Labs. All rights reserved.</p>
        <div className="flex gap-4">
          <span>Affiliated with U.S. Mobile IV</span>
          <span aria-hidden="true">|</span>
          <span>Website concept by Matt Cohen</span>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------
export default function USMobileLabs() {
  return (
    <PasswordGate>
      <div className="min-h-screen bg-white font-sans text-usml-charcoal antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-usml-navy focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <main id="main-content">
          <HeroSection />
          <ProblemSection />
          <ServicesSection />
          <HowItWorksSection />
          <WhyChooseUsSection />
          <PricingSection />
          <ServiceAreasSection />
          <TestimonialsSection />
          <FAQSection />
          <CTASection />
        </main>
        <FooterSection />
      </div>
    </PasswordGate>
  );
}
