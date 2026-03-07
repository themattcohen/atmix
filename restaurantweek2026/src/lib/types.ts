export interface MenuItem {
  name: string;
  description: string;
}

export interface MenuCourse {
  name: string;
  items: MenuItem[];
}

export interface DayHours {
  open: boolean;
  from: string;
  to: string;
}

export interface Restaurant {
  id: number | string;
  name: string;
  slug: string;
  url: string;
  address: string;
  lat: string;
  lng: string;
  phone: string;
  website: string;
  email: string;
  instagram: string;
  facebook: string;
  image: string;
  cuisines: string[];
  cuisine_primary: string;
  neighborhoods: string[];
  amenities: string[];
  features: string[];
  dietary: string[];
  price_point: string;
  has_menu: boolean;
  menu_status: string;
  courses: MenuCourse[];
  hours: Record<string, DayHours>;
  hours_notes: string;
  google_maps_url: string;
  open_table_id: string;
}
