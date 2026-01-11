# Bee Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- **Zero lost actions** - Every captured item, especially from meetings and messages, is tracked to completion
- **Frictionless capture** - Any input reaches the unified inbox in under 5 seconds with zero cognitive overhead
- **Sustainable review habits** - Daily swipe review (<5 min) and weekly deep review become habitual, not burdensome
- **AI-powered organization** - System classifies, tags, and organizes without user decision-making at capture time
- **Unified retrieval** - Find any past work in seconds through semantic search
- **Integrated thinking** - One place to capture, organize, think (AI chat), and act
- **Time awareness** - Calendar integration brings time management into the knowledge management system

### Background Context

Knowledge workers today suffer from **information fragmentation** - their ideas, actions, and reference material are scattered across 6+ inboxes (email, notes apps, photos, messages, to-do lists, calendar). These tools become "graveyards" where items enter but never exit because nothing forces processing and retrieval requires remembering *where* something was stored.

Bee solves this by creating a **unified command center** where AI absorbs the complexity of organization. The user's only job is to capture; everything else - classification, prioritization, scheduling, and eventually execution - is handled by AI with human validation. This approach is now viable due to advances in LLM capabilities for classification, extraction, and semantic search.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 0.1 | Initial PRD draft from Project Brief | Sarah (PO) |

---

## Requirements

### Functional Requirements

**Capture & Inbox**
- **FR1:** The system shall provide a unified inbox where all captured items are stored regardless of input source
- **FR2:** The system shall support capture via: manual text entry, photo/image upload, screenshot, voice-to-text, and email forwarding
- **FR3:** The system shall provide a mobile-friendly capture shortcut for voice-to-text that sends directly to inbox
- **FR4:** The system shall connect to email (Microsoft Outlook) and pull messages into the unified inbox
- **FR5:** The system shall allow forwarding Teams messages to inbox via a dedicated email address or integration

**AI Triage & Classification**
- **FR6:** The system shall automatically classify each inbox item using AI with a confidence score (0.0-1.0)
- **FR7:** The system shall extract action candidates from captured content (meetings, notes, messages)
- **FR8:** The system shall route low-confidence items (below 0.6 threshold) to a "Needs Review" queue
- **FR9:** The system shall generate a receipt for each AI classification showing: category, confidence score, and reasoning
- **FR10:** The system shall auto-tag items with topics, people, projects, and dates for semantic search

**Daily Swipe Review**
- **FR11:** The system shall present inbox items as swipeable cards on mobile-first interface
- **FR12:** The system shall support four swipe gestures: right (agree), left (disagree), up (urgent), down (hide)
- **FR13:** Each swipe card shall display: original input, AI extraction, proposed classification, and confidence score
- **FR14:** When user swipes left (disagree), system shall offer: "Fix now" (voice/chat correction) or "Send to weekly review"
- **FR15:** The system shall use swipe feedback to improve AI classification over time

**Weekly Review**
- **FR16:** The system shall present weekly review in top-down order: objectives → priorities → actions → inbox
- **FR17:** The system shall maintain three review queues: Needs Review, Disagreements, and Receipts (spot-check)
- **FR18:** The system shall show weekly review as complete when all mandatory queues reach zero items
- **FR19:** The system shall auto-archive unprocessed items after 15 days with "Unprocessed" tag
- **FR20:** The system shall provide a "Declare Bankruptcy" function to bulk-archive all inbox items

**Goal & Objective Management**
- **FR21:** The system shall support a cascading goal hierarchy: Yearly → Monthly → Weekly objectives
- **FR22:** The system shall display current week's objectives at the start of weekly review
- **FR23:** The system shall allow linking actions to objectives (explicit for projects, AI-suggested for areas)

**PARA Organization**
- **FR24:** The system shall organize all content using PARA structure: Projects, Areas, Resources, Archive
- **FR25:** The system shall mirror PARA folder structure in OneDrive for file storage
- **FR26:** The system shall sync with OneDrive and index new files when user triggers "Sync" function
- **FR27:** The system shall allow creating new deliverables (docs, presentations) from within the app, stored in OneDrive

**Notes & To-Dos**
- **FR28:** The system shall provide a built-in notes engine for ideas, meeting notes, and reference material
- **FR29:** The system shall provide a built-in to-do engine with action items linked to PARA structure
- **FR30:** Actions shall follow "Next Action" format: clear verb + outcome (e.g., "Email Sarah about budget")

**Calendar Integration**
- **FR31:** The system shall display user's calendar (Microsoft Outlook) within the app
- **FR32:** The system shall allow creating calendar events/time blocks for prioritized actions
- **FR33:** The system shall show calendar summary during weekly review (hours of meetings, available focus time)

**AI Chat (Thinking Partner)**
- **FR34:** The system shall provide built-in AI chat interface for brainstorming, drafting, and analysis
- **FR35:** The system shall support switching between LLM providers (Claude, GPT, Gemini)
- **FR36:** The system shall auto-save all AI conversations as searchable items in the system
- **FR37:** The AI chat shall have access to user's captured notes and history for context-aware responses

**Search & Retrieval**
- **FR38:** The system shall provide semantic search across all captured content
- **FR39:** The system shall support both keyword search and conceptual/meaning-based search
- **FR40:** Search results shall include items from: notes, to-dos, conversations, emails, and OneDrive files

### Non-Functional Requirements

**Performance**
- **NFR1:** Capture to inbox confirmation shall complete in under 2 seconds
- **NFR2:** Search results shall return in under 1 second
- **NFR3:** AI classification shall complete in under 5 seconds per item
- **NFR4:** Daily swipe review shall support processing 20+ items in under 5 minutes

**Usability**
- **NFR5:** The system shall be fully functional on mobile browsers (responsive design)
- **NFR6:** Swipe gestures shall feel natural and responsive (< 100ms feedback)
- **NFR7:** The system shall require zero organizational decisions at capture time

**Reliability**
- **NFR8:** No captured item shall ever be permanently deleted without explicit user action
- **NFR9:** The system shall maintain an audit trail of all AI classifications and user corrections
- **NFR10:** The system shall gracefully handle API failures (LLM, Microsoft Graph) with queued retry

**Security**
- **NFR11:** All user data shall be encrypted at rest and in transit
- **NFR12:** API keys and credentials shall be securely stored (not in client code)
- **NFR13:** No user data shall be shared with third parties except for LLM processing

**Cost**
- **NFR14:** LLM API usage shall be optimized to minimize cost (batching, caching, model selection)
- **NFR15:** Infrastructure costs shall aim for < $50/month for single-user MVP

**Maintainability**
- **NFR16:** The system shall be designed for easy token refresh and API reconnection (< 5 min fix)
- **NFR17:** The system shall log errors and provide clear diagnostic information

---

## User Interface Design Goals

### Overall UX Vision

Bee's UX is built around **"one behavior only: capture"** - the interface should make capturing effortless and reviewing satisfying. The app feels like a **command center**, not a filing cabinet.

Key UX principles:
- **Zero cognitive load at capture** - Never ask "where should this go?"
- **Gamified review** - Daily swipe should feel like a quick game, not a chore
- **Progressive disclosure** - Show only what's needed; complexity is hidden until relevant
- **Mobile-first, desktop-capable** - Primary interactions (capture, swipe) optimized for phone; deep work (weekly review, creation) comfortable on desktop

### Key Interaction Paradigms

| Paradigm | Where Used | Description |
|----------|------------|-------------|
| **Swipe Cards** | Daily Review | Tinder-style cards for quick binary/quaternary decisions |
| **Command Center Dashboard** | Home | Single view showing: today's priorities, inbox count, upcoming calendar |
| **Conversational AI** | Thinking Partner | Chat interface with context awareness |
| **Drag & Drop** | Weekly Review, Organization | Move items between PARA categories |
| **Quick Capture** | Global | Floating action button (mobile) or keyboard shortcut (desktop) |

### Core Screens and Views

1. **Home / Dashboard** - Today's priorities, inbox badge, calendar snapshot, quick capture button
2. **Capture Screen** - Text input, photo/screenshot upload, voice recording with transcription
3. **Daily Swipe Review** - Full-screen card stack with swipe gestures and progress indicator
4. **Weekly Review** - Step-by-step wizard flow with objectives, queues, and calendar integration
5. **AI Chat / Thinking Partner** - Familiar chat interface with model selector and context indicator
6. **Search & Browse** - Universal search bar with filters and preview snippets
7. **Calendar View** - Week/day toggle, color-coded events, click to create time blocks
8. **Settings & Configuration** - API connections, PARA structure, review preferences, data export

### Accessibility

**WCAG AA** compliance: sufficient color contrast, keyboard navigation, screen reader compatibility, alternative to swipe gestures (button controls).

### Branding

Initial MVP: Clean, minimal design system with warm, approachable color palette. "Bee" name suggests productivity and activity.

### Target Device and Platforms

**Web Responsive** - Single codebase serving mobile browsers (primary for capture + daily swipe), desktop browsers (primary for weekly review + creation), and tablet (secondary).

---

## Technical Assumptions

### Repository Structure

**Monorepo** - Single repository for the web application.

### Service Architecture

*To be determined by Architect*, with these inputs:
- Prefer leveraging existing infrastructure where possible
- Hugo has n8n and LibreChat already running on VPS
- MCP protocol preferred over custom APIs for AI integrations
- Goal: minimize what needs to be built from scratch

### Testing Requirements

**Unit + Integration Testing** - Pragmatic approach for solo MVP:
- Unit tests for core business logic
- Integration tests for API routes and database operations
- Limited E2E tests for critical user flows (capture, swipe, review)
- Manual testing for full user journeys

### Additional Technical Assumptions and Requests

- **Existing Infrastructure:** n8n on VPS (available for integrations), LibreChat on VPS (available for AI chat)
- **Protocol Preference:** MCP for AI tool-calling where applicable
- **Microsoft Integration:** Required (Outlook, Calendar, OneDrive)
- **LLM Providers:** Must support Claude, GPT, Gemini (model-agnostic)
- **Database:** PostgreSQL + vector search capability needed
- **Hosting:** Flexible - could be Vercel, VPS, or hybrid
- **Cost Target:** < $50/month operational costs for single-user MVP

*Detailed architecture decisions deferred to Architect.*

---

## Epic List

| # | Epic | Goal Statement |
|---|------|----------------|
| **Epic 1** | Foundation & Infrastructure | Establish project setup, authentication, database, and verify external service connections |
| **Epic 2** | Unified Inbox & Capture | Enable capturing items from multiple sources into a single unified inbox |
| **Epic 3** | AI Triage & Classification | Automatically classify inbox items with confidence scores and route appropriately |
| **Epic 4** | Daily Swipe Review | Provide a fast, mobile-first review experience for processing inbox items |
| **Epic 5** | Weekly Review & Organization | Enable top-down weekly planning with PARA organization |
| **Epic 6** | Calendar & Search | Integrate calendar visibility and semantic search across all content |

---

## Epic 1: Foundation & Infrastructure

**Goal:** Establish project setup, authentication, database schema, and verify connections to external services (Microsoft, n8n, LibreChat) so that subsequent epics have a solid foundation.

### Story 1.1: Project Setup & Development Environment

**As a** developer,
**I want** a properly configured project with all tooling in place,
**so that** I can develop efficiently with type safety and fast feedback.

**Acceptance Criteria:**
1. Next.js project initialized with TypeScript, ESLint, and Prettier configured
2. Tailwind CSS and shadcn/ui installed and configured
3. Git repository initialized with .gitignore and initial commit
4. Development server runs successfully with hot reload
5. Basic folder structure established following project conventions

### Story 1.2: Database Setup & Core Schema

**As a** developer,
**I want** the database configured with the core data model,
**so that** I can persist and query user data.

**Acceptance Criteria:**
1. PostgreSQL database provisioned and accessible
2. Prisma ORM configured with initial schema
3. Core entities defined: User, InboxItem, Note, Action, Project, Area, Resource
4. Vector extension (pgvector) enabled for semantic search
5. Database migrations run successfully
6. Seed script creates test data for development

### Story 1.3: Authentication with Microsoft

**As a** user,
**I want** to sign in with my Microsoft account,
**so that** I can access my Outlook and OneDrive data.

**Acceptance Criteria:**
1. NextAuth.js configured with Microsoft provider
2. User can sign in via Microsoft OAuth flow
3. Access tokens stored securely for API calls
4. User session persists across browser refreshes
5. Sign out functionality works correctly
6. Protected routes redirect unauthenticated users to login

### Story 1.4: Basic UI Shell & Navigation

**As a** user,
**I want** a basic application shell with navigation,
**so that** I can move between different sections of the app.

**Acceptance Criteria:**
1. Responsive layout with mobile and desktop views
2. Bottom navigation bar on mobile (Home, Capture, Review, Search)
3. Sidebar navigation on desktop
4. Home page displays placeholder dashboard
5. All navigation routes render placeholder content
6. Loading states and error boundaries implemented

### Story 1.5: External Service Connection Verification

**As a** developer,
**I want** to verify connections to external services,
**so that** I know integrations will work before building features.

**Acceptance Criteria:**
1. Microsoft Graph API connection verified (can fetch user profile)
2. n8n webhook endpoint responds successfully
3. LibreChat API (or MCP) connection verified
4. Health check endpoint reports status of all external services
5. Environment variables documented for all service connections

---

## Epic 2: Unified Inbox & Capture

**Goal:** Enable capturing items from multiple sources (manual entry, photos, voice, email) into a single unified inbox where all items await processing.

### Story 2.1: Manual Text Capture

**As a** user,
**I want** to quickly capture a text note,
**so that** I can get ideas out of my head and into the system.

**Acceptance Criteria:**
1. Capture screen accessible from any page via FAB (mobile) or keyboard shortcut (desktop)
2. Text input field with submit button
3. Captured item saved to InboxItem table with timestamp and source="manual"
4. Success confirmation shown (toast notification)
5. Input clears after successful capture
6. Capture completes in under 2 seconds

### Story 2.2: Photo & Screenshot Capture

**As a** user,
**I want** to capture photos and screenshots,
**so that** I can save whiteboards, documents, and visual information.

**Acceptance Criteria:**
1. Camera capture option on capture screen (mobile)
2. File upload option for screenshots/images (all devices)
3. Images stored (cloud storage or database)
4. Thumbnail preview shown before submission
5. InboxItem created with type="image" and image reference
6. Image viewable from inbox item detail

### Story 2.3: Voice Capture with Transcription

**As a** user,
**I want** to capture ideas via voice,
**so that** I can capture thoughts hands-free (e.g., while walking).

**Acceptance Criteria:**
1. Voice recording button on capture screen
2. Browser Web Speech API used for transcription
3. Transcribed text shown for review before saving
4. User can edit transcription before submitting
5. InboxItem saved with both audio reference and transcription
6. Works on mobile browsers (iOS Safari, Chrome)

### Story 2.4: Email Forwarding to Inbox

**As a** user,
**I want** to forward emails to my inbox,
**so that** I can capture important messages without leaving my email client.

**Acceptance Criteria:**
1. Dedicated email address or webhook for receiving forwarded emails
2. n8n workflow triggers on incoming email
3. Email parsed (sender, subject, body, attachments)
4. InboxItem created with type="email" and email metadata
5. Attachments stored and linked to inbox item
6. Processing completes within 30 seconds of forwarding

### Story 2.5: Inbox List View

**As a** user,
**I want** to see all items in my inbox,
**so that** I can understand what needs processing.

**Acceptance Criteria:**
1. Inbox page shows list of all unprocessed items
2. Items sorted by newest first (default)
3. Each item shows: preview/title, source icon, timestamp, AI status
4. Click item to view full details
5. Badge on navigation shows inbox count
6. Empty state shown when inbox is empty

---

## Epic 3: AI Triage & Classification

**Goal:** Automatically classify inbox items using AI, extract action candidates, assign confidence scores, and route items appropriately based on confidence.

### Story 3.1: AI Classification Service

**As a** system,
**I want** to classify inbox items using AI,
**so that** users don't have to manually organize everything.

**Acceptance Criteria:**
1. Classification service accepts inbox item content
2. AI analyzes content and returns: category, confidence score (0-1), reasoning
3. Categories include: Action, Note, Reference, Meeting, Unknown
4. Service abstracts LLM provider (can switch between Claude/GPT)
5. Classification results stored on InboxItem record
6. Classification completes in under 5 seconds

### Story 3.2: Action Candidate Extraction

**As a** user,
**I want** the AI to identify potential actions in my captures,
**so that** I don't miss follow-ups hidden in notes and emails.

**Acceptance Criteria:**
1. AI extracts action candidates from inbox item content
2. Each action candidate includes: description, confidence, probable owner, due date (if mentioned)
3. Action candidates stored as linked records to parent inbox item
4. Multiple actions can be extracted from single item
5. Low-confidence actions (<0.6) flagged for human review

### Story 3.3: Auto-Tagging & Metadata Enrichment

**As a** user,
**I want** items automatically tagged with relevant metadata,
**so that** I can find them later through search.

**Acceptance Criteria:**
1. AI extracts: topics, people mentioned, project references, dates
2. Tags stored as searchable metadata on inbox item
3. People tags linked to contact records (if exists)
4. Project tags linked to PARA projects (if match found)
5. Tags visible on inbox item detail view

### Story 3.4: Bouncer System (Confidence Routing)

**As a** user,
**I want** low-confidence items routed to a review queue,
**so that** I can validate uncertain AI decisions.

**Acceptance Criteria:**
1. Items with confidence < 0.6 automatically flagged "Needs Review"
2. High-confidence items (≥0.6) auto-filed with receipt notification
3. Receipt shows: "Filed as [Category]. Confidence: [Score]"
4. Receipts accessible in dedicated "Receipts" tab for spot-checking
5. Confidence threshold configurable in settings

### Story 3.5: Background Processing Queue

**As a** system,
**I want** to process inbox items in the background,
**so that** capture remains fast and users aren't blocked.

**Acceptance Criteria:**
1. New inbox items queued for AI processing
2. Background job processes queue continuously
3. Processing status shown on inbox items (pending, processing, complete, error)
4. Failed items retry automatically (up to 3 times)
5. Processing errors logged with details for debugging

---

## Epic 4: Daily Swipe Review

**Goal:** Provide a fast, mobile-first swipe review experience that allows users to process inbox items in under 5 minutes through intuitive gestures.

### Story 4.1: Swipe Card Component

**As a** user,
**I want** to see inbox items as swipeable cards,
**so that** I can make quick decisions with natural gestures.

**Acceptance Criteria:**
1. Card displays: content preview, AI classification, confidence score, source
2. Card supports swipe gestures: right, left, up, down
3. Visual feedback during swipe (color change, icon reveal)
4. Haptic feedback on mobile (if supported)
5. Gesture threshold prevents accidental swipes
6. Card animates off-screen on successful swipe

### Story 4.2: Swipe Gesture Actions

**As a** user,
**I want** different swipes to perform different actions,
**so that** I can quickly indicate my decision.

**Acceptance Criteria:**
1. Swipe right = Agree with AI classification (item filed)
2. Swipe left = Disagree (opens correction options)
3. Swipe up = Mark as urgent (surfaces to top priority)
4. Swipe down = Hide (archive, low value)
5. Each action updates item status in database
6. Undo option available for 5 seconds after swipe

### Story 4.3: Daily Review Screen

**As a** user,
**I want** a dedicated daily review experience,
**so that** I can process my inbox efficiently each day.

**Acceptance Criteria:**
1. Daily review screen shows card stack of pending items
2. Progress indicator shows items remaining
3. Session summary shown when complete ("12 items processed in 3:24")
4. Quick stats: items agreed, disagreed, urgent, hidden
5. Celebration/completion animation when inbox reaches zero
6. Screen optimized for one-handed mobile use

### Story 4.4: Disagree Flow & Correction

**As a** user,
**I want** to correct AI mistakes easily,
**so that** the system learns and improves.

**Acceptance Criteria:**
1. Swipe left opens correction modal
2. Options: "Fix now" or "Send to weekly review"
3. "Fix now" allows: select correct category, edit extracted actions, voice correction
4. Correction saved and linked to original AI classification
5. Item re-filed with user's correction
6. Correction data available for future AI improvement

### Story 4.5: Review Session Persistence

**As a** user,
**I want** my review progress saved,
**so that** I can resume if interrupted.

**Acceptance Criteria:**
1. Review session state persisted (current position, actions taken)
2. Closing app mid-review preserves progress
3. Returning to review resumes from where user left off
4. Option to start fresh review (clear session)
5. Session expires after 24 hours (starts fresh)

---

## Epic 5: Weekly Review & Organization

**Goal:** Enable top-down weekly planning starting with objectives, provide PARA organization structure, and ensure all items are processed to inbox zero.

### Story 5.1: Objectives Management

**As a** user,
**I want** to set and track my objectives,
**so that** I can align my weekly work with bigger goals.

**Acceptance Criteria:**
1. Objectives page for managing yearly/monthly/weekly goals
2. Create objective with: title, description, timeframe, parent objective
3. Weekly objectives automatically cascade from monthly
4. Current week's objectives displayed prominently
5. Objectives can be marked complete or carried forward
6. Objective history preserved for review

### Story 5.2: Weekly Review Wizard

**As a** user,
**I want** a guided weekly review flow,
**so that** I systematically process everything without missing steps.

**Acceptance Criteria:**
1. Weekly review follows sequence: Objectives → Priorities → Actions → Inbox
2. Step 1: Review/confirm this week's objectives
3. Step 2: Select priority projects/areas for the week
4. Step 3: Review and organize actions for priorities
5. Step 4: Process remaining inbox items (Needs Review + Disagreements queues)
6. Progress indicator shows current step and completion status

### Story 5.3: PARA Structure Setup

**As a** user,
**I want** to organize content into Projects, Areas, Resources, and Archive,
**so that** I can find things based on their purpose.

**Acceptance Criteria:**
1. PARA categories visible in navigation/sidebar
2. User can create/edit/archive Projects and Areas
3. Resources section for reference material
4. Archive for inactive items (searchable but hidden from main views)
5. Items can be moved between PARA categories
6. Each PARA item has: title, description, status, linked items

### Story 5.4: Inbox Processing in Weekly Review

**As a** user,
**I want** to process items that need human decision,
**so that** I achieve inbox zero each week.

**Acceptance Criteria:**
1. Weekly review shows three queues: Needs Review, Disagreements, Receipts
2. Needs Review and Disagreements are mandatory (must reach zero)
3. Receipts are optional (spot-check for accuracy)
4. Each item can be: filed (assign to PARA), converted to action, or archived
5. Bulk actions available (archive all, file all to...)
6. Review complete indicator when mandatory queues empty

### Story 5.5: Auto-Archive & Bankruptcy

**As a** user,
**I want** old items auto-archived and ability to declare bankruptcy,
**so that** I can restart without guilt if I fall behind.

**Acceptance Criteria:**
1. Items unprocessed for 15 days automatically archived
2. Auto-archived items tagged "Unprocessed - [Date]"
3. Warning shown before items are auto-archived
4. "Declare Bankruptcy" button bulk-archives all inbox items
5. Bankruptcy requires confirmation ("Type RESET to confirm")
6. Archived items remain searchable

---

## Epic 6: Calendar & Search

**Goal:** Integrate calendar visibility for time management during reviews and provide semantic search across all captured content.

### Story 6.1: Calendar Integration (Read)

**As a** user,
**I want** to see my calendar within the app,
**so that** I can plan my week with time awareness.

**Acceptance Criteria:**
1. Calendar view shows events from Microsoft Outlook
2. Week view and day view toggle
3. Events display: title, time, duration, meeting attendees
4. Calendar fetched via Microsoft Graph API (or n8n)
5. Refresh button to sync latest events
6. Calendar accessible from main navigation

### Story 6.2: Calendar Summary in Weekly Review

**As a** user,
**I want** to see a summary of my time commitments,
**so that** I can realistically plan my week.

**Acceptance Criteria:**
1. Weekly review includes calendar summary panel
2. Shows: total meeting hours, available focus hours, busiest day
3. Visual indicator if calendar is overloaded
4. Links to full calendar view for details
5. Summary updates in real-time if calendar changes

### Story 6.3: Time Block Creation

**As a** user,
**I want** to create calendar blocks for my priorities,
**so that** I protect time for important work.

**Acceptance Criteria:**
1. From action item, option to "Block time for this"
2. Time block creator: select date, duration, title
3. Creates event in Microsoft Outlook calendar
4. Event linked back to action item in Bee
5. Confirmation shown after event created

### Story 6.4: Semantic Search Implementation

**As a** user,
**I want** to search across all my content by meaning,
**so that** I can find things even if I don't remember exact words.

**Acceptance Criteria:**
1. Search bar accessible from all screens
2. Search queries processed for semantic similarity (vector search)
3. Results ranked by relevance, not just keyword match
4. Results include: notes, actions, emails, AI conversations, OneDrive files
5. Search results show preview snippet with highlighted matches
6. Click result to navigate to item detail

### Story 6.5: Search Filters & History

**As a** user,
**I want** to filter search results and see recent searches,
**so that** I can find things faster.

**Acceptance Criteria:**
1. Filters available: type (note, action, email), date range, PARA category, source
2. Filters can be combined
3. Recent searches shown (last 10)
4. Search history can be cleared
5. Empty search shows recent items and suggested searches

---

## Checklist Results Report

*To be completed after PRD review and before handoff to Architect.*

---

## Next Steps

### UX Expert Prompt

> Review the Bee PRD (docs/prd.md) and create detailed UX specifications for the core screens, with particular focus on the Daily Swipe Review experience and the mobile capture flow. Prioritize the interactions that support the "one behavior only: capture" philosophy.

### Architect Prompt

> Review the Bee PRD (docs/prd.md) and Project Brief (docs/brief.md), then create the technical architecture. Consider the existing infrastructure (n8n on VPS, LibreChat on VPS) and preference for MCP protocol. Design a system that minimizes custom development while meeting all functional requirements.
