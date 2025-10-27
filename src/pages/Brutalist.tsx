export default function Brutalist() {
  return (
    <div className="min-h-screen bg-white text-black font-mono">
      <div className="max-w-2xl mx-auto px-6 py-16">

        {/* Header */}
        <header className="mb-24 border-b border-black pb-8">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <img
                src="logo.png"
                alt="atmix logo"
                className="w-12 h-12"
              />
              <div>
                <p className="text-sm text-gray-600">
                  audit trail mix<br />because the name was available and I thought it was funny
                </p>
              </div>
            </div>
            <a href="mailto:matt@atmix.org" className="hover:underline text-sm">
              matt@atmix.org
            </a>
          </div>
        </header>

        {/* Hero */}
        <section className="mb-24">
          <h2 className="text-4xl font-bold mb-8 leading-tight">
            Hi, I'm Matt.<br />I'm a CPA who does project-based work and fractional controller roles for companies that need their finance operations built right.
          </h2>
          <div className="space-y-6 text-lg leading-relaxed">
            <p>
              I'm not looking for full-time work - I'm enjoying life. But I like solving problems that involve building systems, implementing automations, and making workflows actually work. Most finance people think more work is better. I think the right tech stack matters more than working harder.
            </p>
            <p>
              Also: I bake a lot of bread, ride bikes up mountains, and have two dogs who think they're helping.
            </p>
          </div>
        </section>

        {/* Background */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-6 border-b border-black pb-2">Background</h3>
          <div className="space-y-4 leading-relaxed">
            <p>
              I started in audit (because that's what you do), moved to forensics (more interesting problems), then jumped to private industry as employee #5 at a startup.
            </p>
            <p>
              I built the entire finance and accounting function from scratch and scaled it to 150 employees through a liquidity event. A couple highlights:
            </p>
            <ul className="list-none space-y-3 ml-4 border-l-2 border-black pl-6">
              <li>
                Migrated from QuickBooks to NetSuite in 20 days without professional services. They were taking too long, so I just did it.
              </li>
              <li>
                Built systems to process $85MM in monthly AP - about 4,000 invoices - with 1.5 FTEs. Every invoice fully audited against POs. Math works when you don't do it manually.
              </li>
            </ul>
            <p>
              On the side, I built an accounting practice that started as helping friends and grew into something real. Sold it on Tax Day 2025 - I took it from zero to one, and the new owner is taking it to the next level. I'm excited about that. Still happy to make intros if you need a great accountant.
            </p>
          </div>
        </section>

        {/* How I Think */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-6 border-b border-black pb-2">How I Think</h3>
          <div className="space-y-4 leading-relaxed">
            <p>
              The right systems, automations, and tech stack can save hundreds of hours and prevent countless mistakes. I've spent my career building finance operations that scale without adding headcount proportionally.
            </p>
            <p>
              I care about making finance operations efficient, not just compliant. Building systems that prevent problems instead of catching them late. Using technology as a leverage point, not a checkbox. Doing work that compounds over time.
            </p>
          </div>
        </section>

        {/* Things I've Built */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-6 border-b border-black pb-2">Things I've Built</h3>
          <div className="space-y-8">
            <div>
              <h4 className="font-bold text-xl mb-2">An Accounting Practice</h4>
              <p className="leading-relaxed">
                Started as a side hustle, grew it into something real, sold it because I wanted to build other things. The new owner is taking it to the next level.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-xl mb-2">Finance Operations That Scale</h4>
              <p className="leading-relaxed">
                Systems that don't drown you in month-end close. Board decks that don't take 40 hours to pull together. Processes that work when you're 10 people and still work when you're 150.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-xl mb-2">benchproof.app</h4>
              <p className="leading-relaxed">
                A tool (and Chrome extension) for bread bakers. Baking bread is technically fussy in annoying ways. I got tired of the friction, so I built something to fix it. Turns out other people had the same problem.
              </p>
            </div>
          </div>
        </section>

        {/* Outside Work */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-6 border-b border-black pb-2">Outside Work</h3>
          <div className="space-y-4 leading-relaxed">
            <p>
              Mountain biking, road biking, skiing. I like going up hills and then coming back down them.
            </p>
            <p>
              Baking bread. It's meditative until you realize you forgot to start your levain the night before.
            </p>
            <p>
              Two dogs who are convinced they're helping with all of the above.
            </p>
          </div>
        </section>

        {/* What I'm Open To */}
        <section className="mb-24 border border-black p-8">
          <h3 className="text-2xl font-bold mb-6">What I'm Open To</h3>
          <div className="space-y-4 leading-relaxed">
            <p>
              Project-based work and fractional controller roles where I can build or fix something:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Implement systems, automations, workflows</li>
              <li>Handle migrations and integrations</li>
              <li>Build scalable finance ops that don't require proportional hiring</li>
              <li>Fix broken processes before they get expensive</li>
            </ul>
            <p className="mt-6">
              Good fit if you're scaling and your finance ops are held together with spreadsheets and hope. You value efficiency over "we've always done it this way." You're willing to invest in the right tools.
            </p>
            <p>
              Not a fit if you need someone 40+ hours a week indefinitely, or you're looking for someone to just match receipts and send reports.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-6 border-b border-black pb-2">Let's Talk</h3>
          <p className="leading-relaxed mb-6">
            If something here resonates or you think we should work together on something:
          </p>
          <a
            href="mailto:matt@atmix.org"
            className="inline-block border-2 border-black px-8 py-4 text-lg font-bold hover:bg-black hover:text-white transition-colors"
          >
            matt@atmix.org
          </a>
          <p className="mt-8 leading-relaxed">
            I look forward to hearing from you.
          </p>
        </section>

        {/* Footer */}
        <footer className="border-t border-black pt-8 text-sm text-gray-600">
          <p>© 2025 Matt Cohen</p>
        </footer>

      </div>
    </div>
  );
}
