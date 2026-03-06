import Link from 'next/link';

interface ServiceCardProps {
  title: string;
  description: string;
  href: string;
  startingPrice?: number;
}

export function ServiceCard({ title, description, href, startingPrice }: ServiceCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow duration-200">
      <h3 className="text-xl font-heading font-bold text-alpine-blue mb-3">{title}</h3>
      <p className="text-text-secondary mb-4 leading-relaxed">{description}</p>
      {startingPrice && (
        <p className="text-sm text-text-secondary mb-4">
          Starting at <span className="font-semibold text-text-primary">${startingPrice.toLocaleString()}</span>
        </p>
      )}
      <Link
        href={href}
        className="inline-flex items-center text-alpine-teal font-semibold hover:underline"
      >
        Learn More
        <span className="ml-1" aria-hidden="true">&rarr;</span>
      </Link>
    </div>
  );
}
