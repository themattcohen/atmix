export default function Walkies() {
  return (
    <div className="walkies-grain font-dm bg-walkies-cream text-walkies-bark leading-relaxed overflow-x-hidden">
      {/* Navigation */}
      <nav className="py-6 fixed w-full top-0 z-50 walkies-nav-gradient">
        <div className="max-w-[1100px] mx-auto px-6 flex justify-between items-center">
          <a href="#" className="font-fraunces text-2xl font-bold text-walkies-forest no-underline flex items-center gap-2">
            <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2"/>
              <path d="M10 18 Q16 24 22 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <circle cx="11" cy="12" r="2" fill="currentColor"/>
              <circle cx="21" cy="12" r="2" fill="currentColor"/>
            </svg>
            walkies
          </a>
          <a href="#book" className="bg-walkies-forest text-walkies-cream py-3 px-6 rounded-full no-underline font-medium text-sm transition-all hover:bg-walkies-bark hover:-translate-y-0.5">
            Book a Walkie
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex items-center pt-32 pb-20 relative">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="max-w-[720px]">
            <span className="inline-block bg-walkies-trail text-walkies-bark py-2 px-4 rounded-full text-sm font-medium mb-8 animate-fade-slide-up">
              🚶 Not a webinar. Not a mastermind.
            </span>
            <h1 className="font-fraunces text-5xl md:text-6xl lg:text-7xl font-semibold text-walkies-forest mb-6 leading-tight animate-fade-slide-up-1">
              Let's go for a <em className="italic text-walkies-sage">walkie</em>
            </h1>
            <p className="text-xl text-walkies-bark mb-4 opacity-85 animate-fade-slide-up-2">
              You walk. I walk. We talk about whatever's breaking your business.
            </p>
            <p className="text-lg text-walkies-bark opacity-70 mb-10 max-w-[540px] animate-fade-slide-up-3">
              1-2 hours on the phone with someone who's seen the chaos before—and somehow survived it. No slides. No frameworks. Just real conversation while we both get our steps in.
            </p>
            <a href="#book" className="inline-flex items-center gap-3 bg-walkies-forest text-walkies-cream py-4 px-9 rounded-full no-underline font-semibold text-lg transition-all hover:bg-walkies-bark hover:-translate-y-1 hover:shadow-xl animate-fade-slide-up-4 group">
              Book a Walkie
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
          </div>
        </div>
        {/* Floating shapes */}
        <div className="absolute right-[5%] top-1/2 -translate-y-1/2 w-[400px] h-[400px] opacity-60 hidden lg:block">
          <div className="absolute w-44 h-44 bg-walkies-sage rounded-full top-[20%] left-[30%] animate-float" />
          <div className="absolute w-28 h-28 bg-walkies-trail rounded-full top-1/2 left-[60%] animate-float" style={{ animationDelay: '-2s' }} />
          <div className="absolute w-20 h-20 bg-walkies-sunrise rounded-full top-[70%] left-[20%] animate-float" style={{ animationDelay: '-4s' }} />
        </div>
      </section>

      {/* Anti-pitch */}
      <section className="py-24 bg-walkies-forest text-walkies-cream relative overflow-hidden walkies-anti-quote">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-fraunces text-4xl font-semibold mb-6">
                Other people call it <span className="line-through opacity-50">coaching</span>
              </h2>
              <p className="text-lg leading-relaxed opacity-90">
                I'm a CPA who's been employee #5 at a startup that hit 150 people, built systems that pushed $85 million through AP every month, and just sold an accounting practice on Tax Day. I've also failed at a bunch of stuff—which is honestly more useful.
                <br /><br />
                So when your CFO quits mid-fundraise or your books look like a crime scene, I've probably seen it. Or something weirder.
              </p>
            </div>
            <ul className="space-y-0">
              {[
                { fake: 'Leadership Summit', real: '→ A phone call' },
                { fake: 'Strategic Advisory Session', real: '→ A phone call' },
                { fake: 'C-Suite Mastermind', real: '→ Still just a phone call' },
                { fake: 'Executive Coaching Package', real: '→ Walking and talking' },
              ].map((item, i) => (
                <li key={i} className="py-5 border-b border-white/10 flex items-start gap-4 text-lg">
                  <span className="line-through opacity-40 flex-1">{item.fake}</span>
                  <span className="text-walkies-sunrise flex-1 font-medium">{item.real}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-28">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="font-fraunces text-4xl font-semibold text-walkies-forest mb-4">Dead simple</h2>
            <p className="text-lg text-walkies-bark opacity-70 max-w-md mx-auto">
              No intake forms. No "discovery calls" to book the real call. Just book it.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { num: '1', title: 'You book', desc: 'Pick a time. Grab your walking shoes. That\'s the prep.' },
              { num: '2', title: 'We walk', desc: '1-2 hours, wherever you are. I\'ll be outside too. Bring the dog if you want.' },
              { num: '3', title: 'You leave with clarity', desc: 'A plan, a gut-check, a new way to think about it—or just validation that you\'re not crazy.' },
            ].map((step) => (
              <div key={step.num} className="text-center p-10 bg-walkies-warm-white rounded-3xl border border-walkies-sage/20 transition-all hover:-translate-y-2 hover:shadow-xl">
                <div className="w-14 h-14 bg-walkies-trail rounded-full flex items-center justify-center font-fraunces text-2xl font-bold text-walkies-bark mx-auto mb-6">
                  {step.num}
                </div>
                <h3 className="font-fraunces text-xl font-semibold text-walkies-forest mb-3">{step.title}</h3>
                <p className="text-walkies-bark opacity-70">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problems */}
      <section className="py-24 walkies-problems-gradient text-walkies-cream">
        <div className="max-w-[1100px] mx-auto px-6">
          <h2 className="font-fraunces text-4xl font-semibold text-center mb-16">Stuff I can actually help with</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { emoji: '💸', title: '"Our cash flow is a mystery"', desc: 'Forecasting, runway, burn rate—figuring out what\'s actually happening with your money.' },
              { emoji: '📊', title: '"We\'re scaling and everything\'s on fire"', desc: 'Migrated startups from QuickBooks to real systems. Happy to talk you off the ledge.' },
              { emoji: '🔍', title: '"Something feels off in the numbers"', desc: 'Forensic accounting background. I can help you figure out what\'s actually going on.' },
              { emoji: '🎯', title: '"We need a finance person but can\'t afford one"', desc: 'Fractional controller work, interim help, or just figuring out what role you actually need.' },
              { emoji: '🚀', title: '"Investors want numbers I don\'t have"', desc: 'Due diligence prep, financial models, making sure you don\'t look like an amateur.' },
              { emoji: '🤷', title: '"I just need to talk to someone who gets it"', desc: 'Sometimes you don\'t need a solution. You need someone to think out loud with.' },
            ].map((problem, i) => (
              <div key={i} className="walkies-glass p-8 rounded-2xl border border-white/10 transition-all hover:bg-white/15 hover:-translate-y-1">
                <h4 className="font-fraunces text-xl font-semibold mb-3 flex items-center gap-3">
                  {problem.emoji} {problem.title}
                </h4>
                <p className="opacity-85 text-sm">{problem.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-28 bg-walkies-warm-white">
        <div className="max-w-[1100px] mx-auto px-6">
          <h2 className="font-fraunces text-4xl font-semibold text-walkies-forest text-center mb-16">People seemed to like it</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { text: 'Booked expecting standard consulting advice. Got two hours of someone who actually listened and told me the thing I didn\'t want to hear but needed to. Worth every penny.', name: 'Sarah K.', role: 'Series A Founder', initial: 'S' },
              { text: 'I\'ve done the executive coaches. The masterminds. This was different—like calling the one friend who actually knows finance and won\'t sugarcoat it.', name: 'Marcus T.', role: 'CEO, 40-person SaaS', initial: 'M' },
              { text: 'The walking thing seemed gimmicky until I realized I think better on my feet too. Somehow made a stressful conversation about runway feel like a normal talk with a smart friend.', name: 'Jamie R.', role: 'COO, E-commerce', initial: 'J' },
            ].map((testimonial, i) => (
              <div key={i} className="bg-walkies-cream p-10 rounded-2xl border border-walkies-trail relative walkies-quote">
                <p className="text-base leading-relaxed text-walkies-bark mb-6 relative z-10">
                  {testimonial.text}
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-walkies-sage rounded-full flex items-center justify-center font-fraunces font-bold text-walkies-cream">
                    {testimonial.initial}
                  </div>
                  <div>
                    <h5 className="font-semibold text-walkies-forest">{testimonial.name}</h5>
                    <span className="text-sm text-walkies-bark opacity-60">{testimonial.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="py-20 border-t border-walkies-trail">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-16 items-start">
            <div className="flex-1">
              <h3 className="font-fraunces text-2xl font-semibold text-walkies-forest mb-4">The boring stuff, since you're probably wondering</h3>
              <p className="text-walkies-bark opacity-80 text-lg leading-relaxed">
                CPA. Built and sold an accounting practice. Spent years doing audit and forensics (the "something's wrong with these books" kind). Was employee #5 at a startup that grew to 150 people through a liquidity event—so yes, I've lived the chaos. Currently do fractional controller work for companies that need senior finance help without the full-time hire.
              </p>
            </div>
            <div className="flex gap-10 md:gap-16 shrink-0 w-full md:w-auto justify-around md:justify-start">
              <div className="text-center">
                <span className="font-fraunces text-4xl font-bold text-walkies-forest block">$85M</span>
                <span className="text-sm text-walkies-bark opacity-60">Monthly AP managed</span>
              </div>
              <div className="text-center">
                <span className="font-fraunces text-4xl font-bold text-walkies-forest block">5→150</span>
                <span className="text-sm text-walkies-bark opacity-60">Startup growth lived</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="book" className="py-28 bg-walkies-bark text-walkies-cream text-center">
        <div className="max-w-[1100px] mx-auto px-6">
          <h2 className="font-fraunces text-4xl md:text-5xl font-semibold mb-4">
            Ready for a <em className="italic text-walkies-sunrise">walkie</em>?
          </h2>
          <p className="text-xl opacity-80 mb-10 max-w-md mx-auto">
            Grab a time. We'll figure out the rest on the walk.
          </p>
          <a href="#" className="inline-flex items-center gap-3 bg-walkies-cream text-walkies-bark py-5 px-12 rounded-full no-underline font-semibold text-lg transition-all hover:-translate-y-1 hover:shadow-2xl group">
            Book Your Walkie
            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
          <p className="mt-6 text-sm opacity-50">No commitment, no weird follow-up sequences. Just a conversation.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-walkies-bark border-t border-white/10">
        <div className="max-w-[1100px] mx-auto px-6 flex justify-between items-center">
          <p className="text-walkies-cream opacity-50 text-sm">© 2025 Walkies</p>
          <a href="mailto:matt@atmix.org" className="text-walkies-cream opacity-70 no-underline hover:opacity-100 transition-opacity">
            Get in touch
          </a>
        </div>
      </footer>
    </div>
  );
}
