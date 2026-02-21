# Player Stats, News & Card Market Intelligence — Research Report

> Compiled: 2026-02-21
> Confidence: HIGH (85%+) across all sections
> Scope: Free/cheap APIs for MLB, NFL, NBA, NHL stats, news, card sales data, AI integration

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Sports Stats APIs](#1-sports-stats-apis)
3. [Sports News Sources](#2-sports-news-sources)
4. [Historical Card Sales Data](#3-historical-card-sales-data)
5. [Existing Tools in This Space](#4-existing-tools-in-this-space)
6. [AI Integration Approach](#5-ai-integration-approach)
7. [Implementation Architecture](#6-implementation-architecture)
8. [Recommended Tech Stack](#7-recommended-tech-stack)
9. [Database Schema Extensions](#8-database-schema-extensions)
10. [Cost Estimates](#9-cost-estimates)
11. [Sources](#sources)

---

## Executive Summary

**The best free path for a solo developer:**

| Need | Recommended Solution | Cost |
|------|---------------------|------|
| MLB stats/roster/injuries | MLB StatsAPI (statsapi.mlb.com) | FREE, no auth |
| NBA stats/game logs | ESPN hidden API or BallDontLie | FREE / $10/mo |
| NFL stats/injuries | ESPN hidden API | FREE, no auth |
| NHL stats/game logs | NHL Web API (api-web.nhle.com) | FREE, no auth |
| Breaking player news | RotoWire RSS + ESPN news endpoints | FREE |
| Card sales comps | eBay Browse API (already have) + 130point scraping | FREE |
| Card pricing database | SportsCardsPro API or CardHedger | $5-49/mo |
| AI title parsing | Claude Haiku 4.5 batch API | ~$0.50/month |
| AI player insights | Claude Haiku 4.5 | ~$2-5/month |

**Total estimated monthly cost: $3-15/month** (excluding VPS you already have)

---

## 1. Sports Stats APIs

### Tier 1: FREE, No Authentication Required

#### MLB StatsAPI (BEST FOR MLB)

The official MLB Stats API is completely free, requires no authentication, and provides comprehensive data including minor league stats — critical for prospect cards.

**Base URL:** `https://statsapi.mlb.com/api/v1`

| Endpoint | URL Pattern | Data |
|----------|-------------|------|
| Player search | `/people/search?names={name}` | Find player ID by name |
| Player info | `/people/{playerId}` | Bio, position, team, status |
| Season stats | `/people/{playerId}/stats?stats=season&season=2025&group=hitting` | Season batting/pitching |
| Game log | `/people/{playerId}/stats?stats=gameLog&season=2025&group=hitting` | Per-game stats |
| Roster | `/teams/{teamId}/roster` | Current 40-man roster |
| Transactions | `/transactions?playerId={playerId}` | Trades, IL stints, options, call-ups |
| Schedule | `/schedule?date={date}&sportId=1` | Today's games |
| Standings | `/standings?leagueId=103,104&season=2025` | Division standings |

**Minor league support:** Add `&gameType=R&leagueListId=milb_all` to stats endpoints to get MiLB data. This is critical for prospect card tracking (Bowman Chrome 1st autos, etc.).

**Rate limits:** Undocumented but generous. Community reports suggest 100+ requests/minute without issues. No API key needed.

**Data freshness:** Stats update within minutes of game completion. Transactions update same-day.

```typescript
// Example: Get Elly De La Cruz's 2025 game log
const response = await fetch(
  'https://statsapi.mlb.com/api/v1/people/682829/stats?stats=gameLog&season=2025&group=hitting'
);
const data = await response.json();
// data.stats[0].splits[] contains per-game stats
```

#### NHL Web API (BEST FOR NHL)

Free, no authentication, comprehensive stats including game logs.

**Base URL:** `https://api-web.nhle.com/v1`

| Endpoint | URL Pattern | Data |
|----------|-------------|------|
| Player landing | `/player/{playerId}/landing` | Bio, career stats, current team |
| Game log (current) | `/player/{playerId}/game-log/now` | Current season game log |
| Game log (season) | `/player/{playerId}/game-log/{season}/2` | Specific season (e.g., 20242025) |
| Team roster | `/roster/{teamAbbrev}/current` | Current roster |
| Standings | `/standings/now` | Current standings |
| Schedule | `/schedule/now` | Today's games |
| Stats leaders | `/skater-stats-leaders/current` | League leaders |

**Rate limits:** Undocumented, no auth required. Community reports indicate generous limits.

**Data freshness:** Near real-time during games, updated within minutes post-game.

#### ESPN Hidden API (BEST FOR NFL, backup for all sports)

ESPN's undocumented API powers their website and apps. Free, no auth, but could change without notice.

**Base URLs:**
- `site.api.espn.com` — scores, news, teams, standings
- `sports.core.api.espn.com` — athletes, detailed stats, odds
- `site.web.api.espn.com` — game summaries, athlete overviews

**NFL Endpoints (most useful):**

| Endpoint | URL Pattern | Data |
|----------|-------------|------|
| Player gamelog | `site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{id}/gamelog` | Per-game stats |
| Player overview | `site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{id}/overview` | Bio + stats |
| Player splits | `site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{id}/splits` | Stat splits |
| Team injuries | `sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/{id}/injuries` | Injury report |
| Transactions | `sports.core.api.espn.com/v2/sports/football/leagues/nfl/transactions` | Trades, signings |
| Team roster | `site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{id}/roster` | Full roster |
| News headlines | `site.api.espn.com/apis/site/v2/sports/football/nfl/news` | Latest NFL news |

**Works for ALL sports** — just swap the sport/league path:
- MLB: `/sports/baseball/mlb/`
- NBA: `/sports/basketball/nba/`
- NHL: `/sports/hockey/nhl/`

**Rate limits:** Undocumented. No published rate limiting, but exercise reasonable usage (< 60 req/min).

**Risk:** These endpoints are undocumented and ESPN can modify/remove them without notice. Use as primary for NFL, secondary for others.

### Tier 2: Freemium APIs

#### BallDontLie API

Multi-sport API with a free tier. Covers NBA, NFL, MLB, NHL and more.

**Base URL:** `https://api.balldontlie.io/v1`

| Plan | Price | Rate Limit | Features |
|------|-------|-----------|----------|
| Free | $0 | 5 req/min | Basic endpoints only |
| All-Star | $9.99/mo | 60 req/min | Game + team data |
| GOAT | $39.99/mo | 600 req/min | All data, one sport |
| All-Access | $299.99/mo | 600 req/min | All sports |

**Endpoints:** `/nba/v1/players`, `/nba/v1/stats`, `/nfl/v1/games`, `/mlb/v1/games`, `/nhl/v1/games`

**Assessment:** Free tier is too limited (5 req/min). The $10/mo All-Star tier is decent but the official league APIs are free and better. Skip unless you need a unified API.

#### MySportsFeeds

Covers NFL, MLB, NBA, NHL with a free tier for personal/private use.

**Assessment:** Free for non-commercial personal use, but requires application review. Good data quality but the approval process adds friction.

### Tier 3: Enterprise (Skip These)

| Service | Why Skip |
|---------|----------|
| Sportradar | Enterprise pricing, negotiated contracts. Not for solo devs. |
| SportsDataIO | Free trial only, then paid tiers. Pricing not published. |
| Stats Perform | Enterprise only. |

### Recommended Strategy by Sport

```
MLB: statsapi.mlb.com (FREE, official, includes MiLB)
     └── Backup: ESPN hidden API

NFL: ESPN hidden API (FREE, comprehensive)
     └── Backup: BallDontLie ($10/mo)

NBA: ESPN hidden API (FREE)
     └── Backup: BallDontLie ($10/mo)

NHL: api-web.nhle.com (FREE, official)
     └── Backup: ESPN hidden API
```

---

## 2. Sports News Sources

### Breaking News — Player-Specific

#### ESPN News API (FREE, no auth)

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/news
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/news?athlete={athleteId}
```

Returns headlines, descriptions, and links. Can filter by athlete ID for player-specific news.

#### RotoWire RSS Feeds (FREE)

RotoWire generates 250+ player notes per day during MLB/NFL seasons. They offer XML RSS feeds by sport.

| Sport | Feed URL |
|-------|----------|
| MLB | `https://www.rotowire.com/rss/news.php?sport=MLB` |
| NFL | `https://www.rotowire.com/rss/news.php?sport=NFL` |
| NBA | `https://www.rotowire.com/rss/news.php?sport=NBA` |
| NHL | `https://www.rotowire.com/rss/news.php?sport=NHL` |

**Content:** In-game injuries, transactions, lineup changes, player status updates.
**Freshness:** Near real-time during games, multiple updates per hour.
**Format:** RSS XML, easy to parse with Node.js (`rss-parser` npm package).

#### MLB-Specific Transaction Feed

```
GET https://statsapi.mlb.com/api/v1/transactions?startDate=2025-03-01&endDate=2025-03-15
```

Returns all official MLB transactions (trades, IL moves, options, call-ups, DFA) in JSON. This is the most reliable source for prospect call-up/demotion news.

#### ESPN Transactions API

```
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/transactions
GET https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/transactions
```

Official transactions across all sports.

### News Aggregation APIs

| Service | Free Tier | Relevance |
|---------|-----------|-----------|
| NewsAPI.org | Free for dev, $449+/mo production | Overkill for this use case |
| NewsAPI.ai | 2000 searches/30 days free | Decent free option |
| Google News RSS | Free, no auth | `news.google.com/rss/search?q={player}+baseball+card` |

**Recommendation:** Use Google News RSS for supplemental news. No API key needed:
```
https://news.google.com/rss/search?q=%22Elly+De+La+Cruz%22+baseball&hl=en-US&gl=US&ceid=US:en
```

### Sports Card Hobby News

| Source | RSS Feed | Focus |
|--------|----------|-------|
| Cardboard Connection | `https://www.cardboardconnection.com/feed` | Checklists, releases, hobby news |
| Sports Collectors Daily | `https://www.sportscollectorsdaily.com/feed` | Card market news |
| Cardlines | `https://cardlines.com/feed` | Box breaks, release info |
| Blowout Buzz | `https://www.blowoutcards.com/blog/feed` | Hobby industry news |
| Beckett | `https://www.beckett.com/news/feed` | Pricing, grading, market |

### Twitter/X

X's API is paid ($100/mo basic tier). For a solo dev project, skip the official API and instead:
- Use RSS bridges like `nitter.net/user/rss` (if still available)
- Follow key accounts manually and use their content as reference
- Key accounts: @CardPurchaser, @SlabStox, @sports_sell, @CardboardEchoes

### Recommended News Architecture

```
Priority 1 (Cron every 15 min):
  - MLB StatsAPI transactions endpoint
  - ESPN transactions endpoints (all sports)
  - RotoWire RSS feeds (all 4 sports)

Priority 2 (Cron every hour):
  - Google News RSS for watched players
  - ESPN news endpoints filtered by athlete ID

Priority 3 (Cron every 6 hours):
  - Sports card hobby RSS feeds
  - Cardboard Connection, Beckett, etc.
```

---

## 3. Historical Card Sales Data

### What You Already Have: eBay Browse API

Your app already has eBay API access. The Browse API can search completed listings:

```
GET https://api.ebay.com/buy/browse/v1/item_summary/search
  ?q=elly+de+la+cruz+bowman+chrome+auto
  &filter=conditions:{GRADED},buyingOptions:{FIXED_PRICE|AUCTION}
  &sort=newlyListed
```

**Limitation:** The Browse API searches active listings. For sold data, you need the **Marketplace Insights API** which is restricted to enterprise/partner developers. Individual developers cannot access it.

**Workaround for sold comps:** The Browse API `getItem` endpoint returns sold status for specific items. If you track items from your watchlist and they sell, you capture the sold price. Over time, this builds a personal sold database.

### 130point.com

**What it does:** Aggregates eBay sold data going back years (beyond eBay's 90-day limit). Shows "Best Offer Accepted" prices that eBay hides. Covers 15+ million sold items across eBay, PWCC, Goldin, Heritage, MySlabs, Pristine Auctions.

**API:** No public API. Could scrape with care, but check TOS.

**Best use:** Manual research reference. Link to 130point searches from your app's UI for user-initiated lookups.

### PSA Public API

**URL:** `https://www.psacard.com/publicapi`
**Auth:** OAuth 2.0 with PSA account credentials
**Cost:** Free with PSA account (membership starts at $99/year for basic)

**Available data:**
- Cert verification (grade, card details by cert number)
- Population reports (how many graded at each level)
- Auction prices realized
- Price guide data

**Usefulness:** If users enter PSA cert numbers, you can pull grade data and population counts. Population data is valuable — low-pop high-grade cards command premium prices.

### SportsCardsPro API

**URL:** `https://www.sportscardspro.com/api-documentation`
**Auth:** API token (requires paid subscription)
**Cost:** Requires "Legendary" subscription tier (pricing not published, estimated $10-20/mo)

**Available endpoints:**
- **Prices API:** Single product pricing data (equivalent to one CSV row)
- **Products Search API:** Search across 2+ million cards, returns first 20 matches

**Data format:** JSON, prices in pennies (integer cents, same as your app).

**Assessment:** Good price database but requires paid subscription. Consider for Phase 2.

### CardHedger API

**URL:** `https://api.cardhedger.com/docs`
**Auth:** API key
**Cost:** Starting at $49/month

**Available data:**
- 2.2+ million cards across all major sports
- Live pricing from eBay, Fanatics, Heritage Auctions
- Historical sales data
- Pricing for every grade (PSA, BGS, SGC, CGC, TAG, Raw)
- RESTful API with OpenAPI documentation

**Assessment:** Most comprehensive data API available but expensive for a personal tool. Consider only if monetizing the app.

### How the Big Platforms Get Their Data

| Platform | Primary Data Source | Method |
|----------|-------------------|--------|
| CardLadder | 14+ marketplaces (eBay, Goldin, Heritage, MySlabs) | API partnerships + scraping + manual vetting |
| Alt.xyz | eBay, Goldin, their own marketplace | Proprietary aggregation |
| 130point | eBay completed listings, PWCC, Goldin, Heritage | eBay API + scraping |
| Market Movers | Major online marketplaces | API + scraping |
| Card Hedge | eBay, Fanatics, Heritage | APIs + data partnerships |

**Key insight:** CardLadder was acquired by Collectors Universe (PSA's parent company), giving them direct access to PSA grading data. Alt.xyz runs their own marketplace, so they have first-party transaction data. Most others rely on eBay's API ecosystem plus scraping.

### Recommended Sales Data Strategy

**Phase 1 (Free):**
1. Track sold items from your own watchlist via Browse API `getItem`
2. Build local sold database over time
3. Link to 130point.com for on-demand comp lookups
4. Use Google to find recent sold prices: `site:ebay.com "sold" "{card description}"`

**Phase 2 (Budget):**
1. Add PSA Public API for cert verification and population data ($99/yr PSA membership)
2. Consider SportsCardsPro API for baseline pricing ($10-20/mo)

**Phase 3 (Scale):**
1. CardHedger API for comprehensive pricing ($49/mo)
2. Or build your own scraper for 130point/eBay completed listings

---

## 4. Existing Tools in This Space

### CardLadder (cardladder.com)

**Owner:** Collectors Universe (PSA parent company)
**Pricing:** Free basic / $20/mo Pro ($200/yr)

| Feature | Free | Pro |
|---------|------|-----|
| Search card values | Yes | Yes |
| Daily hobby news | Yes | Yes |
| Sales recaps | Yes | Yes |
| Card Ladder Index | Yes | Yes |
| Collection tracking | No | Yes (accurate value estimates) |
| All-time sales history | No | Yes (14 marketplaces) |
| Player market performance | No | Yes |
| Price alerts | No | Yes |
| Population growth tracking | No | Yes |
| Advanced search/filter/sort | No | Yes |

**Data depth:** 100+ million historical sales since 2000.
**Strengths:** Most comprehensive sales history, PSA integration (parent company), vetted data.
**Weakness:** No real-time stats/news integration. Focused on pricing, not player performance.

### Alt.xyz (alt.xyz)

**Model:** Marketplace + tools
**Pricing:** Free to browse, commission on sales

**Features:**
- Card scanning for instant identification
- Real-time pricing and trend tracking (proprietary "Alt Value")
- Portfolio management and performance tracking
- Fixed price marketplace + Liquid Auctions (14-day rolling)
- Vaulting service for physical cards
- $200M+ in transactions processed

**Strengths:** Modern UX, investment-focused, vaulting.
**Weakness:** Walled garden — best features require buying/selling through Alt.

### SlabStox (slabstox.com)

**Merged with CardLadder** — partnership for shared data.
**Focus:** Content + data analytics

**Features:**
- Predictive pricing model (explains 73% of price variance)
- Daily Slab newsletter (free)
- Card Market Report (monthly)
- SX100 Index (top 100 sports cards)
- Podcast + YouTube content

**Strengths:** Analytical approach, predictive modeling.
**Weakness:** More content than tool. No self-service API.

### Market Movers (marketmoversapp.com)

**Owner:** Sports Card Investor
**Pricing:** $9.99 (25 cards) / $24.99 (250 cards) / $49.99 (unlimited)

**Features:**
- Collection tracking with daily price updates
- Price alerts (20 alerts on mid-tier, unlimited on top tier)
- Trends sorting (price increases/decreases)
- Deals identification (underpriced cards)
- 2+ million cards database across sports + TCG

**Strengths:** Mobile-first, good for active flippers.
**Weakness:** No stats/news integration, no AI insights.

### Card Hedge (cardhedger.com)

**Pricing:** Free basic search / Premium tiers / API from $49/mo

**Features:**
- 2.2+ million cards across all sports and grades
- AI-powered market analysis
- CPM scoring and top picks
- Market movers (gainers/losers)
- Anomaly detection for unusual market activity
- Camera integration for card scanning
- Developer API available

**Strengths:** AI integration, anomaly detection, developer API.
**Weakness:** Newer platform, smaller user base.

### Gap Analysis — What They All Miss

| Gap | Opportunity |
|-----|-------------|
| **No real-time player stats** | None integrate live stats with card prices |
| **No prospect pipeline tracking** | MiLB stats → call-up probability → card value impact |
| **No injury-to-price correlation** | Injury news doesn't auto-link to card price alerts |
| **No personal watchlist integration** | All are standalone; none connect to YOUR eBay watchlist |
| **No AI-powered contextual notes** | No one generates "why this card matters right now" summaries |
| **No unified dashboard** | Stats + news + card prices + your watchlist in one view |
| **No "sleeper" identification** | Combining stats trajectory + card price = buy signal |

**Your unique value proposition:** An eBay watchlist monitor that understands WHO the player on the card is, what they're doing RIGHT NOW on the field, and whether the card is over/underpriced relative to the player's trajectory. Nobody does this.

---

## 5. AI Integration Approach

### Task 1: Parse Player Identity from Listing Titles

This is the highest-value AI task. eBay listing titles are messy, abbreviated, and inconsistent.

**Examples to parse:**
```
"2023 Topps Chrome Elly De La Cruz RC Auto /25 BGS 9.5"
"JASSON DOMINGUEZ 2022 Bowman Chrome 1st AUTO PSA 10 #BCA-JD"
"Mike Trout 2011 Topps Update RC US175 PSA 10 GEM MINT"
"2024 Panini Prizm Silver CeeDee Lamb #45 SGC 9.5"
"VICTOR WEMBANYAMA 2023-24 Panini Select Rookie /199 BGS 9"
```

**Desired output:**
```json
{
  "player": "Elly De La Cruz",
  "year": 2023,
  "brand": "Topps Chrome",
  "cardNumber": null,
  "attributes": ["RC", "Auto", "/25"],
  "grading": { "company": "BGS", "grade": 9.5 },
  "sport": "baseball",
  "confidence": 0.95
}
```

**Implementation — Claude Haiku 4.5 with Structured Output:**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface CardParsed {
  player: string;
  year: number | null;
  brand: string | null;
  cardNumber: string | null;
  attributes: string[];
  grading: { company: string; grade: number } | null;
  sport: 'baseball' | 'football' | 'basketball' | 'hockey' | 'unknown';
  confidence: number;
}

async function parseCardTitle(title: string): Promise<CardParsed> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20250815',
    max_tokens: 256,
    system: `You are a sports card listing parser. Extract structured data from eBay listing titles.

Rules:
- RC = Rookie Card
- Auto = Autograph
- /25 means numbered to 25
- PSA, BGS, SGC, CGC = grading companies
- 1st = Bowman 1st Bowman (prospect card)
- Prizm, Select, Chrome, Mosaic = brands
- Detect sport from brand context (Topps/Bowman=baseball, Panini Prizm/Select=multi-sport, etc.)`,
    messages: [{
      role: 'user',
      content: `Parse this eBay listing title into structured card data:\n\n"${title}"`
    }],
    tool_choice: { type: 'tool', name: 'parse_card' },
    tools: [{
      name: 'parse_card',
      description: 'Parse a sports card listing title',
      input_schema: {
        type: 'object',
        properties: {
          player: { type: 'string', description: 'Full player name' },
          year: { type: ['integer', 'null'], description: 'Card year' },
          brand: { type: ['string', 'null'], description: 'Card brand/set' },
          cardNumber: { type: ['string', 'null'], description: 'Card number' },
          attributes: {
            type: 'array',
            items: { type: 'string' },
            description: 'RC, Auto, /25, 1st, Refractor, Prizm, etc.'
          },
          grading: {
            type: ['object', 'null'],
            properties: {
              company: { type: 'string' },
              grade: { type: 'number' }
            }
          },
          sport: { type: 'string', enum: ['baseball', 'football', 'basketball', 'hockey', 'unknown'] },
          confidence: { type: 'number', description: '0-1 confidence score' }
        },
        required: ['player', 'year', 'brand', 'attributes', 'sport', 'confidence']
      }
    }]
  });

  const toolUse = response.content.find(c => c.type === 'tool_use');
  return toolUse?.input as CardParsed;
}
```

**Cost estimate for title parsing:**
- Average listing title: ~15 tokens input + ~50 tokens system + ~80 tokens output = ~145 tokens
- Claude Haiku 4.5: $1/MTok input, $5/MTok output
- Per card: $0.000065 input + $0.0004 output = $0.000465/card
- 400 watchlist items: ~$0.19 per full parse
- With batch API (50% discount): ~$0.10 per full parse
- Monthly (re-parse new items only, ~50/month): ~$0.02/month

**Optimization — Cache aggressively.** Once a title is parsed, store the result. Only re-parse when new items arrive.

### Task 2: Generate Player Context Notes

For each unique player on your watchlist, generate a contextual summary combining stats + news.

**Prompt template:**

```typescript
const prompt = `You are a sports card market analyst. Given the following data about a player,
write a brief (2-3 sentence) market-relevant summary for a card collector.

Player: ${player.name}
Sport: ${player.sport}
Team: ${player.team}
Position: ${player.position}

Recent Stats (last 10 games):
${formatStats(player.recentStats)}

Season Stats:
${formatSeasonStats(player.seasonStats)}

Recent News:
${formatNews(player.recentNews)}

Recent Card Sales Context:
${formatSales(player.cardSales)}

Write a brief collector-focused insight. Focus on: current performance trajectory,
any news that affects card values (injuries, trades, call-ups, awards), and whether
this looks like a buy/hold/sell moment for their cards.`;
```

**Example output:**
```
"Elly De La Cruz is hitting .312 with 4 HR in his last 10 games, showing significant
improvement after a slow April (.218). His 2023 Bowman Chrome autos have rebounded
from a $800 low to $1,200 range. With All-Star voting starting next week and his
current hot streak, there's upside potential if he makes the team."
```

**Cost estimate:**
- Input: ~500 tokens (stats + news context)
- Output: ~100 tokens
- Per player: ~$0.001
- 50 unique players on watchlist: ~$0.05 per update cycle
- Daily updates: ~$1.50/month

### Task 3: Sleeper Identification

Batch-process all watched players to identify buy opportunities.

```typescript
const sleeperPrompt = `Analyze these players and their card market positions.
Identify any "sleeper" opportunities where:
1. Player stats are trending significantly upward
2. But card prices haven't caught up yet
3. Or there's upcoming catalyst (call-up, return from injury, contract year)

Players data:
${JSON.stringify(playersWithStatsAndPrices)}

Return the top 3 opportunities with reasoning.`;
```

**Cost:** ~$0.01 per batch analysis. Run weekly = $0.04/month.

### Cost Management Strategy

| Strategy | Savings |
|----------|---------|
| Use Haiku 4.5 (not Sonnet/Opus) | 10-30x cheaper than Opus |
| Batch API for title parsing | 50% discount |
| Cache all AI results | Only re-process on new data |
| Prompt caching for system prompts | Additional savings on repeated patterns |
| Daily batches (not real-time) | Fewer API calls |

**Total estimated AI cost: $2-5/month for 400-item watchlist**

---

## 6. Implementation Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    eBay Watchlist Monitor + Intelligence             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  EXISTING (every 10 min):                                           │
│  ┌──────────────────┐     ┌──────────────────┐                     │
│  │ eBay Trading API  │────→│ Sync Service     │────→ SQLite        │
│  │ GetMyeBayBuying   │     │ (watchlist sync)  │     (items table)  │
│  └──────────────────┘     └──────────────────┘                     │
│                                                                     │
│  NEW — Player Intelligence Pipeline:                                │
│                                                                     │
│  ┌──────────────────┐                                               │
│  │ 1. PARSE TITLES  │  On new item → Claude Haiku → player_cards   │
│  │    (event-driven) │  Cache result, never re-parse same title     │
│  └────────┬─────────┘                                               │
│           │                                                         │
│  ┌────────▼─────────┐                                               │
│  │ 2. FETCH STATS   │  Cron every 6 hours → MLB/NHL/ESPN APIs      │
│  │    (scheduled)    │  Only for players on watchlist                │
│  └────────┬─────────┘                                               │
│           │                                                         │
│  ┌────────▼─────────┐                                               │
│  │ 3. FETCH NEWS    │  Cron every 15 min → RotoWire RSS + ESPN     │
│  │    (scheduled)    │  Filter to only watched players              │
│  └────────┬─────────┘                                               │
│           │                                                         │
│  ┌────────▼─────────┐                                               │
│  │ 4. AI SUMMARY    │  Cron daily → Claude Haiku batch             │
│  │    (scheduled)    │  Generate contextual notes per player        │
│  └────────┬─────────┘                                               │
│           │                                                         │
│  ┌────────▼─────────┐                                               │
│  │ 5. SERVE TO UI   │  API routes serve enriched data              │
│  │    (on demand)    │  Player card → stats + news + AI notes      │
│  └──────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Scheduling Strategy

| Task | Frequency | Trigger | Resource Impact |
|------|-----------|---------|-----------------|
| Watchlist sync | Every 10 min | node-cron | Existing, no change |
| Title parsing | On new item | Post-sync hook | ~1 API call per new item |
| Stats fetch | Every 6 hours | node-cron | ~50 HTTP calls (free APIs) |
| News fetch | Every 15 min | node-cron | ~10 RSS feeds + 2 API calls |
| AI summaries | Daily at 6 AM | node-cron | ~50 Haiku calls (batch) |
| Sleeper analysis | Weekly (Monday) | node-cron | 1 Haiku call |

### Processing Flow for New Watchlist Item

```
1. Sync detects new item "2023 Topps Chrome Elly De La Cruz RC Auto /25"
2. Check player_cards cache — title not seen before
3. Call Claude Haiku to parse → { player: "Elly De La Cruz", sport: "baseball", ... }
4. Check players table — player exists?
   YES → Link card to existing player record
   NO  → Create player record, queue stats fetch
5. If player is new, immediately fetch:
   - MLB StatsAPI: /people/search?names=Elly De La Cruz → get playerId
   - MLB StatsAPI: /people/{id}/stats?stats=season → current stats
   - MLB StatsAPI: /transactions?playerId={id} → recent transactions
6. Store everything in SQLite
7. Next AI summary cycle generates contextual note
```

### API Route Extensions

Add these new routes alongside existing ones:

```
GET /api/items/[itemId]/player    → Player stats + news + AI notes for this item
GET /api/players                  → All tracked players with latest stats
GET /api/players/[playerId]       → Single player detail
GET /api/players/sleepers         → AI-identified buy opportunities
GET /api/news                     → Recent news for all watched players
```

---

## 7. Recommended Tech Stack

### New Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",  // Claude API for AI features
    "rss-parser": "^3.13.0"           // Parse RotoWire + hobby RSS feeds
  }
}
```

**No other new dependencies needed.** All sports APIs are plain HTTP/JSON — use native `fetch()`.

### File Structure Additions

```
src/
├── lib/
│   ├── intelligence/
│   │   ├── title-parser.ts        # Claude Haiku title → structured data
│   │   ├── player-resolver.ts     # Map parsed names → player IDs
│   │   ├── stats-fetcher.ts       # MLB/NHL/ESPN API clients
│   │   ├── news-fetcher.ts        # RotoWire RSS + ESPN news
│   │   ├── ai-summarizer.ts       # Generate player context notes
│   │   └── sleeper-detector.ts    # Weekly sleeper analysis
│   ├── db/
│   │   ├── players.ts             # Players CRUD
│   │   ├── player-stats.ts        # Stats snapshots
│   │   ├── player-news.ts         # News items cache
│   │   └── player-cards.ts        # Card→Player mapping
│   └── scheduler.ts               # Add new cron jobs
├── app/
│   └── api/
│       ├── players/
│       │   ├── route.ts           # GET all tracked players
│       │   └── [playerId]/
│       │       └── route.ts       # GET single player detail
│       ├── news/
│       │   └── route.ts           # GET recent player news
│       └── items/
│           └── [itemId]/
│               └── player/
│                   └── route.ts   # GET player data for item
└── components/
    └── player/
        ├── player-card.tsx        # Player info display
        ├── stats-summary.tsx      # Recent stats table
        ├── news-feed.tsx          # Player-specific news
        └── ai-insight.tsx         # AI-generated notes
```

---

## 8. Database Schema Extensions

```sql
-- New migration: 002_player_intelligence.sql

-- Players we're tracking (one row per unique player)
CREATE TABLE players (
  player_id       TEXT PRIMARY KEY,           -- MLB: "682829", NHL: "8478402", etc.
  name            TEXT NOT NULL,
  sport           TEXT NOT NULL,              -- baseball, football, basketball, hockey
  team            TEXT,
  position        TEXT,
  status          TEXT DEFAULT 'active',      -- active, injured, minors, retired
  league_api_id   TEXT,                       -- External API player ID
  api_source      TEXT,                       -- mlb_statsapi, nhl_api, espn
  headshot_url    TEXT,
  last_stats_at   TEXT,                       -- Last time stats were fetched
  last_news_at    TEXT,                       -- Last time news was fetched
  ai_summary      TEXT,                       -- Latest AI-generated summary
  ai_summary_at   TEXT,                       -- When summary was generated
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_players_sport ON players(sport);
CREATE INDEX idx_players_name ON players(name);

-- Mapping: which cards (items) belong to which player
CREATE TABLE player_cards (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id         TEXT NOT NULL REFERENCES items(item_id),
  player_id       TEXT NOT NULL REFERENCES players(player_id),
  year            INTEGER,
  brand           TEXT,
  card_number     TEXT,
  attributes      TEXT,                       -- JSON array: ["RC", "Auto", "/25"]
  grading_company TEXT,
  grade           REAL,
  parse_confidence REAL,                     -- 0-1 from AI parser
  raw_title       TEXT,                       -- Original listing title
  parsed_at       TEXT DEFAULT (datetime('now')),
  UNIQUE(item_id)                             -- One parse per item
);

CREATE INDEX idx_player_cards_player ON player_cards(player_id);
CREATE INDEX idx_player_cards_item ON player_cards(item_id);

-- Player stats snapshots
CREATE TABLE player_stats (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id       TEXT NOT NULL REFERENCES players(player_id),
  season          TEXT,                       -- "2025", "2024-25"
  stat_type       TEXT NOT NULL,              -- season, last_10, career
  stats_json      TEXT NOT NULL,              -- Full stats as JSON
  fetched_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_player_stats ON player_stats(player_id, stat_type, fetched_at);

-- News items cache
CREATE TABLE player_news (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id       TEXT REFERENCES players(player_id),  -- NULL if general hobby news
  headline        TEXT NOT NULL,
  summary         TEXT,
  source          TEXT,                       -- rotowire, espn, cardboard_connection
  source_url      TEXT,
  news_type       TEXT,                       -- injury, transaction, performance, hobby
  published_at    TEXT,
  fetched_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_player_news_player ON player_news(player_id, published_at);
CREATE INDEX idx_player_news_type ON player_news(news_type, published_at);

-- Title parse cache (avoid re-parsing identical titles)
CREATE TABLE title_parse_cache (
  title_hash      TEXT PRIMARY KEY,           -- SHA256 of normalized title
  raw_title       TEXT NOT NULL,
  parsed_json     TEXT NOT NULL,              -- Full parse result as JSON
  created_at      TEXT DEFAULT (datetime('now'))
);
```

---

## 9. Cost Estimates

### Monthly Operating Costs

| Service | Usage | Cost |
|---------|-------|------|
| Claude Haiku 4.5 (title parsing) | ~50 new items/month | $0.02 |
| Claude Haiku 4.5 (daily summaries) | 50 players x 30 days | $1.50 |
| Claude Haiku 4.5 (sleeper analysis) | 4x/month | $0.04 |
| MLB StatsAPI | Unlimited | FREE |
| NHL Web API | Unlimited | FREE |
| ESPN Hidden API | Unlimited | FREE |
| RotoWire RSS | Unlimited | FREE |
| Google News RSS | Unlimited | FREE |
| Hobby RSS feeds | Unlimited | FREE |
| **TOTAL** | | **~$1.56/month** |

### Optional Add-ons

| Service | Cost | Value Add |
|---------|------|-----------|
| PSA membership (cert API) | $99/year ($8.25/mo) | Grade verification, population data |
| BallDontLie All-Star | $9.99/mo | Unified API, better rate limits |
| SportsCardsPro API | ~$15/mo (est.) | Baseline card pricing database |
| CardHedger API | $49/mo | Comprehensive pricing + grades |

### Resource Impact on Hetzner VPS (4GB RAM)

| Component | Memory | CPU | Disk |
|-----------|--------|-----|------|
| Existing app (Next.js + SQLite) | ~200MB | Low | ~50MB |
| RSS parsing (rss-parser) | ~10MB | Negligible | - |
| Stats API calls (fetch) | ~5MB | Negligible | - |
| AI API calls (Anthropic SDK) | ~10MB | Negligible | - |
| Player data in SQLite | - | - | ~10MB/year |
| News cache in SQLite | - | - | ~20MB/year |
| **Total additional** | **~25MB** | **Negligible** | **~30MB/year** |

This fits comfortably within the 4GB Hetzner VPS with room to spare.

---

## Dominguez Example — Full Data Flow

For a watchlist item "Jason Dominguez 2022 Bowman Chrome 1st Auto":

**Step 1: Title Parse (Claude Haiku)**
```json
{
  "player": "Jasson Dominguez",
  "year": 2022,
  "brand": "Bowman Chrome",
  "attributes": ["1st", "Auto"],
  "sport": "baseball",
  "confidence": 0.92
}
```

Note: AI correctly identifies "Jason" as "Jasson" (common misspelling in listings).

**Step 2: Player Resolution**
```
MLB StatsAPI: /people/search?names=Jasson Dominguez
→ playerId: 691176, team: "New York Yankees", position: "CF"
```

**Step 3: Stats Fetch**
```
MLB StatsAPI: /people/691176/stats?stats=gameLog&season=2025&group=hitting
→ Last 10 games: .320 BA, 3 HR, 8 RBI, 2 SB

MLB StatsAPI: /people/691176/stats?stats=season&season=2025&group=hitting
→ Season: .267 BA, 12 HR, 38 RBI (if in majors)

MLB StatsAPI: /transactions?playerId=691176
→ "2025-04-15: Recalled from AAA Scranton/Wilkes-Barre"
```

**Step 4: News Fetch**
```
RotoWire RSS → "Dominguez: Hit 3 HRs in last 5 games"
ESPN News → "Yankees prospect Dominguez showing power surge"
MLB Transactions → "Optioned to AAA on March 28, recalled April 15"
```

**Step 5: AI Summary (Claude Haiku)**
```
"Jasson Dominguez is surging since his April 15 call-up, hitting .320 with 3 HR
in his last 10 games. His 2022 Bowman Chrome 1st autos peaked at $15,000 (BGS 9.5)
in 2022 and are now trading around $2,000 — historically low relative to his
prospect pedigree. If he maintains this pace through June, All-Star consideration
could trigger a significant price recovery. HIGH SPECULATIVE UPSIDE."
```

**What the user sees in the UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🏷️ 2022 Bowman Chrome 1st Auto — Jasson Dominguez              │
│ Current Price: $45.00 | Watchers: 12 | Ends: 3d 4h            │
│                                                                 │
│ 📊 PLAYER STATS (Yankees CF)                                    │
│ Last 10: .320 / 3 HR / 8 RBI / 2 SB                           │
│ Season:  .267 / 12 HR / 38 RBI                                 │
│                                                                 │
│ 📰 RECENT NEWS                                                  │
│ - Hit 3 HRs in last 5 games (2h ago)                           │
│ - Recalled from AAA April 15 (6 days ago)                       │
│                                                                 │
│ 🤖 AI INSIGHT                                                   │
│ Dominguez is surging since recall. 2022 Bowman Chrome 1st       │
│ autos at historical lows (~$2K from $15K peak). If pace holds   │
│ through June, All-Star buzz could drive recovery.               │
│ Signal: SPECULATIVE BUY                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Title Parsing + Player Resolution (1-2 days)
- Add `@anthropic-ai/sdk` dependency
- Implement `title-parser.ts` with Claude Haiku
- Implement `player-resolver.ts` (MLB StatsAPI search)
- Add `player_cards` and `players` tables
- Hook into sync-service: parse new items post-sync
- Add `GET /api/items/[itemId]/player` route

### Phase 2: Stats Integration (1-2 days)
- Implement `stats-fetcher.ts` for MLB/NHL/ESPN
- Add `player_stats` table
- Add cron job (every 6 hours)
- Add `GET /api/players` and `GET /api/players/[id]` routes

### Phase 3: News Integration (1 day)
- Add `rss-parser` dependency
- Implement `news-fetcher.ts` (RotoWire RSS + ESPN)
- Add `player_news` table
- Add cron job (every 15 min)
- Add `GET /api/news` route

### Phase 4: AI Summaries (1 day)
- Implement `ai-summarizer.ts`
- Add daily cron job
- Display AI notes in item detail page

### Phase 5: UI Components (2-3 days)
- `player-card.tsx` — player info inline on watchlist table
- `stats-summary.tsx` — stats table on item detail page
- `news-feed.tsx` — player news on item detail page
- `ai-insight.tsx` — AI summary card
- Extend main table with sport icon + player indicator columns

### Phase 6: Sleeper Detection (1 day)
- Implement `sleeper-detector.ts`
- Weekly cron job
- Add `GET /api/players/sleepers` route
- Suggestion carousel integration

**Total estimated effort: 7-10 days**

---

## Sources

### Sports Stats APIs
- [MLB StatsAPI](https://statsapi.mlb.com/) — Official MLB stats, free, no auth
- [MLB StatsAPI Docs](https://statsapi.mlb.com/docs/) — Swagger documentation
- [NHL API Reference](https://github.com/Zmalski/NHL-API-Reference) — Unofficial NHL endpoint docs
- [ESPN Hidden API](https://sportsapis.dev/espn-api) — Undocumented ESPN endpoints
- [ESPN NFL Endpoints](https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c) — NFL-specific ESPN API gist
- [BallDontLie API](https://www.balldontlie.io/) — Multi-sport API, free tier available
- [Sportradar Developer Portal](https://developer.sportradar.com/) — Enterprise sports data (expensive)

### Sports News
- [RotoWire RSS Feeds](https://www.rotowire.com/rss/) — Player news feeds by sport
- [ESPN News API](https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b) — Hidden ESPN API docs

### Card Sales Data
- [130point.com](https://130point.com/sales/) — eBay sold data aggregator
- [PSA Public API](https://www.psacard.com/publicapi) — Cert verification, population reports
- [SportsCardsPro API](https://www.sportscardspro.com/api-documentation) — Card pricing CSV/API
- [CardHedger API](https://api.cardhedger.com/docs) — Enterprise card data API
- [eBay Marketplace Insights](https://developer.ebay.com/api-docs/buy/marketplace-insights/resources/item_sales/methods/search) — Restricted to enterprise developers

### Existing Tools
- [CardLadder Pricing](https://www.cardladder.com/pricing) — $20/mo Pro, 100M+ sales history
- [Alt.xyz](https://www.alt.xyz/) — Card marketplace with pricing tools
- [Market Movers App](https://www.marketmoversapp.com/) — Collection tracking, $10-50/mo
- [Card Hedge](https://www.cardhedger.com/) — AI-powered card pricing, free search
- [SlabStox](https://www.slabstox.com/) — Content + analytics, merged with CardLadder

### AI Integration
- [Claude Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — Schema-guaranteed JSON extraction
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Haiku 4.5: $1/$5 per MTok
- [Anthropic SDK (npm)](https://www.npmjs.com/package/@anthropic-ai/sdk) — Official Node.js client

### Card Collector Communities
- [Blowout Forums](https://www.blowoutforums.com/) — Largest sports card forum
- [Sports Card Forum](https://www.sportscardforum.com/) — Active collector community
- [Cardboard Connection](https://www.cardboardconnection.com/) — Checklists + hobby news
- [Cardlines](https://cardlines.com/) — Box breaks + release coverage
