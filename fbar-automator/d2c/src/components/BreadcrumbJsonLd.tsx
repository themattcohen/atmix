"use client";

import { usePathname } from "next/navigation";
import { JsonLd } from "./JsonLd";

const SEGMENT_LABELS: Record<string, string> = {
  "how-it-works": "How It Works",
  pricing: "Pricing",
  faq: "FAQ",
  about: "About",
  compare: "Compare",
  fbar: "FBAR",
  contact: "Contact",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  blog: "Blog",
  "best-fbar-filing-services-2026": "Best FBAR Filing Services 2026",
  "fbar-direct-vs-bsa-efiling": "FBAR Direct vs BSA E-Filing",
  "fbar-direct-vs-cpa": "FBAR Direct vs CPA",
};

function formatSegment(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ??
    segment
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function BreadcrumbJsonLd() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const items = [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://fbardirect.com" },
    ...segments.map((seg, i) => ({
      "@type": "ListItem",
      position: i + 2,
      name: formatSegment(seg),
      item: `https://fbardirect.com/${segments.slice(0, i + 1).join("/")}`,
    })),
  ];

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items,
      }}
    />
  );
}
