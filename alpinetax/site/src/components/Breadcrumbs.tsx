import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { siteConfig } from '@/lib/site-config';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const schemaItems = items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    ...(item.href ? { item: `${siteConfig.url}${item.href}` } : {}),
  }));

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: schemaItems,
        }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-text-secondary py-3">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.label} className="flex items-center gap-1">
                {index > 0 && (
                  <span aria-hidden="true" className="text-gray-400">&raquo;</span>
                )}
                {isLast ? (
                  <span className="font-semibold text-text-primary" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href || '/'} className="hover:text-alpine-teal transition-colors">
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
