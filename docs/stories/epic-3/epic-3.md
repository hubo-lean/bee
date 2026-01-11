# Epic 3: AI Triage & Classification

## Goal

Automatically classify inbox items using AI, extract action candidates, assign confidence scores, and route items appropriately based on confidence level.

## Overview

Epic 3 transforms Bee from a simple capture tool into an intelligent system. When items enter the inbox, AI analyzes them to:
1. Classify by type (action, note, reference, meeting)
2. Extract actionable items hidden in the content
3. Tag with relevant metadata for search
4. Route based on confidence (auto-file vs needs review)

This is the foundation of Bee's "zero cognitive load" promise - users capture, AI organizes.

## Dependencies

- **Epic 1**: Foundation infrastructure (authentication, database, tRPC)
- **Epic 2**: Unified Inbox & Capture (InboxItem model, capture flow)
- **n8n**: Workflow automation for LLM orchestration
- **LLM Provider**: Claude/GPT for classification prompts

## Stories

| Story | Title | Priority | Complexity | Dependencies |
|-------|-------|----------|------------|--------------|
| 3.1 | AI Classification Service | P0 | High | Epic 2, n8n |
| 3.2 | Action Candidate Extraction | P0 | Medium | Story 3.1 |
| 3.3 | Auto-Tagging & Metadata Enrichment | P1 | Medium | Story 3.1 |
| 3.4 | Bouncer System (Confidence Routing) | P0 | Medium | Story 3.1 |
| 3.5 | Background Processing Queue | P0 | Medium | Story 3.1 |

## Architecture

### Data Flow

```
[New InboxItem]
    → [Status: pending]
    → [n8n Webhook: /classify-inbox-item]
    → [LLM Classification]
    → [Webhook: /classification-complete]
    → [Update InboxItem with aiClassification]
    → [Create ClassificationAudit]
    → [Route based on confidence]
```

### Classification Response

```typescript
interface AIClassification {
  category: "action" | "note" | "reference" | "meeting" | "unknown";
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  suggestedProject?: string;
  suggestedArea?: string;
  modelUsed: string;
  processedAt: Date;
}
```

### Action Candidate

```typescript
interface ActionCandidate {
  description: string;
  confidence: number;
  owner?: string;
  dueDate?: Date;
  priority?: "urgent" | "high" | "normal" | "low";
}
```

### Confidence Routing

| Confidence | Action |
|------------|--------|
| >= 0.6 | Auto-filed with receipt notification |
| < 0.6 | Flagged "Needs Review" queue |
| Error | Status: "error", retry queue |

## Technical Components

### Backend Services

1. **ClassificationService** (`apps/web/src/server/services/classification.service.ts`)
   - `classify(content, context)` - Send to n8n for classification
   - `extractActions(content)` - Extract action candidates
   - `recordAudit(audit)` - Create ClassificationAudit record

2. **n8n Workflows**
   - `classify-inbox-item` - Main classification workflow
   - `extract-actions` - Action extraction sub-workflow

3. **Webhook Endpoints**
   - `POST /api/webhooks/classification-complete` - Receive results from n8n

### Database Models (Existing)

- `InboxItem.aiClassification` - JSON field for classification
- `InboxItem.extractedActions` - JSON array of action candidates
- `InboxItem.tags` - JSON array of auto-tags
- `ClassificationAudit` - Full audit trail model

## Sprint Execution Order

1. **Story 3.5** (Background Processing Queue) - Queue infrastructure
2. **Story 3.1** (AI Classification Service) - Core classification
3. **Story 3.2** (Action Extraction) - Extract actions from content
4. **Story 3.3** (Auto-Tagging) - Metadata enrichment
5. **Story 3.4** (Bouncer System) - Confidence-based routing

## Success Criteria

- [ ] Items classified within 5 seconds of capture
- [ ] Confidence scores accurately reflect uncertainty
- [ ] Actions extracted from meeting notes and emails
- [ ] Auto-tags enable semantic search
- [ ] Low-confidence items routed to review queue
- [ ] Full audit trail for all classifications
- [ ] Graceful handling of LLM failures

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM latency > 5s | Poor UX | Background processing, status indicators |
| Classification errors | User trust | Confidence scores, easy correction |
| LLM costs | Budget | Batching, caching, model selection |
| n8n downtime | No classification | Retry queue, graceful degradation |

## Out of Scope

- Training/fine-tuning custom models
- Real-time classification (async is acceptable)
- Multi-language support (English only for MVP)
- Embedded vector search (deferred to Epic 6)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial epic creation for sprint planning | Bob (SM) |
