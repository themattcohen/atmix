export default function Warm() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A]">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-20">

        {/* Header */}
        <header className="mb-16 md:mb-24 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <img
              src="logo.png"
              alt="atmix logo"
              className="w-14 h-14 md:w-16 md:h-16"
            />
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#B86B4F]">
                atmix.org
              </h1>
              <p className="text-sm text-gray-600 mt-1 italic">
                audit trail mix - because the name was available and I thought it was funny
              </p>
            </div>
          </div>
          <a
            href="mailto:matt@atmix.org"
            className="hidden md:inline-block bg-[#B86B4F] text-white px-6 py-3 rounded hover:bg-[#A05840] transition-colors"
          >
            Get in touch
          </a>
        </header>

        {/* Hero */}
        <section className="mb-20 md:mb-32">
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-8 leading-tight text-[#2A2A2A]">
            Hi, I'm Matt Cohen. I'm a CPA who does project-based work and fractional controller roles for companies that need their finance operations built right.
          </h2>
          <div className="space-y-6 text-lg leading-relaxed text-gray-700">
            <p>
              I'm not looking for full-time work - I'm enjoying life. But I like solving problems that involve building systems, implementing automations, and making workflows actually work. Most finance people think more work is better. I think the right tech stack matters more than working harder.
            </p>
            <p>
              Also: I bake a lot of bread, ride bikes up mountains, and have two dogs who think they're helping.
            </p>
          </div>
        </section>

        {/* Background */}
        <section className="mb-20 md:mb-32">
          <h3 className="text-2xl md:text-3xl font-serif font-bold mb-8 text-[#2A2A2A]">
            Background
          </h3>
          <div className="space-y-6 text-lg leading-relaxed text-gray-700">
            <p>
              I started in audit (because that's what you do), moved to forensics (more interesting problems), then jumped to private industry as employee #5 at a startup.
            </p>
            <p>
              I built the entire finance and accounting function from scratch and scaled it to 150 employees through a liquidity event. Some highlights:
            </p>
            <ul className="space-y-4 ml-6">
              <li className="pl-6 border-l-3 border-[#B86B4F]">
                Migrated from QuickBooks to NetSuite in 20 days without professional services. They were taking too long, so I just did it.
              </li>
              <li className="pl-6 border-l-3 border-[#B86B4F]">
                Built systems to process $85MM in monthly AP - about 4,000 invoices - with 1.5 FTEs. Every invoice fully audited against POs. Math works when you don't do it manually.
              </li>
            </ul>
            <p>
              On the side, I built an accounting practice that started as helping friends and grew into something real. Sold it on Tax Day 2025 - I took it from zero to one, and the new owner is taking it to the next level. I'm excited about that. Still happy to make intros if you need a great accountant.
            </p>
          </div>
        </section>

        {/* How I Think */}
        <section className="mb-20 md:mb-32 bg-white rounded-lg p-8 md:p-12 shadow-sm">
          <h3 className="text-2xl md:text-3xl font-serif font-bold mb-8 text-[#2A2A2A]">
            How I Think
          </h3>
          <div className="space-y-6 text-lg leading-relaxed text-gray-700">
            <p>
              The right systems, automations, and tech stack can save hundreds of hours and prevent countless mistakes. I've spent my career building finance operations that scale without adding headcount proportionally.
            </p>
            <p>
              I care about making finance operations efficient, not just compliant. Building systems that prevent problems instead of catching them late. Using technology as a leverage point, not a checkbox. Doing work that compounds over time.
            </p>
          </div>
        </section>

        {/* Things I've Built */}
        <section className="mb-20 md:mb-32">
          <h3 className="text-2xl md:text-3xl font-serif font-bold mb-8 text-[#2A2A2A]">
            Things I've Built
          </h3>
          <div className="space-y-10">
            <div className="border-l-4 border-[#B86B4F] pl-6">
              <h4 className="font-bold text-xl md:text-2xl mb-3 text-[#2A2A2A]">
                An Accounting Practice
              </h4>
              <p className="leading-relaxed text-gray-700">
                Started as a side hustle, grew it into something real, sold it because I wanted to build other things. The new owner is taking it to the next level.
              </p>
            </div>
            <div className="border-l-4 border-[#B86B4F] pl-6">
              <h4 className="font-bold text-xl md:text-2xl mb-3 text-[#2A2A2A]">
                Finance Operations That Scale
              </h4>
              <p className="leading-relaxed text-gray-700">
                Systems that don't drown you in month-end close. Board decks that don't take 40 hours to pull together. Processes that work when you're 10 people and still work when you're 150.
              </p>
            </div>
            <div className="border-l-4 border-[#B86B4F] pl-6">
              <h4 className="font-bold text-xl md:text-2xl mb-3 text-[#2A2A2A]">
                benchproof.app
              </h4>
              <p className="leading-relaxed text-gray-700">
                A tool (and Chrome extension) for bread bakers. Baking bread is technically fussy in annoying ways. I got tired of the friction, so I built something to fix it. Turns out other people had the same problem.
              </p>
            </div>
          </div>
        </section>

        {/* Outside Work */}
        <section className="mb-20 md:mb-32 text-center">
          <h3 className="text-2xl md:text-3xl font-serif font-bold mb-8 text-[#2A2A2A]">
            Outside Work
          </h3>
          <div className="space-y-4 text-lg leading-relaxed text-gray-700 max-w-2xl mx-auto">
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
        <section className="mb-20 md:mb-32 bg-[#F5F3F0] rounded-lg p-8 md:p-12">
          <h3 className="text-2xl md:text-3xl font-serif font-bold mb-8 text-[#2A2A2A]">
            What I'm Open To
          </h3>
          <div className="space-y-6 text-lg leading-relaxed text-gray-700">
            <p>
              Project-based work and fractional controller roles where I can build or fix something:
            </p>
            <ul className="space-y-3 ml-6">
              <li className="flex items-start">
                <span className="text-[#B86B4F] mr-3">•</span>
                <span>Implement systems, automations, workflows</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#B86B4F] mr-3">•</span>
                <span>Handle migrations and integrations</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#B86B4F] mr-3">•</span>
                <span>Build scalable finance ops that don't require proportional hiring</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#B86B4F] mr-3">•</span>
                <span>Fix broken processes before they get expensive</span>
              </li>
            </ul>
            <div className="mt-8 pt-8 border-t border-gray-300">
              <p className="font-semibold text-[#2A2A2A] mb-2">Good fit:</p>
              <p>
                You're scaling and your finance ops are held together with spreadsheets and hope. You value efficiency over "we've always done it this way." You're willing to invest in the right tools.
              </p>
            </div>
            <div className="mt-6">
              <p className="font-semibold text-[#2A2A2A] mb-2">Not a fit:</p>
              <p>
                You need someone 40+ hours a week indefinitely, or you're looking for someone to just match receipts and send reports.
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="mb-20 text-center">
          <h3 className="text-2xl md:text-3xl font-serif font-bold mb-6 text-[#2A2A2A]">
            Let's Talk
          </h3>
          <p className="leading-relaxed mb-8 text-gray-700 text-lg">
            If something here resonates or you think we should work together on something:
          </p>
          <a
            href="mailto:matt@atmix.org"
            className="inline-block bg-[#B86B4F] text-white px-10 py-4 text-lg rounded hover:bg-[#A05840] transition-colors shadow-sm"
          >
            matt@atmix.org
          </a>
          <p className="mt-8 leading-relaxed text-gray-600">
            I look forward to hearing from you.
          </p>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-300 pt-8 text-sm text-gray-500 text-center">
          <p>© 2025 Matt Cohen</p>
        </footer>

      </div>
    </div>
  );
}
