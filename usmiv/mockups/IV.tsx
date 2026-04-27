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
// Animated bar (for competitive chart)
// ---------------------------------------------------------------------------
function AnimatedBar({
  label,
  value,
  max,
  highlight = false,
}: {
  label: string;
  value: number;
  max: number;
  highlight?: boolean;
}) {
  const { ref, isVisible } = useScrollReveal(0.2);
  const pct = Math.round((value / max) * 100);

  return (
    <div ref={ref} className="mb-5">
      <div className="flex justify-between mb-1.5 text-sm font-medium">
        <span className={highlight ? 'text-audit-iv-dark font-semibold' : 'text-gray-700'}>
          {label}
        </span>
        <span className="text-gray-500">{value.toLocaleString()}</span>
      </div>
      <div className="h-4 w-full rounded-full bg-gray-200 overflow-hidden" role="presentation">
        <div
          className={`h-full rounded-full transition-all ease-out ${
            highlight
              ? 'bg-gradient-to-r from-audit-medics to-audit-iv'
              : 'bg-gray-400'
          }`}
          style={{
            width: isVisible ? `${pct}%` : '0%',
            transitionDuration: '1.2s',
          }}
          role="img"
          aria-label={`${label}: ${value.toLocaleString()} reviews, ${pct}% of leader`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grade color helper
// ---------------------------------------------------------------------------
function gradeColor(grade: string): string {
  const letter = grade.charAt(0).toUpperCase();
  const map: Record<string, string> = {
    A: 'text-audit-grade-a',
    B: 'text-audit-grade-b',
    C: 'text-audit-grade-c',
    D: 'text-audit-grade-d',
    F: 'text-audit-grade-f',
  };
  return map[letter] ?? 'text-gray-600';
}

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span className={`font-bold text-lg ${gradeColor(grade)}`} aria-label={`Grade: ${grade}`}>
      {grade}
    </span>
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
const MEDICS_GRADES = [
  { label: 'Performance', grade: 'C-',
    detail: 'CLS 0.30 (3x over threshold) from 9 unoptimized web fonts. 40 render-blocking CSS files. 75.6 MB .mov video. LCP acceptable at ~400ms.',
    fix: 'Preload critical fonts with font-display: swap. Convert .mov to MP4 (5-10x smaller). Defer non-critical CSS via WP Rocket. Size the logo image. One sprint to A-.' },
  { label: 'SEO', grade: 'D+',
    detail: '5 pages cannibalizing "semaglutide weight loss Denver." Schema missing address/phone/geo. Hours in schema say 9-5 (site says 8-10pm). No og:image. Broken heading hierarchy.',
    fix: '301-redirect 4 semaglutide pages to 1 canonical. Fix schema in Rank Math (address, phone, hours). Set default og:image. Fix headings in Elementor. All same-day fixes.' },
  { label: 'Accessibility', grade: 'C+',
    detail: 'Lighthouse 87/100. Brand teal (#07b6b6) fails contrast at 2.51:1 across 69 elements. Two inaccessible links. ARIA list violation. Invalid footer phone link.',
    fix: 'Darken teal to #047c7c in Elementor global colors -- one change fixes 69 elements. Add aria-labels to icon links. Fix tel: format. Target: Lighthouse 95+.' },
  { label: 'Content', grade: 'D',
    detail: '93 AI-generated blog posts (3 near-identical "wellness programs" titles in 3 days). Pseudonym authors. No medical director, no provider bios, no disclaimers. E-E-A-T grade D for YMYL.',
    fix: 'Name a medical director on every page. Build real provider profiles with photos and license types. Add FDA disclaimers to weight loss pages. Cull the worst 50 AI posts, improve the best 20. Attribute to credentialed authors.' },
  { label: 'Local SEO', grade: 'D+',
    detail: 'Has own GBP ("U.S. Mobile Medics - Denver") but only 7 reviews and lists a third phone number (720) 730-4998. Schema hours mismatch. Missing from Apple Maps, Bing, YP, BBB, and all healthcare directories.',
    fix: 'Consolidate the three phone numbers to one. Fix schema hours. Claim Apple Maps, Bing, YP, BBB. Decide whether to grow this GBP or merge reviews into the IV brand\'s 545-review GBP.' },
  { label: 'Design & UX', grade: 'D+',
    detail: '11-24 field booking form (industry standard: 3-5). $0.00 pricing display. Brand name mismatch on booking.',
    fix: 'Simplify to 4-5 fields. Show real pricing. Fix brand name. Could increase booking completion 40-60%.' },
];

const IV_GRADES = [
  { label: 'Performance', grade: 'B+',
    detail: 'LCP 153ms, CLS 0.01. HTTP/3 + HSTS preload. Best Practices 100, SEO 100. Only 3 JS files. 38 render-blocking CSS from Bricks stack is the main issue.',
    fix: 'Consolidate CSS files via Bricks performance settings or critical CSS extraction. Already close to A -- this is the final optimization.' },
  { label: 'SEO', grade: 'C',
    detail: 'No canonical tags anywhere. Robots.txt sitemap typo. 5 pages cannibalizing "Colorado mobile IV therapy." 5 conflicting JSON-LD blocks. Broken hours in one schema block. Good: MedicalBusiness type, 67 location pages.',
    fix: 'Add self-referencing canonical tags to all pages. Fix robots.txt (one character). Consolidate 5 JSON-LD blocks into single @graph. Set one page as canonical for each keyword cluster. Fix the broken hours schema block.' },
  { label: 'Accessibility', grade: 'C+',
    detail: 'Lighthouse 87/100. Brand teal (#44B7BC) fails contrast at 2.4:1 (worse than sister site). No skip-to-content link. Floating button missing name. Nav toggles undersized. Good: all images have alt text.',
    fix: 'Darken teal to ~#2A8A8F. Add skip-to-content link. Add aria-label to floating contact button. Increase nav toggle tap targets. Target: Lighthouse 95+.' },
  { label: 'Content', grade: 'C',
    detail: '12 blog posts (better quality, updated March 2026). No medical disclaimers on weight loss/NAD+ pages. No provider credentials. Contact page missing address/hours/email. Events counter shows "0+" (broken).',
    fix: 'Add disclaimers to weight loss and NAD+ pages. Complete the contact page (address, hours, email, map). Fix events counter. Increase to 2-4 quality posts/month with named credentialed authors.' },
  { label: 'Local SEO', grade: 'B-',
    detail: 'Correct MedicalBusiness schema. 67 location pages with unique content. Missing geo coordinates, priceRange. Thin citation profile.',
    fix: 'Add lat/lng and priceRange to schema. Build citations on Apple Maps, Bing, Manta, Foursquare, healthcare directories. The 67 location pages are a strong foundation -- just needs supporting infrastructure.' },
  { label: 'Reviews', grade: 'A-',
    detail: '546 Google reviews at 5.0. BBB A-. TrustIndex widget on sister site. Trails Rocky Mountain (1,715) and HydraMed (5,000+).',
    fix: 'Implement systematic post-service review requests via SMS. Target 1,000 reviews within 12 months. Respond to every review. Display reviews prominently on THIS site (not just sister site). Add AggregateRating schema.' },
  { label: 'Design & UX', grade: 'C+',
    detail: 'Modern design, HSA badge, events page, 3-step flow. Hides weight loss/NAD+ pricing. Contact page incomplete.',
    fix: 'Consider showing pricing (transparency builds trust -- sister site proves this works). Complete contact page. Fix events counter.' },
];

const COMBINED_GRADES = [
  { label: 'Brand Architecture', grade: 'D',
    detail: 'Two websites, three phone numbers, two addresses, two separate Google Business Profiles (IV: 545 reviews, Medics: 7 reviews), two Instagrams -- but shared Facebook, YouTube, Acuity, staff, and pricing.',
    fix: 'Option A: Consolidate to usmobileiv.com (stronger SEO foundation, owns the GBP). 301-redirect the Medics domain. Merge phlebotomy content. One phone, one brand. Option B: Fully separate -- own GBPs, own social accounts, own booking. No shared assets. Either path works; the current hybrid does not.' },
  { label: 'HIPAA Compliance', grade: 'A',
    detail: 'Shared Acuity is on the highest-tier plan with HIPAA active and a signed BAA. Semaglutide and IV intake forms run on HIPAA-compliant infrastructure. HIPAA status is not surfaced on either site.',
    fix: 'Add a brief HIPAA-compliance notice to both booking pages and replace the generic privacy policy with a healthcare-specific Notice of Privacy Practices referencing the BAA.' },
  { label: 'E-E-A-T (Both Sites)', grade: 'D',
    detail: 'No medical director. No provider credentials or license numbers. No medical disclaimers on pages promoting prescription GLP-1 medications.',
    fix: 'Name a medical director with board certifications. Build individual provider profiles (name, photo, RN/NRP license, years experience). Add FDA disclaimers and contraindication warnings. Apply for LegitScript certification. 30-day project to reach B+.' },
  { label: 'Reviews & Reputation', grade: 'B+',
    detail: '546 reviews at 5.0 is strong. Staff mentioned by name (David, Pedro, Shay, Grant). Solid foundation but trails leaders.',
    fix: 'Automate post-service review requests. Target 1,000+ reviews within 12 months to close the gap with Rocky Mountain (1,715). Respond to every review. Already on the path to A.' },
  { label: 'Competitive Position', grade: 'C',
    detail: 'Neither site ranks for "mobile IV therapy Denver." 546 reviews vs 1,715+ for top competitor. Unique assets: phlebotomy, partnerships, transparent pricing, events.',
    fix: 'Consolidate domain authority to compete for head terms. Double down on phlebotomy (zero competition). Scale partnerships from 8 to 20+. Get into "best of Denver" roundup articles for AI visibility. Pursue LegitScript to match HydraMed.' },
];

const FINDINGS = [
  {
    severity: 'critical' as const,
    title: 'No Medical Director',
    desc: 'Neither site names a supervising physician. For a company administering IV medications and prescribing GLP-1 agonists, this is a regulatory gap. No provider credentials, no license numbers, no individual bios on either site.',
  },
  {
    severity: 'high' as const,
    title: 'Brand Fragmentation',
    desc: 'Two websites, three phone numbers, two addresses, two Google Business Profiles, two Instagram accounts -- but shared Facebook, YouTube, and booking system. Google cannot consolidate authority. Neither site ranks for "mobile IV therapy Denver."',
  },
  {
    severity: 'high' as const,
    title: 'Keyword Cannibalization',
    desc: 'Five pages on usmobilemedics.com compete for "semaglutide weight loss Denver." The two sites cannibalize each other on city keywords like Thornton and Greenwood Village.',
  },
  {
    severity: 'opportunity' as const,
    title: '546 Reviews at 5.0 Stars',
    desc: 'Strong review portfolio under the "U.S. Mobile IV" Google Business Profile. TrustIndex widget displays these on usmobilemedics.com. The review base is real and growing -- a genuine competitive asset.',
  },
  {
    severity: 'opportunity' as const,
    title: 'Phlebotomy: Untapped Differentiator',
    desc: 'Mobile phlebotomy has almost zero competition in Denver. US Mobile Medics ranks #4 for "mobile phlebotomy Denver." No other major mobile IV competitor offers this service as a standalone.',
  },
];

const COMPETITORS = [
  { label: 'HydraMed', value: 5000, highlight: false },
  { label: 'Rocky Mountain IV Medics', value: 1715, highlight: false },
  { label: 'Twin Rivers IV', value: 882, highlight: false },
  { label: 'USMM LLC (545 + 7 across two GBPs)', value: 552, highlight: true },
];

const STRATEGIC_LENSES = [
  {
    lens: 'Competitive Strategy',
    insight:
      'In markets that consolidate around trust and scale, splitting competitive mass across two brands means neither achieves the critical threshold to compete. The businesses with the most reviews, the strongest credentials, and the clearest brand identity capture disproportionate market share.',
  },
  {
    lens: 'Brand & Positioning',
    insight:
      "A brand that cannot be clearly described in one sentence does not have a brand problem -- it has a strategy problem. The partnership model (gyms, aesthetics, meal prep) is the seed of a distinctive market position: the IV company embedded in Denver's wellness ecosystem.",
  },
  {
    lens: 'Innovation & Market Fit',
    insight:
      'Clinical convenience and lifestyle wellness are genuinely different customer needs. But serving both with identical pricing, identical staff, and a shared booking system is not segmentation -- it is duplication. The real innovation opportunity is mobile phlebotomy, and it is the neglected brand that owns it.',
  },
  {
    lens: 'Risk & Compliance',
    insight:
      'The booking system is already on a HIPAA-compliant Acuity plan with a signed BAA -- the compliance foundation exists. The remaining work is surfacing that status on-site (privacy notices, provider credentials, medical disclaimers) so prospects and search engines see the trust signals that are already there underneath.',
  },
];

const ROADMAP = [
  {
    phase: 1,
    title: 'Compliance',
    timeframe: 'Weeks 1-4',
    items: [
      'Establish medical director',
      'Add disclaimers to all service pages',
      'Build provider credentials pages',
      'Surface existing HIPAA/BAA status in privacy notice',
    ],
  },
  {
    phase: 2,
    title: 'Brand Decision',
    timeframe: 'Weeks 2-4',
    items: [
      'Consolidate to one domain OR formalize separation',
      'Merge best content from both sites',
      'Unify or fully separate social accounts',
      'Fix schema, canonical tags, and sitemap',
    ],
  },
  {
    phase: 3,
    title: 'Differentiation',
    timeframe: 'Months 2-6',
    items: [
      'Scale partnerships from 8 to 20+',
      'Pursue LegitScript certification',
      'Add FAQ schema to all service pages',
      'Get listed in "best of" roundups',
      'Target "mobile IV therapy Denver"',
    ],
  },
  {
    phase: 4,
    title: 'Flywheel',
    timeframe: 'Months 6-12',
    items: [
      'Target 1,000 Google reviews',
      'Build corporate wellness pipeline',
      'Develop partner referral tracking',
      'Evaluate Colorado expansion',
    ],
  },
];

// ---------------------------------------------------------------------------
// Password gate
// ---------------------------------------------------------------------------
function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => {
    try { return sessionStorage.getItem('iv-audit-unlocked') === '1'; } catch { return false; }
  });
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.toLowerCase().trim() === 'david') {
      setUnlocked(true);
      try { sessionStorage.setItem('iv-audit-unlocked', '1'); } catch { /* noop */ }
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-audit-dark px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">Digital Presence Audit</h1>
        <p className="mb-8 text-sm text-gray-400">Enter the password to continue.</p>
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
          View Audit
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function IV() {
  return (
    <PasswordGate>
      <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">
        <HeroSection />
        <DiscoverySection />
        <GradeCardsSection />
        <FindingsSection />
        <CompetitiveSection />
        <AEOSection />
        <StrategicSection />
        <OpportunitiesSection />
        <RoadmapSection />
        <FooterSection />
      </div>
    </PasswordGate>
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
      {/* Gradient glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-0 top-0 h-full w-1/2 bg-gradient-to-br from-audit-medics/15 via-transparent to-transparent" />
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-bl from-audit-iv/15 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-3xl">
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
          Digital Presence Audit
        </h1>
        <p className="mb-3 text-lg text-gray-300 sm:text-xl">
          USMM LLC&nbsp;&nbsp;|&nbsp;&nbsp;US Mobile Medics + U.S. Mobile IV
        </p>
        <p className="text-base text-gray-400">
          Comprehensive Digital Analysis. April 2026.
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
// Section 2 -- The Discovery
// ===========================================================================
function DiscoverySection() {
  return (
    <Section className="bg-audit-cream">
      <Reveal>
        <h2 className="mb-6 text-3xl font-bold text-audit-dark sm:text-4xl">
          Two Brands. One Business.
        </h2>
      </Reveal>
      <Reveal delay={100}>
        <p className="mb-12 max-w-3xl text-lg leading-relaxed text-gray-700">
          We discovered two websites operated by the same company -- same booking
          system, same staff, same pricing. Different names, different phones,
          different audiences. The question: is this intentional segmentation or
          accidental fragmentation?
        </p>
      </Reveal>

      {/* Entity diagram */}
      <Reveal animation="scale-in" delay={200}>
        <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr]">
          {/* Medics box */}
          <div className="rounded-xl border-2 border-audit-medics/30 bg-white p-6 shadow-sm">
            <h3 className="mb-4 border-b-2 border-audit-medics pb-2 text-lg font-bold text-audit-medics-dark">
              US Mobile Medics
            </h3>
            <p className="mb-1 text-sm font-medium text-gray-500 uppercase tracking-wide">Unique Assets</p>
            <ul className="space-y-1.5 text-sm text-gray-700" role="list">
              <li>Own GBP: 7 reviews, 5.0</li>
              <li>Phlebotomy (standalone)</li>
              <li>93 blog posts</li>
              <li>3rd phone: (720) 730-4998</li>
            </ul>
          </div>

          {/* Shared center */}
          <div className="flex flex-col items-center justify-center">
            <div className="hidden md:block w-px h-6 bg-gray-300" aria-hidden="true" />
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 text-center shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Shared
              </p>
              <ul className="space-y-1 text-sm text-gray-600" role="list">
                <li>Acuity Booking</li>
                <li>Facebook &amp; YouTube</li>
                <li>Legal Entity (USMM LLC)</li>
                <li>Staff &amp; Pricing</li>
              </ul>
            </div>
            <div className="hidden md:block w-px h-6 bg-gray-300" aria-hidden="true" />
          </div>

          {/* IV box */}
          <div className="rounded-xl border-2 border-audit-iv/30 bg-white p-6 shadow-sm">
            <h3 className="mb-4 border-b-2 border-audit-iv pb-2 text-lg font-bold text-audit-iv-dark">
              U.S. Mobile IV
            </h3>
            <p className="mb-1 text-sm font-medium text-gray-500 uppercase tracking-wide">Unique Assets</p>
            <ul className="space-y-1.5 text-sm text-gray-700" role="list">
              <li>Events capability</li>
              <li>67 location pages</li>
              <li>546 Google reviews (5.0)</li>
              <li>BBB A- rating</li>
            </ul>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

// ===========================================================================
// Section 3 -- Grade Cards
// ===========================================================================
function ExpandableGradeRow({
  label,
  grade,
  detail,
  fix,
  isOpen,
  onToggle,
}: {
  label: string;
  grade: string;
  detail: string;
  fix: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="flex w-full items-center justify-between py-2.5 text-left hover:bg-gray-50 transition-colors rounded px-1 -mx-1"
        aria-expanded={isOpen}
      >
        <span className="text-sm text-gray-700 flex items-center gap-2">
          {label}
          <svg
            className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
        <GradeBadge grade={grade} />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="rounded-lg bg-gray-50 px-3 py-3 mb-2 space-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Why this grade</p>
              <p className="text-xs leading-relaxed text-gray-600">{detail}</p>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-0.5">Path to A</p>
              <p className="text-xs leading-relaxed text-gray-700">{fix}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GradeCardsSection() {
  const [medicsOpen, setMedicsOpen] = useState<string | null>(null);
  const [ivOpen, setIvOpen] = useState<string | null>(null);
  const [combinedOpen, setCombinedOpen] = useState<string | null>(null);

  return (
    <Section className="bg-white">
      <Reveal>
        <h2 className="mb-3 text-3xl font-bold text-audit-dark sm:text-4xl">
          The Scorecard
        </h2>
        <p className="mb-10 text-sm text-gray-500">Tap any grade to see the evidence behind it.</p>
      </Reveal>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Medics card */}
        <Reveal animation="slide-in-left" delay={100}>
          <div className="overflow-hidden rounded-xl border border-gray-200 shadow-md">
            <div className="bg-audit-medics px-6 py-4">
              <h3 className="text-lg font-bold text-white">usmobilemedics.com</h3>
            </div>
            <div className="px-6 py-4">
              {MEDICS_GRADES.map((g) => (
                <ExpandableGradeRow
                  key={g.label}
                  label={g.label}
                  grade={g.grade}
                  detail={g.detail}
                  fix={g.fix}
                  isOpen={medicsOpen === g.label}
                  onToggle={() => setMedicsOpen(medicsOpen === g.label ? null : g.label)}
                />
              ))}
              <div className="mt-4 flex items-center justify-between border-t-2 border-gray-200 pt-3">
                <span className="font-semibold text-gray-900">Overall</span>
                <span className={`text-xl font-extrabold ${gradeColor('D+')}`}>D+</span>
              </div>
            </div>
          </div>
        </Reveal>

        {/* IV card */}
        <Reveal animation="slide-in-right" delay={100}>
          <div className="overflow-hidden rounded-xl border border-gray-200 shadow-md">
            <div className="bg-audit-iv px-6 py-4">
              <h3 className="text-lg font-bold text-white">usmobileiv.com</h3>
            </div>
            <div className="px-6 py-4">
              {IV_GRADES.map((g) => (
                <ExpandableGradeRow
                  key={g.label}
                  label={g.label}
                  grade={g.grade}
                  detail={g.detail}
                  fix={g.fix}
                  isOpen={ivOpen === g.label}
                  onToggle={() => setIvOpen(ivOpen === g.label ? null : g.label)}
                />
              ))}
              <div className="mt-4 flex items-center justify-between border-t-2 border-gray-200 pt-3">
                <span className="font-semibold text-gray-900">Overall</span>
                <span className={`text-xl font-extrabold ${gradeColor('C+')}`}>C+</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Combined assessment */}
      <Reveal delay={250}>
        <div className="mt-10 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
          <div className="bg-audit-navy px-6 py-3">
            <h3 className="text-base font-bold text-white">Combined Assessment</h3>
          </div>
          <div className="px-6 py-4">
            {COMBINED_GRADES.map((g) => (
              <ExpandableGradeRow
                key={g.label}
                label={g.label}
                grade={g.grade}
                detail={g.detail}
                fix={g.fix}
                isOpen={combinedOpen === g.label}
                onToggle={() => setCombinedOpen(combinedOpen === g.label ? null : g.label)}
              />
            ))}
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

// ===========================================================================
// Section 4 -- Key Findings
// ===========================================================================
function SeverityDot({ severity }: { severity: 'critical' | 'high' | 'opportunity' }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-amber-500',
    opportunity: 'bg-green-500',
  };
  const labels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    opportunity: 'Opportunity',
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[severity]}`} aria-hidden="true" />
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {labels[severity]}
      </span>
    </span>
  );
}

function FindingsSection() {
  return (
    <Section className="bg-gray-50" id="findings">
      <Reveal>
        <h2 className="mb-10 text-3xl font-bold text-audit-dark sm:text-4xl">
          Critical Findings
        </h2>
      </Reveal>

      <div className="grid gap-6 sm:grid-cols-2">
        {FINDINGS.map((f, i) => (
          <Reveal key={i} delay={i * 80}>
            <article className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <SeverityDot severity={f.severity} />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{f.desc}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ===========================================================================
// Section 5 -- Competitive Landscape
// ===========================================================================
function CompetitiveSection() {
  return (
    <Section className="bg-white">
      <Reveal>
        <h2 className="mb-2 text-3xl font-bold text-audit-dark sm:text-4xl">
          Where You Stand
        </h2>
        <p className="mb-10 text-sm text-gray-500">Google Reviews, Denver Mobile IV Market</p>
      </Reveal>

      <Reveal delay={100}>
        <div className="mx-auto max-w-2xl">
          {COMPETITORS.map((c) => (
            <AnimatedBar
              key={c.label}
              label={c.label}
              value={c.value}
              max={5000}
              highlight={c.highlight}
            />
          ))}
        </div>
      </Reveal>

      <Reveal delay={250}>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-gray-600">
          What you have that they don't: Mobile phlebotomy. 8 local partnerships.
          Transparent pricing. Events capability.
        </p>
      </Reveal>
    </Section>
  );
}

// ===========================================================================
// Section 5b -- AEO (AI Visibility)
// ===========================================================================
const AEO_QUERIES = [
  { query: '"Best mobile IV therapy Denver"', recommended: false, who: 'HydraMed, Rocky Mountain IV, Drip Hydration' },
  { query: '"Mobile IV therapy near me"', recommended: false, who: 'HydraMed, Rocky Mountain IV, Intravene' },
  { query: '"Hangover IV Denver"', recommended: false, who: 'IVitalize, Rocky Mountain IV, HydraMed' },
  { query: '"Semaglutide weight loss Denver"', recommended: true, who: 'US Mobile Medics ranks #1-3' },
  { query: '"Mobile phlebotomy Denver"', recommended: true, who: 'US Mobile Medics ranks #1' },
  { query: '"NAD+ therapy Denver"', recommended: false, who: 'Restore, Drip Hydration, Onus IV' },
];

const AEO_GAPS = [
  {
    title: 'Zero third-party citations',
    desc: 'No roundup articles, "best of" lists, or editorial content mentions either brand. LLMs rely on third-party validation to recommend businesses.',
  },
  {
    title: 'No FAQ schema on key pages',
    desc: 'AI engines extract structured Q&A content. usmobileiv.com has FAQ schema on the homepage; usmobilemedics.com has none. Neither has FAQs on service pages.',
  },
  {
    title: 'No named medical authority',
    desc: 'Competitor HydraMed names an ER physician as medical director. LLMs weigh named credentials heavily for health queries. Neither USMM site names a medical director.',
  },
  {
    title: 'Review gap signals low authority',
    desc: 'HydraMed: 8,263 reviews. Rocky Mountain: 1,729. USMM: ~546. LLMs interpret review volume as consensus. The gap puts USMM below the recommendation threshold for general queries.',
  },
];

function AEOSection() {
  return (
    <Section className="bg-audit-dark">
      <Reveal>
        <h2 className="mb-2 text-3xl font-bold text-white sm:text-4xl">
          AI Visibility
        </h2>
        <p className="mb-10 text-sm text-gray-400">
          When customers ask ChatGPT, Perplexity, or Google AI for recommendations, here is what happens.
        </p>
      </Reveal>

      {/* Query results table */}
      <Reveal delay={100}>
        <div className="mb-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-semibold text-gray-300">Query</th>
                  <th className="px-4 py-3 font-semibold text-gray-300 text-center">You?</th>
                  <th className="px-4 py-3 font-semibold text-gray-300">Who Gets Recommended</th>
                </tr>
              </thead>
              <tbody>
                {AEO_QUERIES.map((q, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-gray-300">{q.query}</td>
                    <td className="px-4 py-3 text-center">
                      {q.recommended ? (
                        <span className="inline-block h-3 w-3 rounded-full bg-green-500" aria-label="Yes" />
                      ) : (
                        <span className="inline-block h-3 w-3 rounded-full bg-red-500" aria-label="No" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{q.who}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      {/* Why cards */}
      <Reveal delay={150}>
        <h3 className="mb-6 text-lg font-bold text-white">Why AI Doesn't Recommend You (Yet)</h3>
      </Reveal>
      <div className="grid gap-4 sm:grid-cols-2">
        {AEO_GAPS.map((g, i) => (
          <Reveal key={i} animation="scale-in" delay={200 + i * 80}>
            <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-5">
              <h4 className="mb-2 text-sm font-bold text-white">{g.title}</h4>
              <p className="text-xs leading-relaxed text-gray-400">{g.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Bright spot */}
      <Reveal delay={500}>
        <div className="mt-8 rounded-xl border border-green-500/20 bg-green-500/5 p-5">
          <h4 className="mb-2 text-sm font-bold text-green-400">The bright spot</h4>
          <p className="text-sm leading-relaxed text-gray-300">
            You dominate niche clinical queries. "Semaglutide weight loss Denver" returns US Mobile Medics
            in positions 1-3. "Mobile phlebotomy Denver" returns you at #1. These are high-intent,
            low-competition queries where you already win -- the opportunity is expanding from here.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}

// ===========================================================================
// Section 6 -- Strategic Perspective
// ===========================================================================
function StrategicSection() {
  return (
    <Section className="bg-audit-dark">
      <Reveal>
        <h2 className="mb-10 text-3xl font-bold text-white sm:text-4xl">
          Strategic Perspective
        </h2>
      </Reveal>

      <div className="grid gap-6 sm:grid-cols-2">
        {STRATEGIC_LENSES.map((l, i) => (
          <Reveal key={i} animation="scale-in" delay={i * 100}>
            <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <h3 className="mb-3 text-base font-bold text-white">{l.lens}</h3>
              <p className="flex-1 text-sm leading-relaxed text-gray-300">
                {l.insight}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ===========================================================================
// Section 7a -- Opportunities
// ===========================================================================
const OPPORTUNITIES = [
  {
    title: 'Phlebotomy monopoly',
    desc: 'You rank #4 for "mobile phlebotomy Denver" with almost zero competition. No other major mobile IV company offers this as a standalone service. This is a blue ocean -- an entire service category you could own.',
    icon: '1',
  },
  {
    title: 'Partnership ecosystem',
    desc: '8 local business partnerships (gyms, aesthetics, meal prep) make you the only mobile IV company embedded in Denver\'s wellness infrastructure. Scale this to 20+ and you have a referral flywheel no competitor can replicate.',
    icon: '2',
  },
  {
    title: '546 reviews at 5.0',
    desc: 'A perfect rating across 546 Google reviews is rare and valuable. This is a genuine competitive moat -- you just need to consolidate it under one brand and push toward 1,000 to close the gap with Rocky Mountain.',
    icon: '3',
  },
  {
    title: 'Semaglutide SERP ownership',
    desc: 'You hold positions 1-3 for "semaglutide weight loss Denver." This is a high-intent, high-value keyword that most IV therapy competitors don\'t rank for. You\'re already winning where the money is.',
    icon: '4',
  },
  {
    title: 'Events & corporate wellness',
    desc: 'Weddings, corporate retreats, apartment complexes -- an untapped B2B revenue channel. Twin Rivers does this with an Airstream; you could do it with existing staff and a dedicated sales push.',
    icon: '5',
  },
];

function OpportunitiesSection() {
  return (
    <Section className="bg-white">
      <Reveal>
        <h2 className="mb-2 text-3xl font-bold text-audit-dark sm:text-4xl">
          What You're Sitting On
        </h2>
        <p className="mb-10 text-sm text-gray-500">
          Five competitive advantages your competitors don't have. These aren't aspirational -- they're already yours.
        </p>
      </Reveal>

      <div className="space-y-4">
        {OPPORTUNITIES.map((o, i) => (
          <Reveal key={i} delay={i * 80}>
            <div className="flex gap-5 rounded-xl border border-gray-200 bg-gray-50 p-5 transition-shadow hover:shadow-md">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-audit-medics-dark to-audit-iv-dark text-sm font-bold text-white">
                {o.icon}
              </div>
              <div>
                <h3 className="mb-1 text-base font-bold text-gray-900">{o.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{o.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ===========================================================================
// Section 7b -- Roadmap
// ===========================================================================
function RoadmapSection() {
  return (
    <Section className="bg-audit-cream">
      <Reveal>
        <h2 className="mb-12 text-3xl font-bold text-audit-dark sm:text-4xl">
          Recommended Path Forward
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
            {ROADMAP.map((phase, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="relative">
                  {/* Circle node */}
                  <div
                    className="relative z-10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-audit-navy text-sm font-bold text-white shadow-md"
                    aria-hidden="true"
                  >
                    {phase.phase}
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-1 text-base font-bold text-gray-900">{phase.title}</h3>
                    <p className="mb-3 text-xs font-medium text-audit-iv-dark">{phase.timeframe}</p>
                    <ul className="space-y-1.5" role="list">
                      {phase.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-audit-navy/40" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
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
          {ROADMAP.map((phase, i) => (
            <Reveal key={i} delay={i * 100}>
              <div className="relative mb-10 last:mb-0">
                {/* Circle node */}
                <div
                  className="absolute -left-[2.55rem] top-0 flex h-10 w-10 items-center justify-center rounded-full bg-audit-navy text-sm font-bold text-white shadow-md"
                  aria-hidden="true"
                >
                  {phase.phase}
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-1 text-base font-bold text-gray-900">{phase.title}</h3>
                  <p className="mb-3 text-xs font-medium text-audit-iv-dark">{phase.timeframe}</p>
                  <ul className="space-y-1.5" role="list">
                    {phase.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-audit-navy/40" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
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
// Section 8 -- Footer
// ===========================================================================
function FooterSection() {
  return (
    <footer className="bg-audit-navy px-6 py-16 text-center">
      <p className="text-lg font-semibold text-white">Prepared by Matt Cohen</p>
      <p className="mt-2 text-sm text-gray-300">
        Every finding independently verified.
      </p>
      <p className="mt-4 text-xs text-gray-400">atmix.org</p>
    </footer>
  );
}
