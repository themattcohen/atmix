import { Link } from 'react-router-dom';

interface Project {
  title: string;
  description: string;
  url: string;
  lastUpdated: string;
  host: string;
  hostUrl: string;
}

const projects: Project[] = [
  {
    title: 'atmix audit engine',
    description:
      'Interactive audit workflow powered by AI. Upload financial documents, review analysis plans, approve findings, and generate comprehensive audit reports — all with human-in-the-loop approval gates at every step.',
    url: 'https://atmix-audit-engine.streamlit.app/',
    lastUpdated: 'February 2026',
    host: 'Streamlit Community Cloud',
    hostUrl: 'https://share.streamlit.io/',
  },
  {
    title: 'ice creamery',
    description:
      '120+ tested Ninja Creami recipes with full nutritional data, scoopability scores (FPDF/PAC), and scientific formulation. Searchable, filterable, and designed for making frozen desserts that actually work.',
    url: '/creami',
    lastUpdated: 'February 2026',
    host: 'atmix.org',
    hostUrl: 'https://atmix.org',
  },
  {
    title: 'tonal exporter',
    description:
      "Personal tool for exporting workout data from Tonal's undocumented API. Authenticates via their mobile app's OAuth2 flow, syncs incrementally with token caching and retry logic, and outputs structured JSON for analysis.",
    url: '',
    lastUpdated: 'February 2026',
    host: 'local CLI',
    hostUrl: '',
  },
];

export default function Projects() {
  return (
    <div className="min-h-screen bg-white text-black font-mono">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="mb-24 border-b border-black pb-8">
          <div className="flex items-center gap-4">
            <Link to="/">
              <img
                src="/logo.png"
                alt="atmix logo"
                className="w-12 h-12"
              />
            </Link>
            <div>
              <p className="text-sm text-gray-600">
                <Link to="/" className="hover:text-black transition-colors">
                  atmix.org
                </Link>
                {' / projects'}
              </p>
            </div>
          </div>
        </header>

        {/* Title */}
        <section className="mb-16">
          <h1 className="text-4xl font-bold mb-4 leading-tight">Projects</h1>
          <p className="text-lg leading-relaxed text-gray-700">
            Things I've built that are live and usable.
          </p>
        </section>

        {/* Project List */}
        <section className="mb-24 space-y-12">
          {projects.map((project, i) => (
            <article key={i} className="border border-black p-8">
              <h2 className="text-2xl font-bold mb-4">
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-black hover:text-white transition-colors"
                  >
                    {project.title} &rarr;
                  </a>
                ) : (
                  <span>{project.title}</span>
                )}
              </h2>
              <p className="leading-relaxed mb-6">{project.description}</p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  Last updated: <span className="text-black">{project.lastUpdated}</span>
                </p>
                <p>
                  {project.hostUrl ? (
                    <>
                      Hosted on{' '}
                      <a
                        href={project.hostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-black transition-colors"
                      >
                        {project.host}
                      </a>
                    </>
                  ) : (
                    <>{project.host}</>
                  )}
                </p>
              </div>
            </article>
          ))}
        </section>

        {/* Back */}
        <section className="mb-24">
          <Link
            to="/"
            className="inline-block border-2 border-black px-8 py-4 text-lg font-bold hover:bg-black hover:text-white transition-colors"
          >
            &larr; Back to home
          </Link>
        </section>

        {/* Footer */}
        <footer className="border-t border-black pt-8 text-sm text-gray-600">
          <p>&copy; 2025 Matt Cohen</p>
        </footer>
      </div>
    </div>
  );
}
