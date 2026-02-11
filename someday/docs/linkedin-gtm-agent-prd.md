# LinkedIn GTM Agent - Product Requirements Document

## Executive Summary

A modular AI agent system that automates LinkedIn go-to-market operations: prospecting, outbound sequences, inbound lead handling, and content-to-pipeline loops. Built as a collection of composable skills/prompts with a shared memory layer, designed to plug into any AI assistant framework (Claude Code, Clawdbot, custom agents).

**Core Principle:** The AI handles strategy, personalization, and decision-making. The human (or automation layer) handles the actual LinkedIn interactions.

---

## Problem Statement

### Current State
- LinkedIn outreach is manual and time-consuming
- Generic automation tools send robotic messages that get ignored
- No feedback loop between content performance and outbound messaging
- Lead qualification happens too late (on calls, not before)
- Follow-up sequences are rigid and don't adapt to signals

### Desired State
- AI-driven prospecting that identifies high-intent leads dynamically
- Personalized messaging that feels human and context-aware
- Adaptive sequences that respond to silence, replies, and objections
- Inbound leads pre-qualified before they hit your calendar
- Closed-loop system where outbound learnings feed content strategy

---

## Target Users

1. **Solo Founders/Consultants** - Running their own outbound, need leverage
2. **Small Sales Teams** - 1-5 SDRs who need smarter targeting and messaging
3. **Agency Operators** - Running LinkedIn GTM for multiple clients

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATION LAYER                       │
│                   (Claude Code / Clawdbot / Custom)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   OUTBOUND   │  │   INBOUND    │  │   CONTENT    │          │
│  │    SKILLS    │  │    SKILLS    │  │    SKILLS    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     MEMORY LAYER                          │   │
│  │         (Lead State, Conversations, Learnings)            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      INTEGRATION LAYER                           │
│            (LinkedIn API / Browser Extension / Manual)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### Module 1: Prospecting Engine

#### 1.1 ICP Definition Tool
**Purpose:** Define and refine ideal customer profile dynamically

**Inputs:**
- Best customer examples (LinkedIn URLs or descriptions)
- Deal history (who closed, who churned)
- Negative examples (who to avoid)

**Outputs:**
- Structured ICP document with weighted attributes
- Lookalike search criteria
- Disqualification signals

**Prompt Skill:** `skills/prospecting/icp-definer.md`
```markdown
You are an ICP analyst. Given examples of best customers, extract:
1. Common titles/roles (weighted by frequency)
2. Company attributes (size, industry, tech stack, growth signals)
3. Behavioral patterns (content they post, groups they're in)
4. Anti-patterns (traits of bad-fit leads)

Output a structured ICP profile that can be used for lead scoring.
```

#### 1.2 Signal Detector
**Purpose:** Identify buying signals from LinkedIn activity

**Signal Types:**
| Signal | Weight | Description |
|--------|--------|-------------|
| Job Change | High | New role = new budget, new initiatives |
| Funding Announcement | High | Money to spend |
| Hiring Posts | Medium | Growing team = growing problems |
| Content Engagement | Medium | Engaging with relevant topics |
| Profile Views | Medium | Already curious about you |
| Company Growth | Medium | LinkedIn employee count trending up |
| Tech Stack Changes | Low | Job posts mentioning new tools |

**Prompt Skill:** `skills/prospecting/signal-detector.md`
```markdown
Analyze this LinkedIn profile/activity for buying signals:
- Recent job change (< 90 days)
- Company funding or growth indicators
- Content themes suggesting relevant pain points
- Engagement with competitor or adjacent content

Score 1-10 on timing/intent. Explain your reasoning.
```

#### 1.3 Lead Scorer
**Purpose:** Prioritize leads based on ICP fit + signals

**Scoring Matrix:**
```
Final Score = (ICP Fit × 0.6) + (Signal Strength × 0.4)

Tiers:
- A-Tier (8-10): Immediate outreach
- B-Tier (5-7): Nurture sequence
- C-Tier (< 5): Skip or long-term nurture
```

**Prompt Skill:** `skills/prospecting/lead-scorer.md`

#### 1.4 Profile Enrichment
**Purpose:** Extract actionable context from profiles and websites

**Data Points:**
- Recent posts and their themes
- Mutual connections
- Career trajectory
- Company context (from website, news)
- Personal interests/hooks

**Prompt Skill:** `skills/prospecting/profile-enricher.md`

---

### Module 2: Outbound Sequence Engine

#### 2.1 First Line Writer
**Purpose:** Generate personalized openers that don't feel automated

**Anti-Patterns (Never Do):**
- "I love your journey"
- "Your post about X really resonated"
- "I see we're both in [industry]"
- Any compliment that could apply to anyone

**Good Patterns:**
- Specific reference to their content with a take
- Observation about their company's trajectory
- Mutual connection context
- Relevant timing hook (job change, announcement)

**Prompt Skill:** `skills/outbound/first-line-writer.md`
```markdown
Write a LinkedIn connection request or DM opener for this lead.

Context provided:
- Their recent posts: {posts}
- Profile summary: {profile}
- Company context: {company}
- Your offer: {offer}
- ICP fit reason: {fit_reason}

Rules:
1. NO generic compliments
2. Reference something SPECIFIC only they could have done
3. Keep under 300 characters for connection requests
4. Create curiosity, don't pitch
5. Sound like a human who actually read their stuff
```

#### 2.2 Sequence Designer
**Purpose:** Create adaptive multi-touch sequences

**Sequence Structure:**
```
Touch 1: Connection Request (Day 0)
  ├─ Accepted → Touch 2a: Value-first DM (Day 1)
  └─ No response → Touch 1b: Follow + engage content (Day 3)

Touch 2a: Value-first DM
  ├─ Reply (positive) → Conversation mode
  ├─ Reply (objection) → Objection handler
  └─ No response → Touch 3: Different angle (Day 5)

Touch 3: Different angle
  ├─ Reply → Conversation mode
  └─ No response → Touch 4: Breakup (Day 10)

Touch 4: Breakup message
  └─ Move to long-term nurture
```

**Prompt Skill:** `skills/outbound/sequence-designer.md`

#### 2.3 Follow-Up Generator
**Purpose:** Write follow-ups that don't feel like follow-ups

**Strategies by Scenario:**
| Scenario | Strategy |
|----------|----------|
| No response (1st) | New angle, add value |
| No response (2nd) | Pattern interrupt, shorter |
| No response (3rd) | Breakup, leave door open |
| Opened but no reply | Acknowledge, reduce friction |
| Partial response | Match their energy, don't over-invest |

**Prompt Skill:** `skills/outbound/followup-generator.md`

#### 2.4 Objection Handler
**Purpose:** Pre-handle and respond to common objections

**Objection Library:**
```yaml
objections:
  - trigger: "not interested"
    strategy: "acknowledge, ask what would make it relevant"

  - trigger: "no budget"
    strategy: "timing question, plant seed for future"

  - trigger: "using competitor"
    strategy: "curious what's working, offer comparison angle"

  - trigger: "too busy"
    strategy: "respect time, offer async option"

  - trigger: "send more info"
    strategy: "qualify before sending, avoid brochure mode"
```

**Prompt Skill:** `skills/outbound/objection-handler.md`

#### 2.5 Reply Classifier
**Purpose:** Categorize responses to route correctly

**Categories:**
- `interested` → Hand to human / book call
- `curious` → Continue conversation
- `objection` → Route to objection handler
- `not_now` → Add to nurture, set reminder
- `not_interested` → Mark closed, learn from it
- `wrong_person` → Ask for referral

**Prompt Skill:** `skills/outbound/reply-classifier.md`

---

### Module 3: Inbound Processing Engine

#### 3.1 Comment-to-DM Converter
**Purpose:** Turn post engagement into conversations

**Trigger Events:**
- Comment on your post
- Like + profile view combo
- Share your content
- Reply to your comment elsewhere

**Prompt Skill:** `skills/inbound/comment-to-dm.md`
```markdown
Someone engaged with your content. Convert to DM conversation.

Their comment: {comment}
Your post topic: {post_topic}
Their profile summary: {profile}

Write a DM that:
1. Thanks them specifically for their take (not generic)
2. Extends the conversation naturally
3. Creates opening for discovery without pitching
4. Feels like peer-to-peer, not sales
```

#### 3.2 Profile View Processor
**Purpose:** Convert profile views into warm outreach

**Logic:**
```
If profile_view AND matches_icp:
  If already_connected:
    → Send "noticed you checking in" message
  Else:
    → Send connection request with context
```

**Prompt Skill:** `skills/inbound/profile-view-processor.md`

#### 3.3 Lead Qualifier
**Purpose:** Pre-qualify inbound before they hit your calendar

**Qualification Criteria:**
```yaml
must_have:
  - Budget authority or influence
  - Timeline < 6 months
  - Problem we solve

nice_to_have:
  - Previous vendor experience
  - Internal champion identified
  - Specific use case articulated

disqualifiers:
  - Just researching for content
  - Student/job seeker
  - Competitor intelligence
  - No decision-making power
```

**Prompt Skill:** `skills/inbound/lead-qualifier.md`

#### 3.4 Conversation Router
**Purpose:** Decide what gets human attention vs. automated handling

**Routing Rules:**
```
A-Tier Lead + Buying Intent → Immediate human handoff
A-Tier Lead + Early Stage → AI nurture, human CC'd
B-Tier Lead + Buying Intent → AI qualification, then human
B-Tier Lead + Early Stage → Full AI nurture
C-Tier Lead → Polite decline or content-only nurture
```

**Prompt Skill:** `skills/inbound/conversation-router.md`

---

### Module 4: Content × Outbound Loop

#### 4.1 Content Performance Tracker
**Purpose:** Identify which content creates pipeline

**Metrics:**
```yaml
vanity_metrics:  # Track but don't optimize for
  - likes
  - comments
  - impressions

pipeline_metrics:  # Optimize for these
  - profile_views_from_post
  - connection_requests_from_post
  - dms_from_post
  - icp_engagement_rate
  - leads_generated
```

**Prompt Skill:** `skills/content/performance-tracker.md`

#### 4.2 Topic-to-Angle Mapper
**Purpose:** Turn content themes into outbound angles

**Process:**
```
High-performing post about "X problem"
  → Extract the hook that worked
  → Create outbound angle for leads with X problem
  → Test in sequences
  → Feed results back to content
```

**Prompt Skill:** `skills/content/topic-to-angle.md`

#### 4.3 Outbound Learning Extractor
**Purpose:** Mine outbound conversations for content ideas

**Signals:**
- Objections that keep coming up → Content to pre-handle
- Questions leads ask → Content to educate
- Competitor mentions → Comparison content
- Timing triggers → Content for those moments

**Prompt Skill:** `skills/content/outbound-learnings.md`

#### 4.4 Content Brief Generator
**Purpose:** Create content briefs from GTM learnings

**Output Format:**
```yaml
brief:
  topic: "Why [common objection] is actually wrong"
  hook: "Based on 50 conversations, everyone says X. Here's why that's backwards."
  angle: "Contrarian take backed by real conversations"
  cta: "Soft - invite discussion, capture comments for DM"
  target_icp: "People who raised this objection"
```

**Prompt Skill:** `skills/content/brief-generator.md`

---

### Module 5: Memory & State Management

#### 5.1 Lead State Store
**Purpose:** Track every lead's current status and history

**Schema:**
```typescript
interface LeadState {
  id: string;
  linkedin_url: string;

  // Profile data
  name: string;
  title: string;
  company: string;
  enrichment_data: EnrichmentData;

  // Scoring
  icp_score: number;
  signal_score: number;
  tier: 'A' | 'B' | 'C';

  // Sequence state
  current_sequence: string | null;
  sequence_step: number;
  last_touch_date: Date;
  next_touch_date: Date;

  // Conversation
  status: 'prospecting' | 'sequencing' | 'conversing' | 'qualified' | 'closed_won' | 'closed_lost' | 'nurture';
  conversation_history: Message[];
  objections_raised: string[];

  // Outcomes
  outcome: string | null;
  outcome_reason: string | null;
  learnings: string[];
}
```

#### 5.2 Conversation Memory
**Purpose:** Maintain context across interactions

**Stored Per Conversation:**
- Full message history
- Detected intent at each stage
- Objections and how they were handled
- Personal details mentioned (for future reference)
- Sentiment trajectory

#### 5.3 Learning Store
**Purpose:** Accumulate insights for system improvement

**Categories:**
```yaml
messaging_learnings:
  - winning_first_lines: []
  - failed_first_lines: []
  - effective_objection_responses: []

icp_learnings:
  - unexpected_good_fits: []
  - false_positives: []
  - new_signals_discovered: []

content_learnings:
  - topics_that_convert: []
  - hooks_that_work: []
  - engagement_to_pipeline_correlation: []
```

#### 5.4 Session State
**Purpose:** Track active work across agent sessions

**Maintains:**
- Current working list of leads
- Pending actions queue
- Daily/weekly targets and progress
- Handoff items for human review

---

## Integration Layer Options

### Option A: Manual Hybrid (Recommended Start)
**How it works:**
1. Agent generates actions (messages to send, leads to contact)
2. Human executes in LinkedIn manually
3. Human reports back results
4. Agent processes and continues

**Pros:** No ToS risk, full control, works today
**Cons:** Human bottleneck, slower throughput

### Option B: Browser Extension
**How it works:**
1. Extension runs in browser alongside LinkedIn
2. Agent sends commands via local websocket
3. Extension executes with human-like delays
4. Extension reports results back

**Pros:** Faster execution, still looks human
**Cons:** ToS gray area, requires extension development

**Implementation:**
```typescript
// Extension API
interface LinkedInExtension {
  // Read operations
  getProfile(url: string): Promise<ProfileData>;
  getConnectionStatus(url: string): Promise<ConnectionStatus>;
  getRecentPosts(url: string, count: number): Promise<Post[]>;

  // Write operations
  sendConnectionRequest(url: string, note: string): Promise<void>;
  sendMessage(url: string, message: string): Promise<void>;
  likePost(postUrl: string): Promise<void>;
  commentOnPost(postUrl: string, comment: string): Promise<void>;
}
```

### Option C: LinkedIn API (Limited)
**How it works:**
- Use official LinkedIn API where available
- Very limited for outreach (mostly company pages, ads)

**Pros:** Fully compliant
**Cons:** Doesn't support DMs, connection requests, or most useful actions

### Option D: Third-Party Tools
**Integrate with:**
- Phantombuster (scraping/automation)
- Dripify, Expandi (sequence automation)
- Clay (enrichment)
- Apollo, ZoomInfo (data)

**How it works:**
1. Agent generates strategy and messaging
2. Third-party tool executes
3. Results sync back to agent memory

---

## Tool Definitions (MCP/Function Calling)

### Prospecting Tools

```typescript
// Define or update ICP
tool define_icp {
  input: {
    good_examples: string[];      // LinkedIn URLs of best customers
    bad_examples?: string[];      // URLs of bad fits
    attributes?: ICPAttributes;   // Manual attribute overrides
  }
  output: {
    icp_profile: ICPProfile;
    search_criteria: SearchCriteria;
  }
}

// Score a lead against ICP
tool score_lead {
  input: {
    linkedin_url: string;
    profile_data?: ProfileData;   // Optional pre-fetched data
  }
  output: {
    icp_score: number;
    signal_score: number;
    tier: 'A' | 'B' | 'C';
    reasoning: string;
    enrichment: EnrichmentData;
  }
}

// Detect buying signals
tool detect_signals {
  input: {
    linkedin_url: string;
    lookback_days?: number;       // Default 90
  }
  output: {
    signals: Signal[];
    composite_score: number;
    recommended_timing: string;
  }
}

// Enrich profile with context
tool enrich_profile {
  input: {
    linkedin_url: string;
    include_company?: boolean;
    include_posts?: boolean;
  }
  output: {
    profile: ProfileData;
    company: CompanyData;
    recent_posts: Post[];
    hooks: string[];              // Personalization opportunities
  }
}
```

### Outbound Tools

```typescript
// Generate first touch message
tool write_first_touch {
  input: {
    lead_id: string;
    message_type: 'connection_request' | 'inmail' | 'dm';
    angle?: string;               // Optional specific angle to use
  }
  output: {
    message: string;
    personalization_used: string;
    confidence: number;
  }
}

// Generate follow-up
tool write_followup {
  input: {
    lead_id: string;
    previous_messages: Message[];
    days_since_last: number;
    strategy?: FollowupStrategy;
  }
  output: {
    message: string;
    strategy_used: string;
    is_breakup: boolean;
  }
}

// Handle objection
tool handle_objection {
  input: {
    lead_id: string;
    objection_message: string;
    conversation_context: Message[];
  }
  output: {
    response: string;
    objection_type: string;
    strategy_used: string;
    recommended_next: 'continue' | 'pause' | 'close';
  }
}

// Classify reply
tool classify_reply {
  input: {
    lead_id: string;
    reply_message: string;
    conversation_context: Message[];
  }
  output: {
    classification: ReplyClassification;
    sentiment: number;
    intent: string;
    recommended_action: string;
  }
}

// Get next actions
tool get_pending_actions {
  input: {
    date?: string;                // Default today
    limit?: number;               // Default 20
  }
  output: {
    actions: PendingAction[];
    by_priority: {
      high: PendingAction[];
      medium: PendingAction[];
      low: PendingAction[];
    }
  }
}
```

### Inbound Tools

```typescript
// Process inbound engagement
tool process_engagement {
  input: {
    engagement_type: 'comment' | 'like' | 'share' | 'profile_view' | 'connection_request';
    from_profile: string;
    context?: {
      post_url?: string;
      comment_text?: string;
    }
  }
  output: {
    lead_score: LeadScore;
    recommended_action: string;
    draft_response?: string;
  }
}

// Qualify inbound lead
tool qualify_lead {
  input: {
    lead_id: string;
    conversation: Message[];
  }
  output: {
    qualification: QualificationResult;
    missing_info: string[];
    next_questions: string[];
    ready_for_handoff: boolean;
  }
}

// Route conversation
tool route_conversation {
  input: {
    lead_id: string;
    current_state: ConversationState;
  }
  output: {
    route_to: 'ai_continue' | 'human_handoff' | 'nurture' | 'close';
    reason: string;
    handoff_summary?: string;
  }
}
```

### Memory Tools

```typescript
// Save/update lead
tool upsert_lead {
  input: {
    lead: Partial<LeadState>;
  }
  output: {
    lead_id: string;
    changes: string[];
  }
}

// Get lead by ID or URL
tool get_lead {
  input: {
    lead_id?: string;
    linkedin_url?: string;
  }
  output: {
    lead: LeadState | null;
  }
}

// Search leads
tool search_leads {
  input: {
    filters: {
      status?: string[];
      tier?: string[];
      last_touch_before?: string;
      sequence?: string;
    };
    limit?: number;
  }
  output: {
    leads: LeadState[];
    total: number;
  }
}

// Log learning
tool log_learning {
  input: {
    category: 'messaging' | 'icp' | 'content';
    type: string;
    content: string;
    lead_id?: string;
  }
  output: {
    learning_id: string;
  }
}

// Get learnings
tool get_learnings {
  input: {
    category?: string;
    type?: string;
    limit?: number;
  }
  output: {
    learnings: Learning[];
  }
}
```

### Content Tools

```typescript
// Track content performance
tool track_content {
  input: {
    post_url: string;
    metrics: ContentMetrics;
    engagements?: Engagement[];
  }
  output: {
    content_id: string;
    pipeline_score: number;
  }
}

// Generate content brief
tool generate_brief {
  input: {
    source: 'objection' | 'question' | 'winning_angle' | 'topic';
    source_data: string;
  }
  output: {
    brief: ContentBrief;
  }
}

// Map topic to outbound angle
tool topic_to_angle {
  input: {
    topic: string;
    performance_data?: ContentPerformance;
  }
  output: {
    angles: OutboundAngle[];
    recommended: OutboundAngle;
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Core prospecting and manual outbound

**Deliverables:**
- [ ] ICP definition tool
- [ ] Lead scorer
- [ ] Profile enricher
- [ ] First line writer
- [ ] Lead state store (JSON/SQLite)
- [ ] Basic CLI interface

**Success Criteria:**
- Can define ICP and score 10 leads
- Can generate personalized first lines
- Can track lead state

### Phase 2: Sequences (Week 3-4)
**Goal:** Multi-touch outbound with memory

**Deliverables:**
- [ ] Sequence designer
- [ ] Follow-up generator
- [ ] Reply classifier
- [ ] Objection handler
- [ ] Conversation memory
- [ ] Daily action queue

**Success Criteria:**
- Can run 5-touch sequence across 20 leads
- Adapts based on responses
- Handles common objections

### Phase 3: Inbound (Week 5-6)
**Goal:** Process inbound and qualify

**Deliverables:**
- [ ] Comment-to-DM converter
- [ ] Profile view processor
- [ ] Lead qualifier
- [ ] Conversation router
- [ ] Human handoff system

**Success Criteria:**
- Can process inbound engagement
- Qualifies leads before human touch
- Clean handoff with context

### Phase 4: Content Loop (Week 7-8)
**Goal:** Close the content-outbound loop

**Deliverables:**
- [ ] Content performance tracker
- [ ] Topic-to-angle mapper
- [ ] Outbound learning extractor
- [ ] Content brief generator
- [ ] Learning store

**Success Criteria:**
- Can identify high-performing content
- Generates outbound angles from content
- Creates content briefs from outbound learnings

### Phase 5: Automation (Week 9+)
**Goal:** Optional automation layer

**Deliverables:**
- [ ] Browser extension (if pursuing)
- [ ] Third-party tool integrations
- [ ] Webhook triggers
- [ ] Scheduled automation

---

## Metrics & Success Criteria

### Leading Indicators
| Metric | Target |
|--------|--------|
| Leads scored/day | 50+ |
| First lines generated/day | 30+ |
| Connection accept rate | > 40% |
| Reply rate | > 15% |
| Positive reply rate | > 8% |

### Lagging Indicators
| Metric | Target |
|--------|--------|
| Meetings booked/week | 5+ |
| Pipeline generated/month | $X |
| Time saved/week | 10+ hours |
| Cost per meeting | < $Y |

### Quality Indicators
| Metric | Target |
|--------|--------|
| Message feels human (blind test) | > 80% |
| Objection handled well | > 70% |
| Lead correctly qualified | > 90% |
| No ToS violations | 100% |

---

## Risk Mitigation

### LinkedIn ToS Risk
- **Mitigation:** Start with manual hybrid, human-in-the-loop
- **Detection:** Monitor for warnings, connection limits
- **Response:** Pause automation, revert to manual

### Quality Degradation
- **Mitigation:** Human review of samples, A/B testing
- **Detection:** Reply rate monitoring, sentiment tracking
- **Response:** Retrain prompts, adjust templates

### Data Privacy
- **Mitigation:** Local-first storage, no cloud sync of PII
- **Detection:** Audit logs, access controls
- **Response:** Data deletion capabilities, consent tracking

### Spam Perception
- **Mitigation:** Quality > quantity, personalization requirements
- **Detection:** Block rate monitoring, negative reply tracking
- **Response:** Reduce volume, increase personalization

---

## Appendix A: Sample Prompts

### ICP Definer Prompt
```markdown
You are an ICP (Ideal Customer Profile) analyst. Analyze these example customers and extract patterns.

## Best Customers (converted, retained, expanded)
{good_examples}

## Bad Fits (churned, never closed, problematic)
{bad_examples}

## Your Task
Create a structured ICP profile:

1. **Title Patterns** (weight by frequency)
   - Primary titles (most common)
   - Secondary titles (also work)
   - Avoid titles (bad fit signals)

2. **Company Attributes**
   - Size range (employees)
   - Industry/vertical
   - Tech stack indicators
   - Growth stage
   - Revenue range (if detectable)

3. **Behavioral Signals**
   - Content themes they engage with
   - Problems they talk about
   - Tools/vendors they mention

4. **Timing Triggers**
   - Job changes
   - Company events
   - Seasonal patterns

5. **Disqualifiers**
   - Hard no's
   - Waste of time signals

Output as structured YAML.
```

### First Line Writer Prompt
```markdown
Write a LinkedIn connection request note for this lead.

## Lead Context
Name: {name}
Title: {title}
Company: {company}
Recent posts: {posts}
Profile summary: {summary}
Mutual connections: {mutuals}
ICP fit reason: {fit_reason}

## Your Offer (for context, don't pitch)
{offer_context}

## Rules
1. MAX 280 characters (LinkedIn limit for connection notes)
2. NO generic compliments ("love your work", "impressive background")
3. Reference something SPECIFIC they did/said/wrote
4. Create curiosity or common ground
5. Don't pitch or mention your product
6. Sound like a peer, not a salesperson
7. Don't use "I" as the first word

## Anti-patterns (never use)
- "I came across your profile..."
- "I see we're both in..."
- "Your journey is inspiring..."
- "Would love to connect and..."
- "I help companies like yours..."

## Good patterns
- Specific reference to their content
- Shared experience or observation
- Relevant timing (congrats on X)
- Mutual connection context
- Contrarian take on something they said

Generate 3 options, ranked by predicted accept rate.
```

---

## Appendix B: Data Schemas

```typescript
interface ICPProfile {
  primary_titles: WeightedAttribute[];
  secondary_titles: WeightedAttribute[];
  avoid_titles: string[];
  company_size: { min: number; max: number };
  industries: string[];
  tech_stack: string[];
  growth_signals: string[];
  behavioral_signals: string[];
  timing_triggers: string[];
  disqualifiers: string[];
}

interface WeightedAttribute {
  value: string;
  weight: number;  // 0-1
}

interface LeadState {
  id: string;
  linkedin_url: string;
  name: string;
  title: string;
  company: string;
  icp_score: number;
  signal_score: number;
  tier: 'A' | 'B' | 'C';
  status: LeadStatus;
  current_sequence: string | null;
  sequence_step: number;
  last_touch: Date;
  next_touch: Date;
  conversation: Message[];
  objections: string[];
  outcome: string | null;
  learnings: string[];
  created_at: Date;
  updated_at: Date;
}

type LeadStatus =
  | 'prospecting'
  | 'sequencing'
  | 'conversing'
  | 'qualifying'
  | 'qualified'
  | 'meeting_booked'
  | 'closed_won'
  | 'closed_lost'
  | 'nurture'
  | 'do_not_contact';

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  timestamp: Date;
  channel: 'connection_request' | 'dm' | 'inmail' | 'comment';
  classification?: ReplyClassification;
}

interface ReplyClassification {
  type: 'interested' | 'curious' | 'objection' | 'not_now' | 'not_interested' | 'wrong_person';
  sentiment: number;  // -1 to 1
  intent: string;
  confidence: number;
}

interface ContentPerformance {
  post_url: string;
  post_date: Date;
  topic: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  profile_views_attributed: number;
  connections_attributed: number;
  dms_attributed: number;
  leads_generated: number;
  pipeline_score: number;
}

interface ContentBrief {
  topic: string;
  hook: string;
  angle: string;
  format: 'text' | 'carousel' | 'video' | 'poll';
  target_icp_segment: string;
  cta_type: 'soft' | 'hard' | 'none';
  source: string;
  source_data: string;
}

interface PendingAction {
  id: string;
  lead_id: string;
  action_type: 'send_connection' | 'send_dm' | 'send_followup' | 'engage_content' | 'review';
  priority: 'high' | 'medium' | 'low';
  due_date: Date;
  context: any;
  draft_content?: string;
  status: 'pending' | 'completed' | 'skipped';
}

interface Learning {
  id: string;
  category: 'messaging' | 'icp' | 'content';
  type: string;
  content: string;
  lead_id?: string;
  created_at: Date;
  applied: boolean;
}
```

---

## Appendix C: Integration Interfaces

### Browser Extension Interface
```typescript
interface LinkedInExtension {
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Profile operations
  getProfile(url: string): Promise<ProfileData>;
  getMyProfile(): Promise<ProfileData>;

  // Connection operations
  getConnectionStatus(url: string): Promise<'connected' | 'pending' | 'none'>;
  sendConnectionRequest(url: string, note?: string): Promise<void>;
  acceptConnectionRequest(url: string): Promise<void>;

  // Messaging
  getConversation(url: string): Promise<Message[]>;
  sendMessage(url: string, message: string): Promise<void>;

  // Content
  getRecentPosts(url: string, count?: number): Promise<Post[]>;
  likePost(postUrl: string): Promise<void>;
  commentOnPost(postUrl: string, comment: string): Promise<void>;

  // Feed
  getProfileViews(): Promise<ProfileView[]>;
  getNotifications(): Promise<Notification[]>;

  // Safety
  getRateLimitStatus(): Promise<RateLimitStatus>;
  pauseOperations(): void;
  resumeOperations(): void;
}
```

### Third-Party Integration Interface
```typescript
interface ExternalEnrichment {
  // Apollo/ZoomInfo style
  enrichPerson(params: {
    linkedin_url?: string;
    email?: string;
    name?: string;
    company?: string;
  }): Promise<EnrichedPerson>;

  enrichCompany(params: {
    domain?: string;
    name?: string;
    linkedin_url?: string;
  }): Promise<EnrichedCompany>;

  searchPeople(criteria: SearchCriteria): Promise<Person[]>;
}

interface SequenceAutomation {
  // Dripify/Expandi style
  createSequence(sequence: SequenceDefinition): Promise<string>;
  addLeadToSequence(sequenceId: string, leadUrl: string): Promise<void>;
  pauseSequence(sequenceId: string): Promise<void>;
  getSequenceStats(sequenceId: string): Promise<SequenceStats>;
  syncResponses(): Promise<Response[]>;
}
```
