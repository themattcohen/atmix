import content from '../../content/pages/brutalist.json';

export default function Brutalist() {
  return (
    <div className="min-h-screen bg-white text-black font-mono">
      <div className="max-w-2xl mx-auto px-6 py-16">

        {/* Header */}
        <header className="mb-24 border-b border-black pb-8">
          <div className="flex items-center gap-4">
            <img
              src="logo.png"
              alt={content.header.logoAlt}
              className="w-12 h-12"
            />
            <div>
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {content.header.tagline}
              </p>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="mb-24">
          <h2 className="text-4xl font-bold mb-8 leading-tight whitespace-pre-line">
            {content.hero.heading}
          </h2>
          <div className="space-y-6 text-lg leading-relaxed">
            {content.hero.paragraphs.map((p, i) => (
              <p key={i}>{p.text}</p>
            ))}
          </div>
        </section>

        {/* Background */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-6 border-b border-black pb-2">
            {content.background.heading}
          </h3>
          <div className="space-y-4 leading-relaxed">
            {content.background.introParagraphs.map((p, i) => (
              <p key={i}>{p.text}</p>
            ))}
            <ul className="list-none space-y-3 ml-4 border-l-2 border-black pl-6">
              {content.background.highlights.map((h, i) => (
                <li key={i}>{h.text}</li>
              ))}
            </ul>
            {content.background.outroParagraphs.map((p, i) => (
              <p key={i}>{p.text}</p>
            ))}
          </div>
        </section>

        {/* How I Think */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-6 border-b border-black pb-2">
            {content.howIThink.heading}
          </h3>
          <div className="space-y-4 leading-relaxed">
            {content.howIThink.paragraphs.map((p, i) => (
              <p key={i}>{p.text}</p>
            ))}
          </div>
        </section>

        {/* Things I've Built */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-6 border-b border-black pb-2">
            {content.thingsBuilt.heading}
          </h3>
          <div className="space-y-8">
            {content.thingsBuilt.items.map((item, i) => (
              <div key={i}>
                <h4 className="font-bold text-xl mb-2">{item.title}</h4>
                <p className="leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Outside Work */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-6 border-b border-black pb-2">
            {content.outsideWork.heading}
          </h3>
          <div className="space-y-4 leading-relaxed">
            {content.outsideWork.paragraphs.map((p, i) => (
              <p key={i}>{p.text}</p>
            ))}
          </div>
        </section>

        {/* What I'm Open To */}
        <section className="mb-24 border border-black p-8">
          <h3 className="text-2xl font-bold mb-6">{content.openTo.heading}</h3>
          <div className="space-y-4 leading-relaxed">
            <p>{content.openTo.intro}</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              {content.openTo.bulletPoints.map((bp, i) => (
                <li key={i}>{bp.text}</li>
              ))}
            </ul>
            <p className="mt-6">{content.openTo.goodFit}</p>
            <p>{content.openTo.notAFit}</p>
          </div>
        </section>

        {/* Contact */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-6 border-b border-black pb-2">
            {content.contact.heading}
          </h3>
          <p className="leading-relaxed mb-6">{content.contact.text}</p>
          <a
            href={`mailto:${content.contact.email}`}
            className="inline-block border-2 border-black px-8 py-4 text-lg font-bold hover:bg-black hover:text-white transition-colors"
          >
            {content.contact.email}
          </a>
        </section>

        {/* Footer */}
        <footer className="border-t border-black pt-8 text-sm text-gray-600">
          <p>&copy; {content.footer.copyright}</p>
        </footer>

      </div>
    </div>
  );
}
