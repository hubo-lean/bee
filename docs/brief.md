# Project Brief: Bee - Unified Second Brain

## Executive Summary

**Bee** is a unified second brain application that manages three scarce resources for knowledge workers: **attention**, **memory**, and **time**. Unlike traditional note-taking apps or task managers, Bee is a decision-support and execution system that uses AI to absorb complexity so the user doesn't have to.

**Core Problem:** Knowledge workers lose actions, ideas, and context because their information is fragmented across 6+ inboxes (email, notes, photos, messages, to-dos, calendar) with no unified retrieval system. Current tools become "graveyards" where captured items enter but never exit.

**Target Market:** Knowledge workers who produce decisions, slides, plans, and structured thinking as their primary deliverables.

**Key Value Proposition:** Capture anywhere with zero friction, AI organizes everything, you just decide yes/no. One place to capture, organize, think, and act.

---

## Problem Statement

### Current State & Pain Points

Knowledge workers today face a fundamental cognitive burden:

1. **Fragmentation:** Information is scattered across Apple Notes, email, Teams messages, photos, to-do apps, and calendar - each a separate "inbox" with no unified view
2. **Graveyard Effect:** Items are captured but never processed. Notes become burial grounds for ideas. Photos of whiteboards are lost in camera rolls.
3. **Retrieval Failure:** The user's brain becomes the search engine for their own past work. Finding something from 2 weeks ago requires remembering *where* it was stored.
4. **Review Avoidance:** Weekly reviews feel heavy and are frequently skipped, leading to inbox bankruptcy and lost commitments.
5. **Context Switching:** Thinking happens in ChatGPT, organizing in Notion, tasks in Todoist - no single system has full context.

### Impact of the Problem

- **Lost actions:** Follow-ups from meetings disappear. Commitments made in messages are forgotten.
- **Wasted time:** Searching for past work, re-creating slides, hunting through folders.
- **Cognitive load:** Constantly wondering "where should this go?" and "where did I put that?"
- **Missed opportunities:** Ideas captured but never developed. Connections never made.

### Why Existing Solutions Fall Short

| Solution | Limitation |
|----------|------------|
| **Note apps** (Notion, Obsidian) | Require manual organization; no AI triage; no action management |
| **Task managers** (Todoist, Things) | Focused on tasks only; no knowledge capture; no calendar integration |
| **Email clients** | Handle one input type; no connection to other captured content |
| **AI assistants** (ChatGPT) | Conversations are lost; no persistent memory; not connected to your data |

### Urgency

AI capabilities now make this vision achievable. The ability to auto-classify, summarize, and extract actions from unstructured content transforms what's possible in personal knowledge management.

---

## Proposed Solution

### Core Concept

Bee is a **unified command center** for knowledge work. Everything flows into one inbox, AI processes and classifies it, the user validates with minimal effort, and the system executes actions on their behalf.

**Design Philosophy:**
- **One behavior only:** The user's job is to capture. Everything else is automated.
- **AI absorbs complexity:** The user never decides "where should this go?" at capture time.
- **Design for restart:** The system assumes the user will fall off. No guilt, easy restart.
- **Progressive trust:** AI earns autonomy over time based on user feedback.

### Key Differentiators

1. **True Unified Inbox:** All inputs (email, messages, photos, voice, files) flow to one place
2. **AI Triage with Confidence Scores:** AI classifies everything, shows its reasoning, user approves/corrects
3. **Daily Swipe Review:** Gamified, mobile-first review that takes 2-5 minutes (like a dating app for your inbox)
4. **Integrated Thinking Partner:** Built-in AI chat with full context of everything you've captured
5. **Action Execution:** System doesn't just track actions - it sends emails, creates calendar events, executes on your behalf
6. **Calendar-First Time Management:** Weekly review includes calendar visibility, smart scheduling, focus protection

### High-Level Vision

```
CAPTURE (Zero Friction)
    ↓
UNIFIED INBOX
    ↓
AI TRIAGE (Confidence Scores)
    ↓
DAILY SWIPE REVIEW (Train AI)
    ↓
WEEKLY DEEP REVIEW (Align to Objectives)
    ↓
EXECUTION (AI Acts on Your Behalf)
    ↓
CREATION MODE (Build Deliverables)
```

---

## Target Users

### Primary User Segment: Knowledge Workers in Corporate Environments

**Profile:**
- Mid-to-senior level professionals (managers, leads, directors)
- Work involves producing decisions, presentations, plans, and strategic documents
- Heavy meeting load with Microsoft Teams
- Use multiple tools daily (email, calendar, notes, messaging)
- Struggle with information overload and follow-up tracking

**Current Behaviors:**
- Capture ideas on paper or Apple Notes
- Take photos of whiteboards that get lost in camera roll
- Lose track of action items from meetings
- Spend significant time searching for past work when creating new deliverables
- Use ChatGPT/Claude for thinking but lose those conversations

**Pain Points:**
- "Where did I put that?"
- "I know I captured this somewhere..."
- "I forgot to follow up on that meeting"
- "Creating this deck means hunting through 5 old projects"

**Goals:**
- Never lose an action item from a meeting
- Find any past work in seconds
- Spend less time organizing, more time thinking
- Have one place for everything

### Secondary User Segment: Entrepreneurs & Solopreneurs

**Profile:**
- Running their own business or side projects
- Wear multiple hats (CEO, marketer, product, sales)
- Need to manage personal and professional in one system
- Value automation and AI leverage

**Specific Needs:**
- No separation between "work" and "personal" thinking
- Need system that handles both domains seamlessly
- Appreciate tools that save time on administrative tasks

---

## Goals & Success Metrics

### Business Objectives

- Achieve product-market fit with initial user (Hugo) within first 3 months
- Validate core hypothesis: AI triage + swipe review creates sustainable engagement
- Build foundation for potential expansion to other knowledge workers

### User Success Metrics

- **Zero lost actions:** Every meeting follow-up is captured and tracked
- **Capture friction < 5 seconds:** Any input type reaches unified inbox in under 5 seconds
- **Daily review < 5 minutes:** Swipe review is fast and habitual
- **Weekly review completion > 90%:** System makes reviews sustainable
- **Retrieval success > 95%:** User finds what they're looking for on first search

### Key Performance Indicators (KPIs)

- **Daily Active Usage:** User engages with swipe review daily
- **Inbox Zero Rate:** Percentage of weeks where review queues are emptied
- **AI Accuracy:** Percentage of AI classifications accepted without correction
- **Capture Volume:** Number of items captured per week (indicates trust in system)
- **Retrieval Usage:** How often user searches/finds past content for new work

---

## MVP Scope

### Core Features (Must Have)

1. **Unified Inbox**
   - Single destination for all captured items
   - Supports: photos, screenshots, voice notes, manual text entry
   - Email connector (read-only, pulls into inbox)
   - Forward-to-inbox for Teams messages

2. **AI Triage System**
   - Auto-classification with confidence scores
   - Action candidate extraction
   - "Bouncer" system: low confidence (<0.6) goes to "Needs Review"
   - Receipts: "Filed as [X]. Confidence: [Y]"

3. **Daily Swipe Review**
   - Mobile-first card interface
   - Swipe right (agree), left (disagree), up (urgent), down (hide)
   - Swipe card shows: input + AI extraction + proposed classification
   - Voice correction option when disagreeing

4. **Weekly Review**
   - Top-down flow: objectives → priorities → actions → inbox
   - Three queues: Needs Review, Disagreements, Receipts
   - Exit condition: Inbox zero in review queues
   - Anti-guilt mechanisms: 15-day auto-archive, bankruptcy button

5. **PARA Organization**
   - Projects, Areas, Resources, Archive structure
   - Applied after review, never at capture
   - Mirrored in OneDrive for file storage

6. **Built-in Notes & To-Dos**
   - Notes engine (ideas, meeting notes, etc.)
   - To-do engine (actions, tasks)
   - Both organized with PARA structure

7. **Calendar Integration**
   - View calendar within app
   - Create events/time blocks for actions
   - Calendar check during weekly review

8. **Integrated AI Chat**
   - Built-in thinking partner
   - Model-agnostic (switch between Claude, GPT, Gemini)
   - Conversations auto-saved and organized
   - Context-aware (sees your notes/history)

### Out of Scope for MVP

- Meeting transcription pipeline (Teams/in-person)
- Action execution (sending emails, creating external events)
- Smart scheduling / focus protection
- Side-by-side model comparison
- Mobile native app (start with responsive web)
- Collaboration features
- Public sharing

### MVP Success Criteria

The MVP is successful if:
1. Hugo uses daily swipe review at least 5 days/week for 4 consecutive weeks
2. Weekly review is completed every week for 4 consecutive weeks
3. No action items are lost from meetings (self-reported)
4. Capture feels faster than current workflow (paper + Apple Notes)
5. AI accuracy reaches >70% acceptance rate within first month

---

## Post-MVP Vision

### Phase 2 Features

1. **Action Execution Engine**
   - AI drafts emails, creates calendar events
   - Progressive autonomy: full approval → auto-execute low-risk
   - Risk classification (low/medium/high)

2. **Meeting AI Pipeline**
   - Teams meeting transcription
   - Auto-summarization and action extraction
   - In-person meeting capture (tagged "Capture" meetings only)

3. **Smart Scheduling**
   - "Find 2 hours for Project X"
   - Focus time protection
   - Calendar fragmentation warnings

4. **Creation Mode**
   - Storyline builder
   - Point-by-point material retrieval
   - "Find evidence for this point" search

### Long-term Vision

Bee becomes the **operating system for knowledge work**:
- Every piece of information you encounter flows through it
- Every decision you make is supported by relevant context
- Every action you commit to gets executed
- Your AI thinking partner has 100% context of your professional life
- The system learns your patterns and proactively surfaces what you need

### Expansion Opportunities

- **Team version:** Shared projects, delegated actions, team knowledge base
- **Enterprise:** Company-wide second brain with access controls
- **Vertical specializations:** Bee for Consultants, Bee for Executives, Bee for Researchers
- **API/Integrations:** Connect to any tool, act as the "brain" layer

---

## Technical Considerations

### Platform Requirements

- **Target Platforms:** Web (responsive, mobile-friendly)
- **Browser Support:** Chrome, Safari, Firefox (latest versions)
- **Performance Requirements:**
  - Capture to inbox < 2 seconds
  - Search results < 1 second
  - AI classification < 5 seconds per item

### Technology Preferences

- **Frontend:** React/Next.js (modern, component-based)
- **Backend:** Node.js or Python (flexible for AI integration)
- **Database:** PostgreSQL + Vector database (for semantic search)
- **Hosting/Infrastructure:** Cloud-based (Vercel, AWS, or similar)

### Architecture Considerations

- **Repository Structure:** Monorepo for web app
- **Service Architecture:**
  - Core app (capture, review, organize)
  - AI service (classification, extraction, chat)
  - Integration service (email, calendar, OneDrive)
- **Integration Requirements:**
  - Microsoft Graph API (email, calendar, OneDrive)
  - LLM APIs (OpenAI, Anthropic, Google)
- **Security/Compliance:**
  - User data encrypted at rest and in transit
  - API keys securely stored
  - No data shared with third parties beyond LLM processing

---

## Constraints & Assumptions

### Constraints

- **Budget:** Personal project, minimize ongoing costs
- **Timeline:** No fixed deadline, but prefer working MVP within reasonable timeframe
- **Resources:** Solo developer (Hugo) with AI assistance
- **Technical:** Must work with existing Microsoft ecosystem (Teams, Outlook, OneDrive)

### Key Assumptions

- Users will adopt daily swipe review if it's fast and gamified
- AI classification accuracy of 70%+ is achievable with current LLMs
- Email/calendar APIs provide sufficient access for integration
- Mobile-responsive web is acceptable for MVP (native app not required initially)
- Users prefer one unified system over best-of-breed tools
- The "progressive trust" model will encourage AI adoption rather than resistance

---

## Risks & Open Questions

### Key Risks

- **AI Accuracy Risk:** If AI classification is wrong too often, users lose trust and stop using the system
  - Mitigation: Conservative confidence thresholds, transparent reasoning, easy correction

- **Engagement Risk:** If daily/weekly reviews feel burdensome, users abandon the system
  - Mitigation: Gamification, strict time limits, auto-archive for old items

- **Integration Complexity:** Microsoft APIs may have limitations or require enterprise licenses
  - Mitigation: Start with manual forwarding, add deep integration over time

- **Scope Creep:** Temptation to add features before core loop is validated
  - Mitigation: Strict MVP definition, validate before expanding

### Open Questions

- What's the right confidence threshold for "Needs Review" queue? (Starting hypothesis: 0.6)
- How should the system handle recurring tasks/actions?
- What happens to items that are archived? How are they resurfaced if needed?
- How granular should PARA folders be? Who creates the structure?
- Should there be notifications/reminders, or purely pull-based?

### Areas Needing Further Research

- Best practices for AI confidence calibration
- Optimal swipe UX patterns from dating/social apps
- Microsoft Graph API capabilities and limitations
- Vector database options for semantic search at personal scale
- Cost optimization for LLM usage in production

---

## Appendices

### A. Research Summary

**Brainstorming Session Insights:**
- Capture isn't the friction - retrieval is (the graveyard problem)
- One behavior only: capture. Everything else automated.
- Design for restart, not perfection
- Top-down review beats bottom-up
- Progressive trust model for AI autonomy

**External Research (Second Brain Article):**
- "Bouncer" concept for AI confidence thresholds
- "Fix Button" for quick corrections
- Safe behavior when uncertain (don't guess)
- "Next Action" as the unit of execution

### B. Stakeholder Input

Primary stakeholder: Hugo (initial user and developer)
- Heavy Microsoft Teams user
- Produces decisions, slides, plans as primary outputs
- Currently uses paper + Apple Notes for capture
- Frustrated by lost actions and difficult retrieval

### C. References

- [Brainstorming Session Results](./brainstorming-session-results.md)
- PARA Method by Tiago Forte
- Second Brain methodology

---

## Next Steps

### Immediate Actions

1. Review and refine this Project Brief
2. Create PRD with detailed feature specifications
3. Design database schema for unified inbox
4. Prototype daily swipe review UX
5. Research Microsoft Graph API integration options
6. Select and configure LLM provider for AI triage

### PM Handoff

This Project Brief provides the full context for Bee. Please start in 'PRD Generation Mode', review the brief thoroughly to work with the user to create the PRD section by section as the template indicates, asking for any necessary clarification or suggesting improvements.
