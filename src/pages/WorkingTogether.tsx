import { useEffect } from 'react';
import content from '../../content/pages/working-together.json';

export default function WorkingTogether() {
  useEffect(() => {
    document.title = 'Working Together - Audit Trail Mix';
  }, []);

  return (
    <div className="min-h-screen bg-white text-black font-mono">
      <div className="max-w-[680px] mx-auto px-6 py-16">

        {/* Header */}
        <header className="mb-20 pb-6 border-b border-black">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt={content.header.logoAlt}
              className="w-7 h-7"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm">audit trail mix</span>
              <span className="text-xs text-gray-500">{content.header.tagline}</span>
            </div>
          </div>
        </header>

        <main>
          {/* Title */}
          <h1 className="text-[28px] font-bold leading-tight mb-8 tracking-tight">
            {content.title}
          </h1>

          {/* Intro */}
          <div className="text-lg mb-12 pb-12 border-b border-gray-200">
            {content.intro.paragraphs.map((p, i) => (
              <p key={i} className={`mb-5 ${i === content.intro.paragraphs.length - 1 ? 'font-bold mb-0' : ''}`}>
                {p.text}
              </p>
            ))}
          </div>

          {/* Main Sections */}
          {content.sections.map((section, sectionIndex) => (
            <section key={sectionIndex} className="mb-12">
              <h2 className="text-sm font-bold uppercase tracking-wider text-black mt-16 mb-6">
                {section.heading}
              </h2>
              {section.content.map((item, itemIndex) => {
                if (item.type === 'pullquote') {
                  return (
                    <p key={itemIndex} className="text-xl leading-relaxed my-10 pl-5 border-l-[3px] border-black italic">
                      {item.text}
                    </p>
                  );
                }
                return (
                  <p key={itemIndex} className="mb-5 leading-relaxed">
                    {item.text}
                  </p>
                );
              })}
            </section>
          ))}

          {/* Not Right For */}
          <section className="mb-12">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black mt-16 mb-6">
              {content.notRightFor.heading}
            </h2>
            <ul className="mb-6 pl-0 list-none">
              {content.notRightFor.items.map((item, i) => (
                <li key={i} className="mb-4 pl-6 relative before:content-['-'] before:absolute before:left-0">
                  {item.text}
                </li>
              ))}
            </ul>
          </section>

          {/* Good Fit For */}
          <section className="mb-12">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black mb-6">
              {content.goodFitFor.heading}
            </h2>
            <ul className="mb-6 pl-0 list-none">
              {content.goodFitFor.items.map((item, i) => (
                <li key={i} className="mb-4 pl-6 relative before:content-['-'] before:absolute before:left-0">
                  {item.text}
                </li>
              ))}
            </ul>
          </section>

          {/* Contact */}
          <div className="mt-20 pt-10 border-t border-black text-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black mt-0 mb-6">
              {content.contact.heading}
            </h2>
            <p className="mb-5">{content.contact.text}</p>
            <p>
              <a
                href={`mailto:${content.contact.email}`}
                className="text-xl text-black no-underline hover:underline"
              >
                {content.contact.email}
              </a>
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-20 text-xs text-gray-500 text-center">
          &copy; {content.footer.copyright}
        </footer>

      </div>
    </div>
  );
}
