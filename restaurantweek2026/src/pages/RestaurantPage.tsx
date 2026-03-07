import { useParams, Link } from 'react-router-dom';
import restaurantsData from '../data/restaurants.json';
import { type Restaurant } from '../lib/types';

const allRestaurants: Restaurant[] = restaurantsData as Restaurant[];

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export default function RestaurantPage() {
  const { slug } = useParams<{ slug: string }>();
  const restaurant = allRestaurants.find((r) => r.slug === slug);

  if (!restaurant) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Restaurant Not Found</h1>
        <Link to="/" className="text-red-700 hover:underline">Back to all restaurants</Link>
      </div>
    );
  }

  const hasHours = Object.values(restaurant.hours).some((h) => h.open);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/" className="text-sm text-red-700 hover:underline mb-6 inline-block">
        &larr; Back to all restaurants
      </Link>

      {/* Header */}
      <div className="mb-8">
        {restaurant.image && (
          <img
            src={restaurant.image}
            alt={restaurant.name}
            className="w-full h-64 object-cover rounded-xl mb-6"
          />
        )}
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{restaurant.name}</h1>

        {restaurant.cuisines.length > 0 && (
          <p className="text-lg text-red-700 font-medium mb-2">
            {restaurant.cuisines.join(' | ')}
          </p>
        )}

        {restaurant.price_point && (
          <p className="text-lg font-semibold text-green-700 mb-2">
            ${restaurant.price_point} prix fixe
          </p>
        )}

        {restaurant.neighborhoods.length > 0 && (
          <p className="text-slate-600 mb-1">{restaurant.neighborhoods.join(', ')}</p>
        )}

        {restaurant.address && (
          <p className="text-slate-500 text-sm mb-1">
            {restaurant.google_maps_url ? (
              <a href={restaurant.google_maps_url} target="_blank" rel="noopener noreferrer" className="hover:text-red-700 hover:underline">
                {restaurant.address}
              </a>
            ) : (
              restaurant.address
            )}
          </p>
        )}

        {restaurant.phone && (
          <p className="text-slate-500 text-sm mb-1">
            <a href={`tel:${restaurant.phone}`} className="hover:text-red-700">{restaurant.phone}</a>
          </p>
        )}

        <div className="flex flex-wrap gap-3 mt-3">
          {restaurant.website && (
            <a
              href={restaurant.website.startsWith('http') ? restaurant.website : `https://${restaurant.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-700 hover:underline text-sm"
            >
              Website
            </a>
          )}
          {restaurant.instagram && (
            <a
              href={restaurant.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-700 hover:underline text-sm"
            >
              Instagram
            </a>
          )}
          {restaurant.facebook && (
            <a
              href={restaurant.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-700 hover:underline text-sm"
            >
              Facebook
            </a>
          )}
          {restaurant.open_table_id && (
            <a
              href={`https://www.opentable.com/restref/client/?rid=${restaurant.open_table_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-700 hover:underline text-sm"
            >
              Reserve on OpenTable
            </a>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-8">
        {restaurant.features.map((f) => (
          <span key={f} className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">
            {f}
          </span>
        ))}
        {restaurant.dietary.map((d) => (
          <span key={d} className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
            {d}
          </span>
        ))}
        {restaurant.amenities.map((a) => (
          <span key={a} className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
            {a}
          </span>
        ))}
      </div>

      {/* Menu Courses */}
      {restaurant.courses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Restaurant Week Menu
          </h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-6 space-y-6">
              {restaurant.courses.map((course, ci) => (
                <div key={ci} className={ci > 0 ? 'border-t border-slate-100 pt-6' : ''}>
                  <h4 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">
                    {course.name}
                  </h4>
                  <ul className="space-y-3">
                    {course.items.map((item, ii) => (
                      <li key={ii}>
                        <span className="font-medium text-slate-900">{item.name}</span>
                        {item.description && (
                          <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hours */}
      {(hasHours || restaurant.hours_notes) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Hours</h2>
          {restaurant.hours_notes && (
            <p className="text-sm text-slate-600 mb-3 whitespace-pre-line">{restaurant.hours_notes}</p>
          )}
          {hasHours && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(DAY_LABELS).map(([day, label]) => {
                const h = restaurant.hours[day];
                return (
                  <div key={day} className="text-sm">
                    <span className="font-medium text-slate-700">{label}: </span>
                    {h?.open ? (
                      <span className="text-slate-600">{h.from} - {h.to}</span>
                    ) : (
                      <span className="text-slate-400">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Official DRW link */}
      {restaurant.url && (
        <div className="border-t border-slate-200 pt-6">
          <a
            href={restaurant.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors text-sm font-medium"
          >
            View on Denver Restaurant Week
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
