import React from 'react';

interface TrustBarProps {
  rating: string;
  reviewCount: string;
}

export function TrustBar({ rating, reviewCount }: TrustBarProps): React.ReactElement {
  const ratingNum = parseFloat(rating) || 5;
  const fullStars = Math.floor(ratingNum);

  return (
    <div className="tw-result-trust" aria-label={`${rating} out of 5 stars, ${reviewCount} reviews`}>
      <div className="tw-result-stars" aria-hidden="true">
        {Array.from({ length: fullStars }, (_, i) => (
          <span key={i} className="tw-star">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1.2l1.8 3.6 4 .6-2.9 2.8.7 4L8 10.1l-3.6 1.9.7-4L2.2 5.4l4-.6L8 1.2z" />
            </svg>
          </span>
        ))}
      </div>
      <span className="tw-result-reviews">
        {reviewCount} 5-Star Reviews
      </span>
    </div>
  );
}
