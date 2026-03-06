import Link from 'next/link';

interface CallToActionProps {
  heading?: string;
  description?: string;
  buttonText?: string;
  buttonHref?: string;
  variant?: 'default' | 'light';
}

export function CallToAction({
  heading = 'Ready to Get Started?',
  description = 'Schedule a free 15-minute consultation to discuss your tax situation and how we can help.',
  buttonText = 'Schedule a Consultation',
  buttonHref = '/schedule',
  variant = 'default',
}: CallToActionProps) {
  const isLight = variant === 'light';

  return (
    <section
      className={`section-padding ${isLight ? 'bg-alpine-cream' : 'bg-alpine-blue'}`}
    >
      <div className="container-content text-center">
        <h2
          className={`text-3xl md:text-4xl mb-4 ${isLight ? 'text-alpine-blue' : 'text-white'}`}
        >
          {heading}
        </h2>
        <p
          className={`text-lg mb-8 max-w-2xl mx-auto ${isLight ? 'text-text-secondary' : 'text-white/90'}`}
        >
          {description}
        </p>
        <Link href={buttonHref} className="btn-primary">
          {buttonText}
        </Link>
      </div>
    </section>
  );
}
