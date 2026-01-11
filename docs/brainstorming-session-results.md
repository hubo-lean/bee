# Brainstorming Session Results

**Session Date:** January 11, 2026
**Facilitator:** Business Analyst Mary
**Participant:** Hugo

---

## Executive Summary

**Topic:** Unified Second Brain App with AI-Assisted Decision & Action Management

**Session Goals:** Focused ideation on overall concept and vision, building on existing pre-brief to deepen and stress-test the design.

**Techniques Used:** First Principles Thinking, Assumption Reversal, Working Backwards

**Total Ideas Generated:** 20+ design decisions across 4 zones

### Key Themes Identified:
- Capture isn't the friction - **retrieval is** (the graveyard problem)
- AI should absorb complexity, not the user
- The system must earn trust progressively
- Top-down review (objectives first) beats bottom-up (inbox first)
- The app is a **command center**, not just storage

---

## Technique Sessions

### Zone 1: The "Zero Friction" Promise - First Principles Thinking

**Description:** Breaking down what "frictionless capture" really means by examining current behavior and identifying true pain points.

**Ideas Generated:**

1. Current capture (paper, Apple Notes) isn't the problem - items die because there's no bridge between capture and retrieval
2. The real problem: "Capture → Graveyard" - items enter but never exit
3. Unified inbox solves fragmentation across 6+ current inboxes
4. AI pre-classification solves the "nothing gets organized" problem
5. User is willing to front-load automation work for near-zero daily friction

**Capture Flow Design:**

| Input Type | Mechanism | Friction Level |
|------------|-----------|----------------|
| Photos/Whiteboard | In-app camera → direct to inbox | 🟢 Low (1 tap) |
| Screenshots | In-app or share sheet → inbox | 🟢 Low (1-2 taps) |
| Email | Connector pulls all mail automatically | 🟢 Zero (automatic) |
| Teams messages | Forward to app | 🟡 Medium (requires action) |
| Shower thoughts | Phone shortcut → speech-to-text → inbox | 🟢 Low (voice) |

**Insights Discovered:**
- The value proposition: "Capture anywhere, it all flows to one place, AI organizes it, you just decide yes/no"
- The "Bouncer" concept (from external research) elegantly solves inbox overwhelm

**Notable Connections:**
- Design principles from external article align with vision: one behavior (capture), design for restart, safe when uncertain, next action as unit

---

### Zone 2: AI/Human Boundary - Trust & Correction Mechanisms

**Description:** Exploring where the AI/human decision line sits and how to build trust over time.

**Ideas Generated:**

1. **Progressive Trust Model:**
   - Phase 1 (Learning): AI classifies → Human reviews ALL
   - Phase 2 (Calibrated): AI classifies → Human reviews LOW confidence only
   - Phase 3 (Trusted): AI classifies → Human spot-checks occasionally

2. **The Bouncer System:**
   - Confidence scores on all AI decisions (0.0 - 1.0)
   - Threshold at 0.6: below goes to "Needs Review" queue
   - AI shows receipts: "Filed as [Category]. Confidence: [Score]"

3. **Daily Swipe Review (Dating App UX):**

| Gesture | Action |
|---------|--------|
| Swipe Right | Agree with AI classification |
| Swipe Left | Disagree → Fix now (voice/chat) or send to weekly |
| Swipe Up | 🚨 Urgent - this changes priorities |
| Swipe Down | Hide (never delete) |

4. **Swipe Card UX shows full AI reasoning:**
   - Input (what you captured)
   - Extraction (what AI found)
   - Classification (where AI suggests it goes)
   - Confidence score

**Insights Discovered:**
- Every swipe is feedback data that trains the AI
- Daily swipe acts as early warning system for urgent items
- Nothing is ever deleted, only archived or hidden

---

### Zone 3: The Review Ritual - Assumption Reversal

**Description:** Challenging assumptions about reviews and designing a sustainable governance rhythm.

**Ideas Generated:**

1. **Anti-Guilt Mechanisms:**

| Mechanism | Trigger | What Happens |
|-----------|---------|--------------|
| Auto-archive | Item unprocessed for 15 days | AI moves to Archive with tag "Unprocessed - [Date]" |
| Declare Bankruptcy | User-initiated | Bulk archive everything, fresh start |

2. **Top-Down Review (not bottom-up):**
   - Start with objectives, then align work to them
   - Don't start with "here's everything that came in"

3. **Cascading Goal System:**

```
YEARLY ROADMAP
    ↓ breaks down into
MONTHLY OBJECTIVES
    ↓ breaks down into
WEEKLY FOCUS AREAS
    ↓ generates
DAILY ACTIONS
```

4. **Governance Rhythm:**

| Cadence | Purpose | Duration |
|---------|---------|----------|
| Yearly | Set roadmap, big picture vision | 2-3 hours |
| Monthly | Break down into monthly targets | 45-60 min |
| Weekly | Align projects/actions to objectives | 30-45 min |
| Daily | Swipe review + catch urgent | 2-5 min |

5. **Weekly Review Flow:**
   - Step 1: Glance at this week's pre-set objectives (from monthly)
   - Step 2: Check urgent flags (from daily swipes)
   - Step 3: Adjust if needed
   - Step 4: Select actions that move objectives forward
   - Step 5: Process inbox for anything remaining

6. **Three Queues for Weekly Review:**

| Queue | Source | Priority |
|-------|--------|----------|
| Needs Review | AI low confidence (<0.6) | Must process |
| Disagreements | Items swiped left + "Later" | Must process |
| Receipts | AI high confidence, auto-filed | Optional spot-check |

7. **Action-to-Objective Linking:**
   - Project actions: Automatic (inherited from project)
   - Area actions: AI-suggested connection
   - Orphan actions: AI suggests "Create new project?"

8. **Exit Condition:** Inbox Zero in review queues = Review Complete

**Insights Discovered:**
- Weekly review is simpler because hard thinking (objectives) was done in monthly
- Daily swipes reduce weekly load - no mountain on Sunday
- Clear finish line removes ambiguity about "did I do enough?"

---

### Zone 4: From Inbox to Output - Working Backwards

**Description:** Tracing how raw captured material becomes decisions, slides, plans, and deliverables.

**Ideas Generated:**

1. **Storyline-First Approach:**
   - User decides what to say first (builds storyline)
   - Then finds materials to support each point
   - System serves the storyline, doesn't dump everything

2. **Creation Mode UX:**
   - List storyline points
   - Click [+] on any point
   - AI shows relevant materials for THAT point
   - Click to open source, extract what you need

3. **Material Intelligence Layer:**
   - At capture: AI auto-tags (topics, people, projects, dates, themes)
   - At retrieval: Tag match + Semantic search
   - Find things by exact terms OR conceptual meaning

4. **Backend Architecture:**

```
YOUR SECOND BRAIN APP (Built-in)
├── Notes Engine
├── To-Do Engine
├── AI Processing
├── Unified Inbox
├── Review UX
└── Creation Mode

EXTERNAL (OneDrive)
└── Files only (PPT, PDF, XLS)
    └── Mirrored PARA folders
```

5. **Hybrid File Sync:**
   - Path A (from app): "New Presentation" → Creates in OneDrive → Auto-indexed
   - Path B (from outside): File added to OneDrive → Sync button → AI indexes → Prompt to link to Project/Area

**Insights Discovered:**
- User's brain is currently the search engine for past work - system should replace this
- App is the command center - all work starts there
- Clean separation: App owns notes/actions, OneDrive owns files

---

## Zone 5: New Capabilities (Added Post-Session)

### 5.1 Action Execution (Not Just Tracking)

The system doesn't just track actions - it **executes** them with your approval.

**Progressive Autonomy Model:**

| Phase | Behavior |
|-------|----------|
| Phase 1 (Learning) | AI drafts → You review → You click execute |
| Phase 2 (Calibrated) | AI drafts → Auto-execute LOW risk → Approval for HIGH risk |
| Phase 3 (Trusted) | AI drafts → Auto-execute most → Approval only for sensitive |

**Risk Classification:**

| Risk Level | Examples | Approval Needed |
|------------|----------|-----------------|
| 🟢 Low | Block focus time on your calendar | Eventually auto |
| 🟡 Medium | Send internal email, create meeting with colleagues | Approval in early phases |
| 🔴 High | Send external email, book with clients, modify shared docs | Always approve |

---

### 5.2 Integrated Thinking Partner

The app becomes your **one place to think** - replacing ChatGPT, Claude, Gemini as separate destinations.

**Three Frustrations Solved:**

| Frustration | Solution |
|-------------|----------|
| "Where do I go to think?" | One place for capture, organize, AND think |
| "AI conversations are lost" | Chats auto-saved, organized, searchable like any input |
| "Locked to one provider" | Model-agnostic: switch between GPT, Claude, Gemini |

**Key Advantage:** Your thinking partner has **full context** - every note, meeting, idea you've ever captured.

**Every AI Conversation is a First-Class Object:**
- Auto-saved to inbox
- AI extracts: key insights, decisions, action candidates
- Tagged to relevant Projects/Areas
- Searchable forever

**MVP vs Later:**

| Feature | MVP | Later |
|---------|-----|-------|
| AI chat integrated in app | ✓ | |
| Conversations auto-saved & organized | ✓ | |
| Context-aware (AI sees your notes/history) | ✓ | |
| Switch between models | ✓ | |
| Side-by-side model comparison | | ✓ |
| Sequential "ask another model" | | ✓ |
| Smart routing by task type | | ✓ |

---

### 5.3 Calendar Integration (Time Management)

Calendar is a **core pillar** - the system manages your time, not just your information.

**Five Calendar Features:**

| Feature | What It Does |
|---------|--------------|
| View calendar | Unified view of your time inside the app |
| Create events | AI creates blocks for prioritized actions (with approval) |
| Protect focus | System defends deep work time, warns about fragmentation |
| Smart scheduling | "Find time for X" - AI scans calendar, proposes slots |
| Meeting prep | Before meetings, surfaces relevant notes, past conversations, action history |

**Three Scarce Resources Managed:**

| Resource | How System Helps |
|----------|------------------|
| Attention | Unified inbox, AI triage, swipe review |
| Memory | Capture everything, semantic search, context-aware AI |
| Time | Calendar integration, smart scheduling, focus protection |

**Updated Weekly Review Flow:**

```
Step 1: Review objectives (from monthly)
Step 2: Check urgent flags
Step 3: Prioritize actions
Step 4: Calendar check
        ├── "You have 12 hours of meetings this week"
        ├── "Only 4 hours of focus time available"
        └── "Want me to block time for Priority #1?"
Step 5: Process remaining inbox
```

---

## Idea Categorization

### Immediate Opportunities
*Ideas ready to implement now*

1. **Unified Inbox with AI Triage**
   - Description: Single entry point for all captured items with AI pre-classification
   - Why immediate: Core architecture decision, everything else depends on it
   - Resources needed: AI classification model, database schema, input connectors

2. **Daily Swipe Review UX**
   - Description: Mobile-first, gamified review with swipe gestures
   - Why immediate: Solves the engagement problem, makes review habitual
   - Resources needed: Mobile UI design, gesture handling, AI confidence display

3. **PARA Folder Structure**
   - Description: Consistent Projects/Areas/Resources/Archive across app and OneDrive
   - Why immediate: Foundational organization, simple to implement
   - Resources needed: Folder sync logic, OneDrive API integration

4. **Calendar Integration (View + Create)**
   - Description: See calendar in app, AI creates time blocks for prioritized actions
   - Why immediate: Time is a core resource; weekly review needs calendar visibility
   - Resources needed: Calendar API (Outlook/Google), scheduling logic

5. **Integrated AI Chat (Thinking Partner)**
   - Description: AI chat built into app, model-agnostic, conversations auto-saved
   - Why immediate: Eliminates context-switching to ChatGPT; conversations become searchable assets
   - Resources needed: LLM API integrations (OpenAI, Anthropic, Google), chat UI

### Future Innovations
*Ideas requiring development/research*

1. **Progressive Trust Model**
   - Description: AI earns autonomy based on user feedback over time
   - Development needed: ML pipeline to learn from swipe corrections, confidence calibration
   - Timeline estimate: After MVP, requires usage data

2. **Semantic Search + Auto-tagging**
   - Description: AI understands meaning, not just keywords
   - Development needed: Embedding model, vector database, tagging pipeline
   - Timeline estimate: Can start simple, evolve with scale

3. **Creation Mode (Storyline → Materials)**
   - Description: Point-by-point material retrieval for building deliverables
   - Development needed: Storyline UI, relevance ranking, source linking
   - Timeline estimate: After core capture/review flow is solid

4. **Action Execution Engine**
   - Description: System executes validated actions (send emails, create events)
   - Development needed: Email/calendar APIs, approval workflow, progressive autonomy logic
   - Timeline estimate: After trust model is calibrated

5. **Smart Scheduling & Focus Protection**
   - Description: AI finds time for priorities, defends deep work blocks
   - Development needed: Calendar analysis, conflict detection, suggestion UI
   - Timeline estimate: After basic calendar integration works

### Moonshots
*Ambitious, transformative concepts*

1. **Meeting AI Pipeline**
   - Description: Auto-transcribe, summarize, extract actions from Teams/in-person meetings
   - Transformative potential: Eliminates the biggest source of lost actions
   - Challenges to overcome: Transcription accuracy, action extraction precision, privacy

2. **Voice-First Correction**
   - Description: Say what's wrong, AI re-processes and re-classifies
   - Transformative potential: True zero-friction correction
   - Challenges to overcome: Speech recognition, intent parsing, context understanding

3. **Context-Aware Thinking Partner**
   - Description: AI chat with full access to your second brain context
   - Transformative potential: One place to think; AI knows everything you've captured
   - Challenges to overcome: Context window limits, relevance filtering, model costs

4. **Action Execution Engine**
   - Description: System sends emails, creates calendar events, executes validated actions
   - Transformative potential: Actions go from "reminder" to "done" automatically
   - Challenges to overcome: Integration APIs, trust/approval UX, error handling

5. **Smart Model Routing**
   - Description: AI picks best model (Claude/GPT/Gemini) for each task type
   - Transformative potential: Best-in-class results without user decision fatigue
   - Challenges to overcome: Model benchmarking, cost optimization, latency

### Insights & Learnings
*Key realizations from the session*

- **Capture isn't the problem, retrieval is:** Current tools are graveyards because nothing forces processing
- **One behavior only:** User should only capture; everything else is automated
- **Design for restart:** System assumes user will fall off; no guilt, easy restart
- **Top-down review beats bottom-up:** Start with objectives, not inbox
- **The app is a command center:** All work starts here, storage is behind the scenes
- **Trust is earned:** AI starts supervised, gains autonomy through correct behavior

---

## Action Planning

### Top 3 Priority Ideas

#### #1 Priority: Unified Inbox with AI Triage
- Rationale: Foundation of entire system; solves fragmentation and graveyard problems
- Next steps: Design database schema, define AI classification categories, build input connectors (email, photos, voice)
- Resources needed: AI/ML expertise, backend infrastructure, API integrations
- Timeline: Core MVP feature

#### #2 Priority: Daily Swipe Review UX
- Rationale: Makes the system sticky; solves the "reviews feel heavy" problem
- Next steps: Design swipe card UI, implement gesture handling, build AI confidence display
- Resources needed: Mobile UI/UX design, frontend development
- Timeline: Core MVP feature

#### #3 Priority: PARA + OneDrive Integration
- Rationale: Enables the "deliverables flow back into system" loop
- Next steps: Implement OneDrive connector, create PARA folder structure, build sync mechanism
- Resources needed: OneDrive API documentation, file indexing logic
- Timeline: Core MVP feature

---

## Reflection & Follow-up

### What Worked Well
- Starting from existing pre-brief gave strong foundation
- Zone-by-zone exploration covered all critical areas
- Stress-testing assumptions revealed hidden design decisions
- External article principles aligned and enriched the vision

### Areas for Further Exploration
- **Meeting pipeline specifics:** How exactly does transcription → action extraction work?
- **Email connector rules:** Does every email enter inbox or only flagged ones?
- **Mobile vs desktop UX:** How different are the experiences?
- **Onboarding flow:** How does a new user set up yearly/monthly objectives?

### Recommended Follow-up Techniques
- **User journey mapping:** Walk through a full week in the life of a user
- **Wireframe prototyping:** Visual mockups of key screens (swipe, weekly review, creation mode)
- **Technical architecture:** Database schema, API design, AI pipeline

### Questions That Emerged
- How do you handle shared projects (collaboration)?
- What happens to actions with deadlines that pass?
- Should there be notifications/reminders, or is it purely pull-based?
- How does the system handle different languages (FR/EN mentioned in brief)?

### Next Session Planning
- **Suggested topics:** Technical architecture deep-dive OR UX wireframing
- **Recommended timeframe:** After digesting this session's outputs
- **Preparation needed:** Prioritize which moonshots to include in MVP vs later

---

*Session facilitated using the BMAD-METHOD™ brainstorming framework*
