import { getDb } from '../src/lib/db/client'
import { runMigrations } from '../src/lib/db/migrate'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOUR = 3_600_000
const DAY  = 86_400_000
const MIN  = 60_000

function fromNow(ms: number): string { return new Date(Date.now() + ms).toISOString() }
function ago(ms: number): string      { return new Date(Date.now() - ms).toISOString() }
function cents(dollars: number): number { return Math.round(dollars * 100) }

// ---------------------------------------------------------------------------
// Deterministic seeded RNG (LCG)
// ---------------------------------------------------------------------------

class SeededRng {
  private state: number
  constructor(seed = 42) { this.state = seed }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff
    return (this.state >>> 0) / 0x100000000
  }
  between(lo: number, hi: number): number { return lo + this.next() * (hi - lo) }
  int(lo: number, hi: number): number { return Math.floor(this.between(lo, hi + 1)) }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)] }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
}

const rng = new SeededRng(42)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Sport = 'baseball' | 'football' | 'basketball' | 'hockey' | 'nonsport'

interface Player {
  name: string
  sport: Sport
  position: string
  team: string
  peakYears: [number, number]
  tier: 'superstar' | 'star' | 'prospect' | 'legend'
}

interface CardSet {
  brand: string
  setName: string
  yearRange: [number, number]
  hasAutos: boolean
  hasPrizm: boolean
  hasRefractor: boolean
  parallel: string[]
}

interface Grade {
  label: string
  weight: number
  gradeMultiplier: number
}

interface PriceBucket {
  minDollars: number
  maxDollars: number
  count: number
}

interface SeedItem {
  item_id: string
  rank: number | null
  title: string
  current_price: number
  buy_it_now_price: number | null
  shipping_cost: number
  listing_type: string
  condition_name: string | null
  end_time: string | null
  time_left: string | null
  seller_id: string
  seller_feedback: number
  watcher_count: number
  bid_count: number
  image_url: string
  listing_url: string
  status: string
  is_in_queue: number
  notes: string | null
  first_seen_at: string
  last_synced_at: string
  sport: Sport
}

interface SnapshotRow {
  item_id: string
  price_cents: number
  shipping: number
  watcher_count: number | null
  bid_count: number
  recorded_at: string
}

interface EventRow {
  item_id: string
  event_type: string
  old_value: string | null
  new_value: string | null
  detected_at: string
}

// ---------------------------------------------------------------------------
// Player pool
// ---------------------------------------------------------------------------

const PLAYERS: Player[] = [
  // Baseball (28 players)
  { name: 'Mike Trout',          sport: 'baseball',    position: 'CF',  team: 'Angels',      peakYears: [2011, 2012], tier: 'superstar' },
  { name: 'Shohei Ohtani',       sport: 'baseball',    position: 'P/DH',team: 'Dodgers',     peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Ronald Acuña Jr',     sport: 'baseball',    position: 'RF',  team: 'Braves',      peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Juan Soto',           sport: 'baseball',    position: 'RF',  team: 'Mets',        peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Fernando Tatis Jr',   sport: 'baseball',    position: 'SS',  team: 'Padres',      peakYears: [2019, 2019], tier: 'superstar' },
  { name: 'Wander Franco',       sport: 'baseball',    position: 'SS',  team: 'Rays',        peakYears: [2021, 2021], tier: 'star'      },
  { name: 'Gunnar Henderson',    sport: 'baseball',    position: 'SS',  team: 'Orioles',     peakYears: [2023, 2023], tier: 'star'      },
  { name: 'Jackson Holliday',    sport: 'baseball',    position: '2B',  team: 'Orioles',     peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Paul Skenes',         sport: 'baseball',    position: 'SP',  team: 'Pirates',     peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Elly De La Cruz',     sport: 'baseball',    position: 'SS',  team: 'Reds',        peakYears: [2023, 2023], tier: 'prospect'  },
  { name: 'Julio Rodriguez',     sport: 'baseball',    position: 'CF',  team: 'Mariners',    peakYears: [2022, 2022], tier: 'star'      },
  { name: 'Jasson Dominguez',    sport: 'baseball',    position: 'CF',  team: 'Yankees',     peakYears: [2023, 2023], tier: 'prospect'  },
  { name: 'Ethan Salas',         sport: 'baseball',    position: 'C',   team: 'Padres',      peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Derek Jeter',         sport: 'baseball',    position: 'SS',  team: 'Yankees',     peakYears: [1993, 1993], tier: 'legend'    },
  { name: 'Mickey Mantle',       sport: 'baseball',    position: 'CF',  team: 'Yankees',     peakYears: [1952, 1955], tier: 'legend'    },
  { name: 'Ken Griffey Jr',      sport: 'baseball',    position: 'CF',  team: 'Mariners',    peakYears: [1989, 1989], tier: 'legend'    },
  { name: 'Nolan Ryan',          sport: 'baseball',    position: 'SP',  team: 'Rangers',     peakYears: [1973, 1973], tier: 'legend'    },
  { name: 'Hank Aaron',          sport: 'baseball',    position: 'RF',  team: 'Braves',      peakYears: [1954, 1954], tier: 'legend'    },
  { name: 'Pete Alonso',         sport: 'baseball',    position: '1B',  team: 'Mets',        peakYears: [2019, 2019], tier: 'star'      },
  { name: 'Yordan Alvarez',      sport: 'baseball',    position: 'DH',  team: 'Astros',      peakYears: [2019, 2019], tier: 'star'      },
  { name: 'Adley Rutschman',     sport: 'baseball',    position: 'C',   team: 'Orioles',     peakYears: [2022, 2022], tier: 'star'      },
  { name: 'Bobby Witt Jr',       sport: 'baseball',    position: 'SS',  team: 'Royals',      peakYears: [2022, 2022], tier: 'star'      },
  { name: 'Corbin Carroll',      sport: 'baseball',    position: 'CF',  team: 'Dbacks',      peakYears: [2023, 2023], tier: 'star'      },
  { name: 'Spencer Jones',       sport: 'baseball',    position: 'OF',  team: 'Yankees',     peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Kyle Harrison',       sport: 'baseball',    position: 'SP',  team: 'Giants',      peakYears: [2023, 2023], tier: 'prospect'  },
  { name: 'James Wood',          sport: 'baseball',    position: 'OF',  team: 'Nationals',   peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Jackson Chourio',     sport: 'baseball',    position: 'OF',  team: 'Brewers',     peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Wyatt Langford',      sport: 'baseball',    position: 'OF',  team: 'Rangers',     peakYears: [2024, 2024], tier: 'prospect'  },

  // Football (20 players)
  { name: 'Patrick Mahomes',     sport: 'football',   position: 'QB',  team: 'Chiefs',      peakYears: [2017, 2017], tier: 'superstar' },
  { name: 'Caleb Williams',      sport: 'football',   position: 'QB',  team: 'Bears',       peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'C.J. Stroud',         sport: 'football',   position: 'QB',  team: 'Texans',      peakYears: [2023, 2023], tier: 'star'      },
  { name: 'Justin Herbert',      sport: 'football',   position: 'QB',  team: 'Chargers',    peakYears: [2020, 2020], tier: 'star'      },
  { name: 'Joe Burrow',          sport: 'football',   position: 'QB',  team: 'Bengals',     peakYears: [2020, 2020], tier: 'star'      },
  { name: 'Trevor Lawrence',     sport: 'football',   position: 'QB',  team: 'Jaguars',     peakYears: [2021, 2021], tier: 'star'      },
  { name: 'Brock Purdy',         sport: 'football',   position: 'QB',  team: '49ers',       peakYears: [2022, 2022], tier: 'star'      },
  { name: 'Drake Maye',          sport: 'football',   position: 'QB',  team: 'Patriots',    peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Marvin Harrison Jr',  sport: 'football',   position: 'WR',  team: 'Cardinals',   peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Puka Nacua',          sport: 'football',   position: 'WR',  team: 'Rams',        peakYears: [2023, 2023], tier: 'star'      },
  { name: 'Tyreek Hill',         sport: 'football',   position: 'WR',  team: 'Dolphins',    peakYears: [2016, 2016], tier: 'superstar' },
  { name: 'Justin Jefferson',    sport: 'football',   position: 'WR',  team: 'Vikings',     peakYears: [2020, 2020], tier: 'superstar' },
  { name: 'Brian Thomas Jr',     sport: 'football',   position: 'WR',  team: 'Jaguars',     peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Jahmyr Gibbs',        sport: 'football',   position: 'RB',  team: 'Lions',       peakYears: [2023, 2023], tier: 'star'      },
  { name: 'Lamar Jackson',       sport: 'football',   position: 'QB',  team: 'Ravens',      peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Josh Allen',          sport: 'football',   position: 'QB',  team: 'Bills',       peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Bo Nix',              sport: 'football',   position: 'QB',  team: 'Broncos',     peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Jayden Daniels',      sport: 'football',   position: 'QB',  team: 'Commanders',  peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Rome Odunze',         sport: 'football',   position: 'WR',  team: 'Bears',       peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Sam LaPorta',         sport: 'football',   position: 'TE',  team: 'Lions',       peakYears: [2023, 2023], tier: 'star'      },

  // Basketball (19 players)
  { name: 'Victor Wembanyama',   sport: 'basketball', position: 'C',   team: 'Spurs',       peakYears: [2023, 2023], tier: 'prospect'  },
  { name: 'Luka Doncic',         sport: 'basketball', position: 'PG',  team: 'Lakers',      peakYears: [2018, 2018], tier: 'superstar' },
  { name: 'Giannis Antetokounmpo',sport:'basketball', position: 'PF',  team: 'Bucks',       peakYears: [2013, 2013], tier: 'superstar' },
  { name: 'Stephen Curry',       sport: 'basketball', position: 'PG',  team: 'Warriors',    peakYears: [2009, 2009], tier: 'superstar' },
  { name: 'Anthony Edwards',     sport: 'basketball', position: 'SG',  team: 'Timberwolves',peakYears: [2020, 2020], tier: 'star'      },
  { name: 'Nikola Jokic',        sport: 'basketball', position: 'C',   team: 'Nuggets',     peakYears: [2015, 2015], tier: 'superstar' },
  { name: 'LeBron James',        sport: 'basketball', position: 'SF',  team: 'Lakers',      peakYears: [2003, 2003], tier: 'legend'    },
  { name: 'Michael Jordan',      sport: 'basketball', position: 'SG',  team: 'Bulls',       peakYears: [1984, 1986], tier: 'legend'    },
  { name: 'Kobe Bryant',         sport: 'basketball', position: 'SG',  team: 'Lakers',      peakYears: [1996, 1996], tier: 'legend'    },
  { name: 'Caitlin Clark',       sport: 'basketball', position: 'PG',  team: 'Fever',       peakYears: [2024, 2024], tier: 'star'      },
  { name: 'Zaccharie Risacher',  sport: 'basketball', position: 'SF',  team: 'Hawks',       peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Alexandre Sarr',      sport: 'basketball', position: 'C',   team: 'Wizards',     peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Stephon Castle',      sport: 'basketball', position: 'SG',  team: 'Spurs',       peakYears: [2024, 2024], tier: 'prospect'  },
  { name: 'Donovan Mitchell',    sport: 'basketball', position: 'SG',  team: 'Cavaliers',   peakYears: [2017, 2017], tier: 'star'      },
  { name: 'Tyrese Haliburton',   sport: 'basketball', position: 'PG',  team: 'Pacers',      peakYears: [2020, 2020], tier: 'star'      },
  { name: 'Evan Mobley',         sport: 'basketball', position: 'C',   team: 'Cavaliers',   peakYears: [2021, 2021], tier: 'star'      },
  { name: 'Paolo Banchero',      sport: 'basketball', position: 'PF',  team: 'Magic',       peakYears: [2022, 2022], tier: 'star'      },
  { name: 'Scottie Barnes',      sport: 'basketball', position: 'SF',  team: 'Raptors',     peakYears: [2021, 2021], tier: 'star'      },
  { name: 'Franz Wagner',        sport: 'basketball', position: 'SF',  team: 'Magic',       peakYears: [2021, 2021], tier: 'star'      },

  // Hockey (8 players)
  { name: 'Connor McDavid',      sport: 'hockey',     position: 'C',   team: 'Oilers',      peakYears: [2015, 2015], tier: 'superstar' },
  { name: 'Connor Bedard',       sport: 'hockey',     position: 'C',   team: 'Blackhawks',  peakYears: [2023, 2023], tier: 'prospect'  },
  { name: 'Cale Makar',          sport: 'hockey',     position: 'D',   team: 'Avalanche',   peakYears: [2019, 2019], tier: 'superstar' },
  { name: 'Auston Matthews',     sport: 'hockey',     position: 'C',   team: 'Maple Leafs', peakYears: [2016, 2016], tier: 'superstar' },
  { name: 'Nathan MacKinnon',    sport: 'hockey',     position: 'C',   team: 'Avalanche',   peakYears: [2013, 2013], tier: 'superstar' },
  { name: 'Leon Draisaitl',      sport: 'hockey',     position: 'C',   team: 'Oilers',      peakYears: [2014, 2014], tier: 'star'      },
  { name: 'David Pastrnak',      sport: 'hockey',     position: 'RW',  team: 'Bruins',      peakYears: [2014, 2014], tier: 'star'      },
  { name: 'Jack Hughes',         sport: 'hockey',     position: 'C',   team: 'Devils',      peakYears: [2019, 2019], tier: 'star'      },

  // Non-sport (10 entries)
  { name: 'Charizard Holo 1st Ed', sport: 'nonsport', position: '', team: 'Pokemon',     peakYears: [1999, 1999], tier: 'legend' },
  { name: 'Pikachu Illustrator',   sport: 'nonsport', position: '', team: 'Pokemon',     peakYears: [1998, 1998], tier: 'legend' },
  { name: 'Blastoise Base Set',    sport: 'nonsport', position: '', team: 'Pokemon',     peakYears: [1999, 1999], tier: 'star'   },
  { name: 'Black Lotus Alpha',     sport: 'nonsport', position: '', team: 'Magic',       peakYears: [1993, 1993], tier: 'legend' },
  { name: 'Mox Sapphire',          sport: 'nonsport', position: '', team: 'Magic',       peakYears: [1993, 1993], tier: 'legend' },
  { name: 'Blue-Eyes White Dragon',sport: 'nonsport', position: '', team: 'Yu-Gi-Oh',   peakYears: [2002, 2002], tier: 'star'   },
  { name: 'Luke Skywalker',        sport: 'nonsport', position: '', team: 'Star Wars',   peakYears: [1977, 1977], tier: 'star'   },
  { name: 'Spider-Man',            sport: 'nonsport', position: '', team: 'Marvel',      peakYears: [1990, 1990], tier: 'star'   },
  { name: 'Darth Vader',           sport: 'nonsport', position: '', team: 'Star Wars',   peakYears: [1977, 1977], tier: 'star'   },
  { name: 'Iron Man',              sport: 'nonsport', position: '', team: 'Marvel',      peakYears: [1990, 1990], tier: 'star'   },
]

// ---------------------------------------------------------------------------
// Card set pools
// ---------------------------------------------------------------------------

const SETS: Record<Sport, CardSet[]> = {
  baseball: [
    { brand: 'Topps',     setName: 'Topps Series 1',       yearRange: [2000, 2024], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Gold', 'Black', 'Independence Day'] },
    { brand: 'Topps',     setName: 'Topps Chrome',          yearRange: [1996, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: true,  parallel: ['Refractor', 'Gold Refractor', 'Orange Refractor', 'Red Refractor', 'SuperFractor'] },
    { brand: 'Topps',     setName: 'Bowman Chrome',         yearRange: [2000, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: true,  parallel: ['Green Refractor', 'Blue Refractor', 'Gold /50', 'Orange /25', 'Red /5'] },
    { brand: 'Topps',     setName: 'Topps Heritage',        yearRange: [2001, 2024], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Chrome', 'Real One Auto'] },
    { brand: 'Topps',     setName: 'Stadium Club',          yearRange: [1991, 2024], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Chrome', 'Black Foil'] },
    { brand: 'Topps',     setName: 'Finest',                yearRange: [1993, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: true,  parallel: ['Refractor', 'Gold Refractor /25'] },
    { brand: 'Panini',    setName: 'Immaculate Collection', yearRange: [2012, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Onyx', 'Platinum'] },
    { brand: 'Upper Deck',setName: 'Upper Deck Series 1',   yearRange: [1989, 2010], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Gold Hologram'] },
    { brand: 'Topps',     setName: 'Topps Update',          yearRange: [2005, 2024], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Gold', 'Rainbow Foil'] },
    { brand: 'Topps',     setName: 'Topps Tribute',         yearRange: [2010, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Gold /25', 'Red /10'] },
  ],
  football: [
    { brand: 'Panini',    setName: 'Prizm',                 yearRange: [2012, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Silver', 'Green', 'Red/White/Blue', 'Gold /10', 'Black /1'] },
    { brand: 'Panini',    setName: 'Select',                yearRange: [2011, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Silver', 'Gold /10', 'Premier Level Tri-Color'] },
    { brand: 'Panini',    setName: 'National Treasures',    yearRange: [2010, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['RPA /99', 'Gold /25', 'Platinum /1'] },
    { brand: 'Panini',    setName: 'Flawless',              yearRange: [2014, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Ruby /15', 'Emerald /5', 'Sapphire /3'] },
    { brand: 'Donruss',   setName: 'Optic',                 yearRange: [2016, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Holo', 'Gold', 'Blue Velocity'] },
    { brand: 'Topps',     setName: 'Chrome',                yearRange: [1996, 2015], hasAutos: true,  hasPrizm: false, hasRefractor: true,  parallel: ['Refractor', 'Gold Refractor /25'] },
    { brand: 'Panini',    setName: 'Contenders',            yearRange: [1994, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Championship Ticket', 'Cracked Ice'] },
    { brand: 'Panini',    setName: 'Plates & Patches',      yearRange: [2014, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Gold /49', 'Platinum /1'] },
  ],
  basketball: [
    { brand: 'Panini',    setName: 'Prizm',                 yearRange: [2012, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Silver', 'Green', 'Neon Green Pulsar', 'Gold /10', 'Black /1'] },
    { brand: 'Topps',     setName: 'Finest',                yearRange: [1993, 2003], hasAutos: false, hasPrizm: false, hasRefractor: true,  parallel: ['Refractor', 'Gold Refractor'] },
    { brand: 'Fleer',     setName: 'Fleer Basketball',      yearRange: [1986, 2005], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Sticker', 'Game Time'] },
    { brand: 'Upper Deck',setName: 'Exquisite Collection',  yearRange: [2003, 2012], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Gold /25', 'Platinum /1'] },
    { brand: 'Panini',    setName: 'National Treasures',    yearRange: [2009, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Logoman /1', 'Gold /10'] },
    { brand: 'Bowman',    setName: 'Bowman Best',           yearRange: [2023, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Green /99', 'Gold /50'] },
    { brand: 'Panini',    setName: 'Select',                yearRange: [2014, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Silver', 'Gold /10', 'Tri-Color'] },
  ],
  hockey: [
    { brand: 'Upper Deck',setName: 'Young Guns',            yearRange: [1990, 2024], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Canvas', 'High Gloss'] },
    { brand: 'Upper Deck',setName: 'The Cup',               yearRange: [2005, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Autographed /25', 'Platinum /1'] },
    { brand: 'Upper Deck',setName: 'SPx',                   yearRange: [2000, 2024], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Gold /100', 'Jersey Auto'] },
    { brand: 'O-Pee-Chee',setName: 'O-Pee-Chee Platinum',  yearRange: [2015, 2024], hasAutos: false, hasPrizm: true,  hasRefractor: false, parallel: ['Blue Rainbow', 'Gold /35'] },
    { brand: 'Topps',     setName: 'Stadium Club Chrome',   yearRange: [2021, 2024], hasAutos: false, hasPrizm: false, hasRefractor: true,  parallel: ['Refractor', 'Gold /50'] },
  ],
  nonsport: [
    { brand: 'Pokemon',   setName: 'Base Set',              yearRange: [1999, 2000], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['1st Edition', 'Shadowless', 'Unlimited'] },
    { brand: 'Pokemon',   setName: 'Neo Genesis',           yearRange: [2000, 2001], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['1st Edition'] },
    { brand: 'Magic',     setName: 'Alpha',                 yearRange: [1993, 1993], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: [] },
    { brand: 'Magic',     setName: 'Beta',                  yearRange: [1993, 1993], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: [] },
    { brand: 'Yu-Gi-Oh',  setName: 'Legend of Blue Eyes',   yearRange: [2002, 2002], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['1st Edition', 'Unlimited'] },
    { brand: 'Topps',     setName: 'Star Wars Galaxy',      yearRange: [1993, 2015], hasAutos: true,  hasPrizm: false, hasRefractor: false, parallel: ['Foil', 'Chrome'] },
    { brand: 'Upper Deck',setName: 'Marvel Masterpieces',   yearRange: [1992, 2008], hasAutos: false, hasPrizm: false, hasRefractor: false, parallel: ['Canvas', 'Foil'] },
  ],
}

// ---------------------------------------------------------------------------
// Grade distribution
// ---------------------------------------------------------------------------

const GRADES: Grade[] = [
  { label: 'PSA 10',  weight: 15, gradeMultiplier: 4.0  },
  { label: 'PSA 9',   weight: 20, gradeMultiplier: 1.8  },
  { label: 'BGS 9.5', weight: 10, gradeMultiplier: 3.0  },
  { label: 'BGS 9',   weight: 10, gradeMultiplier: 1.5  },
  { label: 'SGC 10',  weight:  5, gradeMultiplier: 3.5  },
  { label: 'SGC 8',   weight:  5, gradeMultiplier: 1.2  },
  { label: 'Raw',     weight: 35, gradeMultiplier: 1.0  },
]

function pickGrade(): Grade {
  const total = GRADES.reduce((s, g) => s + g.weight, 0)
  let r = rng.next() * total
  for (const g of GRADES) {
    r -= g.weight
    if (r <= 0) return g
  }
  return GRADES[GRADES.length - 1]
}

function gradeToCondition(grade: Grade): string {
  if (grade.label === 'Raw') return 'Ungraded'
  if (grade.label.startsWith('PSA') || grade.label.startsWith('BGS') || grade.label.startsWith('SGC')) return 'Graded'
  return 'Used'
}

// ---------------------------------------------------------------------------
// Price buckets
// ---------------------------------------------------------------------------

const PRICE_BUCKETS: PriceBucket[] = [
  { minDollars:    1, maxDollars:   25, count: 400 },
  { minDollars:   25, maxDollars:  100, count: 300 },
  { minDollars:  100, maxDollars:  500, count: 200 },
  { minDollars:  500, maxDollars: 2000, count:  70 },
  { minDollars: 2000, maxDollars: 9999, count:  30 },
]

function buildBucketAssignments(): PriceBucket[] {
  const assignments: PriceBucket[] = []
  for (const bucket of PRICE_BUCKETS) {
    for (let i = 0; i < bucket.count; i++) {
      assignments.push(bucket)
    }
  }
  return rng.shuffle(assignments)
}

function priceFromBucket(bucket: PriceBucket): number {
  const logLo  = Math.log(bucket.minDollars)
  const logHi  = Math.log(bucket.maxDollars)
  const logVal = logLo + rng.next() * (logHi - logLo)
  const dollars = Math.exp(logVal)
  return cents(Math.round(dollars * 100) / 100)
}

function generatePrice(bucket: PriceBucket, grade: Grade): number {
  const base = priceFromBucket(bucket)
  const multiplied = Math.round(base * grade.gradeMultiplier)
  return Math.min(multiplied, cents(bucket.maxDollars * 2))
}

// ---------------------------------------------------------------------------
// Title generator
// ---------------------------------------------------------------------------

function generateTitle(player: Player, set: CardSet, grade: Grade): string {
  const year = rng.int(set.yearRange[0], set.yearRange[1])
  const parts: string[] = [String(year), set.brand, set.setName, player.name]

  if (set.hasRefractor && rng.next() < 0.4) {
    parts.push(rng.pick(['Refractor', 'Gold Refractor', 'Orange Refractor /25', 'Red Refractor /5']))
  } else if (set.hasPrizm && rng.next() < 0.4) {
    parts.push(rng.pick(['Silver', 'Green', 'Neon Green Pulsar', 'Purple', 'Gold /10']))
  } else if (set.parallel.length > 0 && rng.next() < 0.3) {
    parts.push(rng.pick(set.parallel))
  }

  const isRookieYear = year === player.peakYears[0]
  if (isRookieYear && rng.next() < 0.7) parts.push('RC')

  if (set.hasAutos && rng.next() < 0.35) parts.push('Auto')

  if (grade.label !== 'Raw') parts.push(grade.label)

  const title = parts.join(' ')
  return title.length > 80 ? title.slice(0, 77) + '...' : title
}

// ---------------------------------------------------------------------------
// Seller pool
// ---------------------------------------------------------------------------

const SELLERS: Array<{ id: string; feedback: number; specialty: Sport | 'multi' }> = [
  { id: 'heritage_cards_usa',     feedback: 34521, specialty: 'multi'      },
  { id: 'pwcc_marketplace',       feedback: 89234, specialty: 'multi'      },
  { id: 'goldin_auctions',        feedback: 45678, specialty: 'multi'      },
  { id: 'sage_collectibles',      feedback: 23456, specialty: 'multi'      },
  { id: 'hall_of_fame_cards',     feedback: 22456, specialty: 'basketball' },
  { id: 'waxbreaks_elite',        feedback:  4823, specialty: 'baseball'   },
  { id: 'prospect_kings',         feedback:  2341, specialty: 'baseball'   },
  { id: 'steelcity_cards',        feedback:  9823, specialty: 'baseball'   },
  { id: 'bronxbomber_cards',      feedback:  1892, specialty: 'baseball'   },
  { id: 'nyyanks_collector',      feedback:  5609, specialty: 'baseball'   },
  { id: 'retrobase_cards',        feedback:  2109, specialty: 'baseball'   },
  { id: 'grandpas_attic_cards',   feedback:   876, specialty: 'baseball'   },
  { id: 'seattle_card_king',      feedback:  3210, specialty: 'baseball'   },
  { id: 'ohtani_fanshop',         feedback:  3456, specialty: 'baseball'   },
  { id: 'golfcard_vault',         feedback:  8765, specialty: 'baseball'   },
  { id: 'ultra_rare_wax',         feedback:  2103, specialty: 'baseball'   },
  { id: 'midwest_box_breaks',     feedback:  6712, specialty: 'baseball'   },
  { id: 'diamond_cut_cards',      feedback:  4190, specialty: 'baseball'   },
  { id: 'vintage_hoops_inc',      feedback: 12450, specialty: 'basketball' },
  { id: 'mamba_vault',            feedback:  6744, specialty: 'basketball' },
  { id: 'hoopscards_daily',       feedback: 15234, specialty: 'basketball' },
  { id: 'dallas_card_co',         feedback:  4567, specialty: 'basketball' },
  { id: 'spurs_card_shop',        feedback:  8901, specialty: 'basketball' },
  { id: 'laker_nation_cards',     feedback:  3782, specialty: 'basketball' },
  { id: 'slam_dunk_collectibles', feedback:  7312, specialty: 'basketball' },
  { id: 'gridiron_gems',          feedback:  7812, specialty: 'football'   },
  { id: 'jaxville_sports',        feedback:  1567, specialty: 'football'   },
  { id: 'pigskin_palace',         feedback:  5023, specialty: 'football'   },
  { id: 'nfl_card_vault',         feedback:  8934, specialty: 'football'   },
  { id: 'chiefs_kingdom_cards',   feedback:  2890, specialty: 'football'   },
  { id: 'gridiron_grail_hunter',  feedback:  4123, specialty: 'football'   },
  { id: 'puck_collectibles',      feedback:  6234, specialty: 'hockey'     },
  { id: 'icebreaker_cards',       feedback:  3891, specialty: 'hockey'     },
  { id: 'oilers_card_shop',       feedback:  2145, specialty: 'hockey'     },
  { id: 'maple_leaf_memorabilia', feedback:  7834, specialty: 'hockey'     },
  { id: 'bedard_break_city',      feedback:   923, specialty: 'hockey'     },
  { id: 'pokemon_vault_pro',      feedback: 18923, specialty: 'nonsport'   },
  { id: 'trading_card_haven',     feedback: 11234, specialty: 'nonsport'   },
  { id: 'mtg_power_9_seller',     feedback:  9123, specialty: 'nonsport'   },
  { id: 'yugioh_king',            feedback:  6789, specialty: 'nonsport'   },
  { id: 'galaxy_toy_collectibles',feedback:  3456, specialty: 'nonsport'   },
  { id: 'cardboard_dreams_shop',  feedback:  4512, specialty: 'multi'      },
  { id: 'the_card_cellar',        feedback:  3901, specialty: 'multi'      },
  { id: 'collectible_kingdom',    feedback:  8234, specialty: 'multi'      },
  { id: 'vintage_sports_emporium',feedback:  5678, specialty: 'multi'      },
  { id: 'hometown_breaks_llc',    feedback:   412, specialty: 'multi'      },
  { id: 'flip_or_flop_cards',     feedback:   289, specialty: 'multi'      },
  { id: 'sunday_flea_market',     feedback:   156, specialty: 'multi'      },
  { id: 'side_hustle_cards',      feedback:    67, specialty: 'multi'      },
  { id: 'new_collector_2024',     feedback:    12, specialty: 'multi'      },
]

function pickSeller(sport: Sport): typeof SELLERS[0] {
  const exact   = SELLERS.filter(s => s.specialty === sport)
  const matched = SELLERS.filter(s => s.specialty === sport || s.specialty === 'multi')
  if (exact.length > 0 && rng.next() < 0.7) return rng.pick(exact)
  return rng.pick(matched)
}

// ---------------------------------------------------------------------------
// Image placeholders by sport
// ---------------------------------------------------------------------------

const IMAGE_BY_SPORT: Record<Sport, string> = {
  baseball:   'https://placehold.co/225x225/1e3a5f/ffffff?text=Baseball',
  football:   'https://placehold.co/225x225/2d4a1e/ffffff?text=Football',
  basketball: 'https://placehold.co/225x225/8b2500/ffffff?text=Basketball',
  hockey:     'https://placehold.co/225x225/003366/ffffff?text=Hockey',
  nonsport:   'https://placehold.co/225x225/4a1e8b/ffffff?text=TCG',
}

// ---------------------------------------------------------------------------
// Distribution pools
// ---------------------------------------------------------------------------

const SPORT_COUNTS: Record<Sport, number> = {
  baseball:   400,
  football:   250,
  basketball: 200,
  hockey:     100,
  nonsport:    50,
}

const STATUS_COUNTS = { Active: 600, Sold: 250, Ended: 150 }
const LISTING_TYPE_COUNTS = { Auction: 400, FixedPrice: 450, AuctionWithBIN: 150 }

function buildSportPool(): Sport[] {
  const pool: Sport[] = []
  for (const [sport, count] of Object.entries(SPORT_COUNTS)) {
    for (let i = 0; i < count; i++) pool.push(sport as Sport)
  }
  return rng.shuffle(pool)
}

function buildStatusPool(): string[] {
  const pool: string[] = []
  for (const [status, count] of Object.entries(STATUS_COUNTS)) {
    for (let i = 0; i < count; i++) pool.push(status)
  }
  return rng.shuffle(pool)
}

function buildListingTypePool(): string[] {
  const pool: string[] = []
  for (const [type, count] of Object.entries(LISTING_TYPE_COUNTS)) {
    for (let i = 0; i < count; i++) pool.push(type)
  }
  return rng.shuffle(pool)
}

// ---------------------------------------------------------------------------
// Snapshot pattern generators
// ---------------------------------------------------------------------------

type SnapshotPattern = 'auction_rising' | 'fixed_stable' | 'fixed_dropped' | 'sold_completed' | 'ended_flat'

function selectPattern(item: SeedItem): SnapshotPattern {
  if (item.status === 'Sold') return 'sold_completed'
  if (item.status === 'Ended') return 'ended_flat'
  if (item.listing_type === 'FixedPrice') {
    return rng.next() < 0.3 ? 'fixed_dropped' : 'fixed_stable'
  }
  if (item.listing_type === 'AuctionWithBIN') {
    return rng.next() < 0.2 ? 'fixed_dropped' : 'auction_rising'
  }
  return 'auction_rising'
}

function snapshotsAuctionRising(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const finalPrice = item.current_price
  const finalBids  = item.bid_count
  const finalWatch = item.watcher_count ?? 0
  const spreadDays = rng.between(3, 14)

  for (let i = 0; i < count; i++) {
    const progress   = count > 1 ? i / (count - 1) : 1
    const hoursAgo   = (1 - progress) * spreadDays * 24
    const recordedAt = ago(hoursAgo * HOUR)

    const priceFrac  = 0.15 + 0.85 * Math.pow(progress, 1.5)
    const jitter     = 1 + (rng.next() - 0.5) * 0.04
    const priceCents = Math.max(1, Math.round(finalPrice * priceFrac * jitter))

    const bids      = Math.round(finalBids * Math.pow(progress, 1.2))
    const watchFrac = progress < 0.8 ? 0.3 + 0.6 * progress : 0.85 + 0.15 * ((progress - 0.8) / 0.2)
    const watchers  = Math.max(0, Math.round(finalWatch * watchFrac + (rng.next() - 0.5) * 3))

    snapshots.push({ item_id: item.item_id, price_cents: priceCents, shipping: item.shipping_cost, watcher_count: watchers, bid_count: bids, recorded_at: recordedAt })
  }
  return snapshots
}

function snapshotsFixedStable(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const spreadDays = rng.between(7, 30)

  for (let i = 0; i < count; i++) {
    const progress   = count > 1 ? i / (count - 1) : 1
    const hoursAgo   = (1 - progress) * spreadDays * 24
    const watchers   = Math.max(0, Math.round((item.watcher_count ?? 0) * (0.2 + 0.8 * progress) + (rng.next() - 0.5) * 2))
    snapshots.push({ item_id: item.item_id, price_cents: item.current_price, shipping: item.shipping_cost, watcher_count: watchers, bid_count: 0, recorded_at: ago(hoursAgo * HOUR) })
  }
  return snapshots
}

function snapshotsFixedDropped(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const spreadDays  = rng.between(7, 21)
  const originalPrice = Math.round(item.current_price * (1.10 + rng.next() * 0.15))
  const dropAt      = Math.floor(rng.between(0.3, 0.7) * count)

  for (let i = 0; i < count; i++) {
    const progress  = count > 1 ? i / (count - 1) : 1
    const hoursAgo  = (1 - progress) * spreadDays * 24
    const price     = i < dropAt ? originalPrice : item.current_price
    const inSpike   = i >= dropAt && i < dropAt + 2
    const baseWatch = item.watcher_count ?? 0
    const watchers  = inSpike
      ? Math.round(baseWatch * 1.4 + rng.next() * 5)
      : Math.max(0, Math.round(baseWatch * (0.5 + 0.5 * progress)))
    snapshots.push({ item_id: item.item_id, price_cents: price, shipping: item.shipping_cost, watcher_count: watchers, bid_count: 0, recorded_at: ago(hoursAgo * HOUR) })
  }
  return snapshots
}

function snapshotsSoldCompleted(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const soldDaysAgo   = rng.between(1, 10)
  const auctionDays   = rng.between(3, 7)
  const preSaleCount  = Math.floor(count * 0.75)

  for (let i = 0; i < count; i++) {
    if (i < preSaleCount) {
      const progress  = preSaleCount > 1 ? i / (preSaleCount - 1) : 1
      const hoursAgo  = soldDaysAgo * 24 + (1 - progress) * auctionDays * 24
      const priceFrac = 0.15 + 0.85 * Math.pow(progress, 1.5)
      const bids      = Math.round(item.bid_count * Math.pow(progress, 1.2))
      const watchers  = Math.round((item.watcher_count ?? 0) * (0.3 + 0.7 * progress))
      snapshots.push({ item_id: item.item_id, price_cents: Math.max(1, Math.round(item.current_price * priceFrac)), shipping: item.shipping_cost, watcher_count: watchers, bid_count: bids, recorded_at: ago(hoursAgo * HOUR) })
    } else {
      const hoursAgo = (soldDaysAgo - ((i - preSaleCount) * 0.5)) * 24
      snapshots.push({ item_id: item.item_id, price_cents: item.current_price, shipping: item.shipping_cost, watcher_count: 0, bid_count: 0, recorded_at: ago(Math.max(1, hoursAgo) * HOUR) })
    }
  }
  return snapshots
}

function snapshotsEndedFlat(item: SeedItem, count: number): SnapshotRow[] {
  const snapshots: SnapshotRow[] = []
  const endedDaysAgo = rng.between(1, 14)
  const auctionDays  = rng.between(3, 7)
  const startPrice   = Math.round(item.current_price * rng.between(0.8, 1.0))

  for (let i = 0; i < count; i++) {
    const progress = count > 1 ? i / (count - 1) : 1
    const hoursAgo = endedDaysAgo * 24 + (1 - progress) * auctionDays * 24
    const bids     = rng.next() < 0.2 ? 1 : 0
    const watchers = Math.max(0, Math.round(5 * (1 - progress) + (rng.next() - 0.5) * 2))
    snapshots.push({ item_id: item.item_id, price_cents: startPrice, shipping: item.shipping_cost, watcher_count: watchers, bid_count: bids, recorded_at: ago(hoursAgo * HOUR) })
  }
  return snapshots
}

function generateSnapshots(item: SeedItem, count: number): SnapshotRow[] {
  const pattern = selectPattern(item)
  switch (pattern) {
    case 'auction_rising':   return snapshotsAuctionRising(item, count)
    case 'fixed_stable':     return snapshotsFixedStable(item, count)
    case 'fixed_dropped':    return snapshotsFixedDropped(item, count)
    case 'sold_completed':   return snapshotsSoldCompleted(item, count)
    case 'ended_flat':       return snapshotsEndedFlat(item, count)
  }
}

// ---------------------------------------------------------------------------
// Event generator from snapshot history
// ---------------------------------------------------------------------------

function generateEventsForItem(item: SeedItem, snapshots: SnapshotRow[]): EventRow[] {
  const events: EventRow[] = []
  if (snapshots.length < 2) return events

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const curr = snapshots[i]

    if (item.listing_type === 'FixedPrice' && curr.price_cents < prev.price_cents) {
      const pct = (prev.price_cents - curr.price_cents) / prev.price_cents
      if (pct > 0.05) {
        events.push({ item_id: item.item_id, event_type: 'price_drop', old_value: String(prev.price_cents), new_value: String(curr.price_cents), detected_at: curr.recorded_at })
      }
    }

    if ((item.listing_type === 'Auction' || item.listing_type === 'AuctionWithBIN') && curr.price_cents > prev.price_cents) {
      const pct = (curr.price_cents - prev.price_cents) / prev.price_cents
      if (pct > 0.10) {
        events.push({ item_id: item.item_id, event_type: 'price_increase', old_value: String(prev.price_cents), new_value: String(curr.price_cents), detected_at: curr.recorded_at })
      }
    }

    const prevW = prev.watcher_count ?? 0
    const currW = curr.watcher_count ?? 0
    if (prevW > 5 && currW > prevW * 1.25) {
      events.push({ item_id: item.item_id, event_type: 'watcher_spike', old_value: String(prevW), new_value: String(currW), detected_at: curr.recorded_at })
    }
  }

  if (item.status === 'Sold') {
    const lastSnap = snapshots[snapshots.length - 1]
    events.push({ item_id: item.item_id, event_type: 'sold', old_value: String(snapshots[0].price_cents), new_value: String(item.current_price), detected_at: lastSnap.recorded_at })
  }

  if (item.status === 'Ended') {
    events.push({ item_id: item.item_id, event_type: 'expired', old_value: null, new_value: null, detected_at: snapshots[snapshots.length - 1].recorded_at })
  }

  return events
}

// ---------------------------------------------------------------------------
// End time generator
// ---------------------------------------------------------------------------

function generateEndTime(status: string, listingType: string): { end_time: string | null; time_left: string | null } {
  if (status === 'Sold') {
    const daysAgo = rng.between(1, 10)
    return { end_time: ago(daysAgo * DAY), time_left: null }
  }
  if (status === 'Ended') {
    const daysAgo = rng.between(1, 14)
    return { end_time: ago(daysAgo * DAY), time_left: null }
  }
  // Active
  if (listingType === 'FixedPrice') {
    const days = rng.int(7, 30)
    return { end_time: fromNow(days * DAY), time_left: `P${days}D` }
  }
  // Auction or AuctionWithBIN
  const hours = rng.int(1, 7 * 24)
  if (hours < 24) {
    return { end_time: fromNow(hours * HOUR), time_left: `PT${hours}H` }
  }
  const days = Math.floor(hours / 24)
  return { end_time: fromNow(hours * HOUR), time_left: `P${days}D` }
}

// ---------------------------------------------------------------------------
// 20 Mandatory items
// ---------------------------------------------------------------------------

const syncedAt = ago(5 * MIN)

function buildMandatoryItems(): SeedItem[] {
  const IMG_BASE = 'https://placehold.co/225x225'
  return [
    {
      item_id: 'v1|225678901234|0', rank: 1,
      title: '2023 Topps Chrome Elly De La Cruz RC Auto /25 PSA 10',
      current_price: cents(1250), buy_it_now_price: null, shipping_cost: cents(14.99),
      listing_type: 'Auction', condition_name: 'Graded',
      end_time: fromNow(2 * HOUR), time_left: 'PT2H',
      seller_id: 'waxbreaks_elite', seller_feedback: 4823,
      watcher_count: 47, bid_count: 15,
      image_url: `${IMG_BASE}/1e3a5f/ffffff?text=Baseball`,
      listing_url: 'https://www.ebay.com/itm/225678901234',
      status: 'Active', is_in_queue: 1, notes: 'Hot card — ending very soon',
      first_seen_at: ago(10 * DAY), last_synced_at: syncedAt, sport: 'baseball',
    },
    {
      item_id: 'v1|334512098765|0', rank: 2,
      title: '1986 Fleer Michael Jordan Rookie #57 BGS 9.5',
      current_price: cents(28500), buy_it_now_price: null, shipping_cost: cents(29.99),
      listing_type: 'Auction', condition_name: 'Graded',
      end_time: fromNow(8 * HOUR), time_left: 'PT8H',
      seller_id: 'vintage_hoops_inc', seller_feedback: 12450,
      watcher_count: 156, bid_count: 23,
      image_url: `${IMG_BASE}/8b2500/ffffff?text=Basketball`,
      listing_url: 'https://www.ebay.com/itm/334512098765',
      status: 'Active', is_in_queue: 1, notes: 'Grail card — set max bid',
      first_seen_at: ago(7 * DAY), last_synced_at: syncedAt, sport: 'basketball',
    },
    {
      item_id: 'v1|276543210987|0', rank: 3,
      title: '2024 Bowman Chrome Ethan Salas 1st Auto Gold /50',
      current_price: cents(875), buy_it_now_price: cents(1200), shipping_cost: cents(9.99),
      listing_type: 'AuctionWithBIN', condition_name: 'Ungraded',
      end_time: fromNow(1 * DAY), time_left: 'P1D',
      seller_id: 'prospect_kings', seller_feedback: 2341,
      watcher_count: 34, bid_count: 8,
      image_url: `${IMG_BASE}/1e3a5f/ffffff?text=Baseball`,
      listing_url: 'https://www.ebay.com/itm/276543210987',
      status: 'Active', is_in_queue: 1, notes: null,
      first_seen_at: ago(5 * DAY), last_synced_at: syncedAt, sport: 'baseball',
    },
    {
      item_id: 'v1|185432167890|0', rank: 4,
      title: 'PSA 10 2001 SP Authentic Tiger Woods RC /900',
      current_price: cents(4500), buy_it_now_price: null, shipping_cost: 0,
      listing_type: 'FixedPrice', condition_name: 'Graded',
      end_time: fromNow(28 * DAY), time_left: 'P28D',
      seller_id: 'golfcard_vault', seller_feedback: 8765,
      watcher_count: 89, bid_count: 0,
      image_url: `${IMG_BASE}/1e3a5f/ffffff?text=Baseball`,
      listing_url: 'https://www.ebay.com/itm/185432167890',
      status: 'Active', is_in_queue: 1, notes: 'Free shipping — good deal',
      first_seen_at: ago(12 * DAY), last_synced_at: syncedAt, sport: 'baseball',
    },
    {
      item_id: 'v1|404876543210|0', rank: 5,
      title: '1993 SP Derek Jeter Foil Rookie #279 PSA 9',
      current_price: cents(3200), buy_it_now_price: null, shipping_cost: cents(19.99),
      listing_type: 'Auction', condition_name: 'Graded',
      end_time: fromNow(3 * DAY), time_left: 'P3D',
      seller_id: 'nyyanks_collector', seller_feedback: 5609,
      watcher_count: 67, bid_count: 19,
      image_url: `${IMG_BASE}/1e3a5f/ffffff?text=Baseball`,
      listing_url: 'https://www.ebay.com/itm/404876543210',
      status: 'Active', is_in_queue: 1, notes: null,
      first_seen_at: ago(8 * DAY), last_synced_at: syncedAt, sport: 'baseball',
    },
    {
      item_id: 'v1|156789012345|0', rank: 6,
      title: '2024 Panini Prizm Caitlin Clark Silver RC',
      current_price: cents(425), buy_it_now_price: null, shipping_cost: cents(5.49),
      listing_type: 'FixedPrice', condition_name: 'Ungraded',
      end_time: fromNow(25 * DAY), time_left: 'P25D',
      seller_id: 'hoopscards_daily', seller_feedback: 15234,
      watcher_count: 203, bid_count: 0,
      image_url: `${IMG_BASE}/8b2500/ffffff?text=Basketball`,
      listing_url: 'https://www.ebay.com/itm/156789012345',
      status: 'Active', is_in_queue: 0, notes: 'Massive watcher count — price may rise',
      first_seen_at: ago(4 * DAY), last_synced_at: syncedAt, sport: 'basketball',
    },
    {
      item_id: 'v1|512345678901|0', rank: 7,
      title: 'Vintage 1952 Topps Mickey Mantle #311 SGC 3',
      current_price: cents(45000), buy_it_now_price: null, shipping_cost: 0,
      listing_type: 'Auction', condition_name: 'Graded',
      end_time: fromNow(5 * DAY), time_left: 'P5D',
      seller_id: 'heritage_cards_usa', seller_feedback: 34521,
      watcher_count: 312, bid_count: 31,
      image_url: `${IMG_BASE}/1e3a5f/ffffff?text=Baseball`,
      listing_url: 'https://www.ebay.com/itm/512345678901',
      status: 'Active', is_in_queue: 0, notes: 'The holy grail — even SGC 3 is insane',
      first_seen_at: ago(14 * DAY), last_synced_at: syncedAt, sport: 'baseball',
    },
    {
      item_id: 'v1|298765432109|0', rank: 8,
      title: '2023 Topps Chrome Jasson Dominguez RC Refractor Auto',
      current_price: cents(340), buy_it_now_price: null, shipping_cost: cents(7.99),
      listing_type: 'Auction', condition_name: 'Ungraded',
      end_time: fromNow(6 * HOUR), time_left: 'PT6H',
      seller_id: 'bronxbomber_cards', seller_feedback: 1892,
      watcher_count: 28, bid_count: 12,
      image_url: `${IMG_BASE}/1e3a5f/ffffff?text=Baseball`,
      listing_url: 'https://www.ebay.com/itm/298765432109',
      status: 'Active', is_in_queue: 0, notes: null,
      first_seen_at: ago(6 * DAY), last_synced_at: syncedAt, sport: 'baseball',
    },
    {
      item_id: 'v1|367890123456|0', rank: 9,
      title: '1997 PMG Kobe Bryant Green /10 BGS 8.5',
      current_price: cents(18750), buy_it_now_price: null, shipping_cost: 0,
      listing_type: 'FixedPrice', condition_name: 'Graded',
      end_time: fromNow(30 * DAY), time_left: 'P30D',
      seller_id: 'mamba_vault', seller_feedback: 6744,
      watcher_count: 45, bid_count: 0,
      image_url: `${IMG_BASE}/8b2500/ffffff?text=Basketball`,
      listing_url: 'https://www.ebay.com/itm/367890123456',
      status: 'Active', is_in_queue: 0, notes: 'Pop 3 — extremely rare',
      first_seen_at: ago(11 * DAY), last_synced_at: syncedAt, sport: 'basketball',
    },
    {
      item_id: 'v1|445678901234|0', rank: 10,
      title: '2024 Topps Series 1 Paul Skenes RC SP #US300',
      current_price: cents(89.99), buy_it_now_price: null, shipping_cost: cents(4.49),
      listing_type: 'FixedPrice', condition_name: 'Ungraded',
      end_time: fromNow(20 * DAY), time_left: 'P20D',
      seller_id: 'steelcity_cards', seller_feedback: 9823,
      watcher_count: 156, bid_count: 0,
      image_url: `${IMG_BASE}/1e3a5f/ffffff?text=Baseball`,
      listing_url: 'https://www.ebay.com/itm/445678901234',
      status: 'Active', is_in_queue: 0, notes: null,
      first_seen_at: ago(3 * DAY), last_synced_at: syncedAt, sport: 'baseball',
    },
    {
      item_id: 'v1|523456789012|0', rank: 11,
      title: 'Sealed 2003-04 Upper Deck Exquisite Collection Box',
      current_price: cents(125000), buy_it_now_price: null, shipping_cost: 0,
      listing_type: 'Auction', condition_name: 'Factory Sealed',
      end_time: fromNow(4 * DAY), time_left: 'P4D',
      seller_id: 'ultra_rare_wax', seller_feedback: 2103,
      watcher_count: 78, bid_count: 5,
      image_url: `${IMG_BASE}/8b2500/ffffff?text=Basketball`,
      listing_url: 'https://www.ebay.com/itm/523456789012',
      status: 'Active', is_in_queue: 0, notes: 'LeBron RC autos possible — insane box',
      first_seen_at: ago(9 * DAY), last_synced_at: syncedAt, sport: 'basketball',
    },
    {
      item_id: 'v1|601234567890|0', rank: 12,
      title: '2020 Panini National Treasures Justin Herbert RPA /99',
      current_price: cents(2100), buy_it_now_price: null, shipping_cost: cents(14.99),
      listing_type: 'Auction', condition_name: 'Ungraded',
      end_time: fromNow(12 * HOUR), time_left: 'PT12H',
      seller_id: 'gridiron_gems', seller_feedback: 7812,
      watcher_count: 41, bid_count: 16,
      image_url: `${IMG_BASE}/2d4a1e/ffffff?text=Football`,
      listing_url: 'https://www.ebay.com/itm/601234567890',
      status: 'Active', is_in_queue: 0, notes: null,
      first_seen_at: ago(6 * DAY), last_synced_at: syncedAt, sport: 'football',
    },
    {
      item_id: 'v1|678901234567|0', rank: 13,
      title: '1989 Upper Deck Ken Griffey Jr Rookie #1 PSA 10',
      current_price: cents(2800), buy_it_now_price: null, shipping_cost: 0,
      listing_type: 'FixedPrice', condition_name: 'Graded',
      end_time: fromNow(14 * DAY), time_left: 'P14D',
      seller_id: 'seattle_card_king', seller_feedback: 3210,
      watcher_count: 92, bid_count: 0,
      image_url: `${IMG_BASE}/1e3a5f/ffffff?text=Baseball`,
      listing_url: 'https://www.ebay.com/itm/678901234567',
      status: 'Active', is_in_queue: 0, notes: null,
      first_seen_at: ago(10 * DAY), last_synced_at: syncedAt, sport: 'baseball',
    },
    {
      item_id: 'v1|756789012345|0', rank: 14,
      title: '2023 Topps Bowman Chrome Victor Wembanyama RC Auto',
      current_price: cents(4200), buy_it_now_price: null, shipping_cost: cents(14.99),
      listing_type: 'Auction', condition_name: 'Ungraded',
      end_time: fromNow(2 * DAY), time_left: 'P2D',
      seller_id: 'spurs_card_shop', seller_feedback: 8901,
      watcher_count: 183, bid_count: 27,
      image_url: `${IMG_BASE}/8b2500/ffffff?text=Basketball`,
      listing_url: 'https://www.ebay.com/itm/756789012345',
      status: 'Active', is_in_queue: 0, notes: null,
      first_seen_at: ago(7 * DAY), last_synced_at: syncedAt, sport: 'basketball',
    },
    {
      item_id: 'v1|834567890123|0', rank: 15,
      title: '2022 Panini Prizm Patrick Mahomes Silver PSA 10',
      current_price: cents(1800), buy_it_now_price: null, shipping_cost: cents(9.99),
      listing_type: 'FixedPrice', condition_name: 'Graded',
      end_time: fromNow(21 * DAY), time_left: 'P21D',
      seller_id: 'chiefs_kingdom_cards', seller_feedback: 2890,
      watcher_count: 67, bid_count: 0,
      image_url: `${IMG_BASE}/2d4a1e/ffffff?text=Football`,
      listing_url: 'https://www.ebay.com/itm/834567890123',
      status: 'Active', is_in_queue: 0, notes: null,
      first_seen_at: ago(5 * DAY), last_synced_at: syncedAt, sport: 'football',
    },
    {
      item_id: 'v1|912345678901|0', rank: 16,
      title: '1999 Pokemon Base Set Charizard Holo 1st Ed BGS 9',
      current_price: cents(8500), buy_it_now_price: null, shipping_cost: 0,
      listing_type: 'FixedPrice', condition_name: 'Graded',
      end_time: fromNow(30 * DAY), time_left: 'P30D',
      seller_id: 'pokemon_vault_pro', seller_feedback: 18923,
      watcher_count: 234, bid_count: 0,
      image_url: `${IMG_BASE}/4a1e8b/ffffff?text=TCG`,
      listing_url: 'https://www.ebay.com/itm/912345678901',
      status: 'Active', is_in_queue: 0, notes: null,
      first_seen_at: ago(14 * DAY), last_synced_at: syncedAt, sport: 'nonsport',
    },
    {
      item_id: 'v1|190123456789|0', rank: 17,
      title: '2023 Bowman Draft Connor Bedard RC Auto Red /5',
      current_price: cents(3600), buy_it_now_price: null, shipping_cost: cents(14.99),
      listing_type: 'Auction', condition_name: 'Ungraded',
      end_time: fromNow(3 * DAY), time_left: 'P3D',
      seller_id: 'bedard_break_city', seller_feedback: 923,
      watcher_count: 145, bid_count: 22,
      image_url: `${IMG_BASE}/003366/ffffff?text=Hockey`,
      listing_url: 'https://www.ebay.com/itm/190123456789',
      status: 'Active', is_in_queue: 0, notes: null,
      first_seen_at: ago(6 * DAY), last_synced_at: syncedAt, sport: 'hockey',
    },
    {
      item_id: 'v1|268901234567|0', rank: 18,
      title: '2024 Panini Prizm Caleb Williams Silver RC',
      current_price: cents(280), buy_it_now_price: null, shipping_cost: cents(5.49),
      listing_type: 'FixedPrice', condition_name: 'Ungraded',
      end_time: fromNow(18 * DAY), time_left: 'P18D',
      seller_id: 'pigskin_palace', seller_feedback: 5023,
      watcher_count: 98, bid_count: 0,
      image_url: `${IMG_BASE}/2d4a1e/ffffff?text=Football`,
      listing_url: 'https://www.ebay.com/itm/268901234567',
      status: 'Active', is_in_queue: 0, notes: null,
      first_seen_at: ago(3 * DAY), last_synced_at: syncedAt, sport: 'football',
    },
    {
      item_id: 'v1|478901234567|0', rank: null,
      title: '2023 Bowman Chrome Victor Wembanyama 1st RC Auto',
      current_price: cents(3400), buy_it_now_price: null, shipping_cost: cents(19.99),
      listing_type: 'Auction', condition_name: 'Ungraded',
      end_time: ago(1 * DAY), time_left: null,
      seller_id: 'spurs_card_shop', seller_feedback: 8901,
      watcher_count: 245, bid_count: 37,
      image_url: `${IMG_BASE}/8b2500/ffffff?text=Basketball`,
      listing_url: 'https://www.ebay.com/itm/478901234567',
      status: 'Sold', is_in_queue: 0, notes: 'Sold above expected — market is hot',
      first_seen_at: ago(10 * DAY), last_synced_at: ago(1 * DAY), sport: 'basketball',
    },
    {
      item_id: 'v1|589012345678|0', rank: null,
      title: '1986-87 Fleer Basketball Complete Set PSA Graded',
      current_price: cents(52000), buy_it_now_price: null, shipping_cost: 0,
      listing_type: 'Auction', condition_name: 'Graded',
      end_time: ago(2 * DAY), time_left: null,
      seller_id: 'hall_of_fame_cards', seller_feedback: 22456,
      watcher_count: 167, bid_count: 42,
      image_url: `${IMG_BASE}/8b2500/ffffff?text=Basketball`,
      listing_url: 'https://www.ebay.com/itm/589012345678',
      status: 'Sold', is_in_queue: 0, notes: 'Includes the Jordan RC — monster set',
      first_seen_at: ago(12 * DAY), last_synced_at: ago(2 * DAY), sport: 'basketball',
    },
  ]
}

// ---------------------------------------------------------------------------
// Generated items builder
// ---------------------------------------------------------------------------

function buildGeneratedItems(): SeedItem[] {
  const sportPool       = buildSportPool()
  const statusPool      = buildStatusPool()
  const listingTypePool = buildListingTypePool()
  const bucketPool      = buildBucketAssignments()

  const items: SeedItem[] = []

  for (let i = 0; i < 980; i++) {
    const sport       = sportPool[i]
    const status      = statusPool[i]
    let   listingType = listingTypePool[i]

    // Enforce: Sold items must have Auction or AuctionWithBIN
    if (status === 'Sold' && listingType === 'FixedPrice') listingType = 'Auction'

    const playerCandidates = PLAYERS.filter(p => p.sport === sport)
    const player   = rng.pick(playerCandidates.length > 0 ? playerCandidates : PLAYERS)
    const setCandidates = SETS[sport]
    const set      = rng.pick(setCandidates.length > 0 ? setCandidates : SETS.baseball)
    const grade    = pickGrade()
    const bucket   = bucketPool[i]
    const price    = generatePrice(bucket, grade)

    // Slots 0-179 → ranks 21-200; 20 mandatory items occupy ranks 1-18 (with 19-20 unranked/sold)
    const rank: number | null = i < 180 ? i + 21 : null

    const seller   = pickSeller(sport)
    const { end_time, time_left } = generateEndTime(status, listingType)

    const title    = generateTitle(player, set, grade)

    // Watcher/bid counts vary by status and listing type
    const watchers = status === 'Ended' ? 0 : Math.round(Math.abs(rng.between(0, 50) * (grade.gradeMultiplier / 2)))
    const bids     = (listingType === 'Auction' || listingType === 'AuctionWithBIN') && status !== 'Ended'
      ? rng.int(0, 25)
      : 0

    const daysAgo  = rng.between(1, 30)
    const item: SeedItem = {
      item_id: `v1|gen${String(i).padStart(6, '0')}|0`,
      rank,
      title,
      current_price: price,
      buy_it_now_price: listingType === 'AuctionWithBIN' ? Math.round(price * rng.between(1.2, 1.5)) : null,
      shipping_cost: rng.next() < 0.3 ? 0 : cents(rng.between(3, 25)),
      listing_type: listingType,
      condition_name: gradeToCondition(grade),
      end_time,
      time_left,
      seller_id: seller.id,
      seller_feedback: seller.feedback,
      watcher_count: watchers,
      bid_count: bids,
      image_url: IMAGE_BY_SPORT[sport],
      listing_url: `https://www.ebay.com/itm/gen${String(i).padStart(6, '0')}`,
      status,
      is_in_queue: 0,
      notes: null,
      first_seen_at: ago(daysAgo * DAY),
      last_synced_at: status === 'Active' ? syncedAt : ago(rng.between(1, 5) * DAY),
      sport,
    }

    items.push(item)
  }

  return items
}

// ---------------------------------------------------------------------------
// Build item pool
// ---------------------------------------------------------------------------

function buildItemPool(): SeedItem[] {
  const mandatory  = buildMandatoryItems()
  const generated  = buildGeneratedItems()
  return [...mandatory, ...generated]
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

function seed() {
  console.log('Running migrations...')
  runMigrations()

  const db = getDb()

  console.log('Clearing existing data...')
  // Disable FK checks so we can DELETE in any order regardless of referencing tables
  db.pragma('foreign_keys = OFF')
  const clearTable = (tbl: string) => {
    try { db.exec(`DELETE FROM ${tbl}`) } catch (_) { /* table may not exist */ }
  }
  clearTable('card_signals')
  clearTable('news_player_mentions')
  clearTable('card_player_mapping')
  clearTable('card_metadata')
  clearTable('price_targets')
  clearTable('events')
  clearTable('price_snapshots')
  clearTable('items')
  db.pragma('foreign_keys = ON')

  console.log('Building item pool (1000 items)...')
  const allItems = buildItemPool()

  // Prepare statements
  const stmtItem = db.prepare(`
    INSERT INTO items (
      item_id, rank, title, current_price, buy_it_now_price, shipping_cost,
      listing_type, condition_name, end_time, time_left, seller_id, seller_feedback,
      watcher_count, bid_count, image_url, listing_url, status, is_in_queue,
      notes, first_seen_at, last_synced_at
    ) VALUES (
      @item_id, @rank, @title, @current_price, @buy_it_now_price, @shipping_cost,
      @listing_type, @condition_name, @end_time, @time_left, @seller_id, @seller_feedback,
      @watcher_count, @bid_count, @image_url, @listing_url, @status, @is_in_queue,
      @notes, @first_seen_at, @last_synced_at
    )
  `)

  const stmtSnapshot = db.prepare(`
    INSERT INTO price_snapshots (item_id, price_cents, shipping, watcher_count, bid_count, recorded_at)
    VALUES (@item_id, @price_cents, @shipping, @watcher_count, @bid_count, @recorded_at)
  `)

  const stmtEvent = db.prepare(`
    INSERT INTO events (item_id, event_type, old_value, new_value, detected_at)
    VALUES (@item_id, @event_type, @old_value, @new_value, @detected_at)
  `)

  // Build all snapshots and events in memory first
  console.log('Generating snapshots and events...')
  const allSnapshots: SnapshotRow[] = []
  const allEvents: EventRow[] = []

  for (const item of allItems) {
    const count = rng.int(10, 15)
    const snaps = generateSnapshots(item, count)
    allSnapshots.push(...snaps)
    const evs = generateEventsForItem(item, snaps)
    allEvents.push(...evs)
  }

  // Single transaction for all inserts (atomicity + performance)
  console.log(`Inserting ${allItems.length} items, ${allSnapshots.length} snapshots, ${allEvents.length} events...`)
  db.transaction(() => {
    for (const item of allItems) stmtItem.run(item)
    for (const snap of allSnapshots) stmtSnapshot.run(snap)
    for (const ev of allEvents) stmtEvent.run(ev)
  })()

  // Seed signals for top-ranked items so the Signal column isn't blank
  console.log('Seeding signals for top-ranked items...')
  const signalDefs = [
    { item_id: 'v1|225678901234|0', event_type: 'callup', score: 2, confidence: 0.92, headline: 'Top prospect called up to majors', source: 'mlb_transactions' },
    { item_id: 'v1|334512098765|0', event_type: 'award', score: 3, confidence: 0.95, headline: 'MVP award winner announced', source: 'rotowire_rss' },
    { item_id: 'v1|276543210987|0', event_type: 'breakout', score: 1, confidence: 0.80, headline: 'Breakout performance — 4 HR week', source: 'espn_rss' },
    { item_id: 'v1|404876543210|0', event_type: 'injury_minor', score: -1, confidence: 0.88, headline: 'Day-to-day with hamstring tightness', source: 'rotowire_rss' },
    { item_id: 'v1|512345678901|0', event_type: 'trade_up', score: 2, confidence: 0.90, headline: 'Traded to contender ahead of deadline', source: 'mlb_transactions' },
    { item_id: 'v1|445678901234|0', event_type: 'injury_season', score: -3, confidence: 0.93, headline: 'Out for season — torn ACL confirmed', source: 'espn_rss' },
    { item_id: 'v1|678901234567|0', event_type: 'contract', score: 1, confidence: 0.85, headline: 'Signs 5-year extension worth $200M', source: 'google_news_rss' },
    { item_id: 'v1|912345678901|0', event_type: 'return_injury', score: 1, confidence: 0.82, headline: 'Activated from IL — expected to start tonight', source: 'rotowire_rss' },
  ]
  // Need news_items rows (FK) and a player_roster id (FK) for card_signals
  const rosterRow = db.prepare('SELECT id FROM player_roster LIMIT 1').get() as { id: number } | undefined
  const playerId = rosterRow?.id ?? 1
  const stmtNewsItem = db.prepare(`
    INSERT INTO news_items (source, content_hash, title, processed)
    VALUES (@source, @content_hash, @title, 1)
  `)
  const stmtSignal = db.prepare(`
    INSERT INTO card_signals
      (news_item_id, item_id, player_id, event_type, score, confidence, headline, source, source_url, expires_at)
    VALUES
      (@news_item_id, @item_id, @player_id, @event_type, @score, @confidence, @headline, @source, NULL, NULL)
  `)
  db.transaction(() => {
    for (let i = 0; i < signalDefs.length; i++) {
      const def = signalDefs[i]
      // Insert a news_items row first to satisfy FK
      const newsResult = stmtNewsItem.run({
        source: def.source,
        content_hash: `seed-signal-${i}`,
        title: def.headline,
      })
      stmtSignal.run({
        news_item_id: newsResult.lastInsertRowid,
        item_id: def.item_id,
        player_id: playerId,
        event_type: def.event_type,
        score: def.score,
        confidence: def.confidence,
        headline: def.headline,
        source: def.source,
      })
    }
  })()
  console.log(`  Signals:   ${signalDefs.length}`)

  // Summary
  const rankedCount   = allItems.filter(i => i.rank !== null).length
  const unrankedCount = allItems.filter(i => i.rank === null).length
  const activeCount   = allItems.filter(i => i.status === 'Active').length
  const soldCount     = allItems.filter(i => i.status === 'Sold').length
  const endedCount    = allItems.filter(i => i.status === 'Ended').length

  console.log(`\nSeed complete!`)
  console.log(`  Items:     ${allItems.length} (${rankedCount} ranked, ${unrankedCount} unranked)`)
  console.log(`  Status:    ${activeCount} active, ${soldCount} sold, ${endedCount} ended`)
  console.log(`  Snapshots: ${allSnapshots.length}`)
  console.log(`  Events:    ${allEvents.length}`)
}

seed()
