# Bee Application Test Protocol

## Overview

This document provides a comprehensive manual test protocol for validating all Bee application functionality using a Chrome browser extension testing approach. The testing agent should execute each test case and document whether it passes or fails.

**Test Date:** _______________
**Tester:** _______________
**Browser Version:** _______________
**Environment:** _______________

---

## Test Results Summary

| Epic | Total Tests | Passed | Failed | Blocked | Notes |
|------|-------------|--------|--------|---------|-------|
| Epic 1: Foundation | 25 | | | | |
| Epic 2: Capture & Inbox | 30 | | | | |
| Epic 3: AI Triage | 25 | | | | |
| Epic 4: Daily Review | 28 | | | | |
| Epic 5: Weekly Review | 35 | | | | |
| Epic 6: Calendar & Search | 30 | | | | |
| **TOTAL** | **173** | | | | |

---

## Pre-Test Setup

### Environment Verification

| Check | Status | Notes |
|-------|--------|-------|
| Application URL accessible | [ ] Pass / [ ] Fail | |
| Database connection healthy | [ ] Pass / [ ] Fail | |
| Microsoft OAuth configured | [ ] Pass / [ ] Fail | |
| n8n webhook endpoint active | [ ] Pass / [ ] Fail | |
| OpenAI/LLM API key valid | [ ] Pass / [ ] Fail | |

### Test User Setup

```
Test User Email: _______________
Test User Created: [ ] Yes / [ ] No
Test Data Seeded: [ ] Yes / [ ] No
```

---

## Epic 1: Foundation & Infrastructure

### 1.1 Authentication Tests

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 1.1.1 | Microsoft OAuth Login | 1. Navigate to login page<br>2. Click "Sign in with Microsoft"<br>3. Complete OAuth flow | User redirected to dashboard | [ ] Pass / [ ] Fail | |
| 1.1.2 | Session Persistence | 1. Login<br>2. Close browser<br>3. Reopen and navigate to app | User remains logged in | [ ] Pass / [ ] Fail | |
| 1.1.3 | Sign Out | 1. Click user menu<br>2. Click "Sign Out" | User logged out, redirected to login | [ ] Pass / [ ] Fail | |
| 1.1.4 | Protected Route Redirect | 1. Log out<br>2. Navigate directly to /dashboard | Redirected to login page | [ ] Pass / [ ] Fail | |
| 1.1.5 | Token Refresh | 1. Login<br>2. Wait for token expiry (or simulate)<br>3. Make API request | Token refreshed automatically | [ ] Pass / [ ] Fail | |

### 1.2 Navigation Tests

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 1.2.1 | Mobile Bottom Nav | 1. View app on mobile viewport<br>2. Verify bottom navigation visible | Bottom nav shows: Home, Capture, Review, Search | [ ] Pass / [ ] Fail | |
| 1.2.2 | Desktop Sidebar | 1. View app on desktop viewport<br>2. Verify sidebar visible | Sidebar navigation visible with all sections | [ ] Pass / [ ] Fail | |
| 1.2.3 | Navigation Badge (Inbox Count) | 1. Add items to inbox<br>2. Check navigation | Badge shows correct count | [ ] Pass / [ ] Fail | |
| 1.2.4 | Responsive Breakpoints | 1. Resize browser from mobile to desktop | Layout adapts correctly at breakpoints | [ ] Pass / [ ] Fail | |

### 1.3 External Service Health

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 1.3.1 | Microsoft Graph Connection | 1. Navigate to health check<br>2. Verify Microsoft status | Microsoft Graph: Connected | [ ] Pass / [ ] Fail | |
| 1.3.2 | n8n Webhook Status | 1. Check health endpoint | n8n webhook: Responding | [ ] Pass / [ ] Fail | |
| 1.3.3 | Database Connection | 1. Check health endpoint | Database: Connected | [ ] Pass / [ ] Fail | |
| 1.3.4 | LLM API Status | 1. Check health endpoint | LLM API: Available | [ ] Pass / [ ] Fail | |

---

## Epic 2: Unified Inbox & Capture

### 2.1 Manual Text Capture

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 2.1.1 | Open Capture Modal (Mobile) | 1. On mobile, tap FAB button | Capture modal opens | [ ] Pass / [ ] Fail | |
| 2.1.2 | Open Capture Modal (Desktop) | 1. On desktop, press Cmd/Ctrl+K | Capture modal opens | [ ] Pass / [ ] Fail | |
| 2.1.3 | Submit Text Capture | 1. Open capture<br>2. Type "Test capture item"<br>3. Submit | Success toast shown, input clears | [ ] Pass / [ ] Fail | |
| 2.1.4 | Capture Performance (<2s) | 1. Time capture submission | Confirmation in under 2 seconds | [ ] Pass / [ ] Fail | |
| 2.1.5 | Empty Capture Prevention | 1. Try to submit empty capture | Validation error shown | [ ] Pass / [ ] Fail | |
| 2.1.6 | Long Text Capture | 1. Paste 5000+ characters<br>2. Submit | Capture succeeds without truncation | [ ] Pass / [ ] Fail | |

### 2.2 Photo & Image Capture

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 2.2.1 | Image Upload | 1. Open capture<br>2. Click image upload<br>3. Select image file | Image preview shown | [ ] Pass / [ ] Fail | |
| 2.2.2 | Camera Capture (Mobile) | 1. On mobile, tap camera option<br>2. Take photo | Photo captured and previewed | [ ] Pass / [ ] Fail | |
| 2.2.3 | Screenshot Upload | 1. Upload .png screenshot | Screenshot saved to inbox | [ ] Pass / [ ] Fail | |
| 2.2.4 | Image Type Validation | 1. Try to upload .exe file | File rejected with error | [ ] Pass / [ ] Fail | |
| 2.2.5 | Image Size Limit | 1. Upload image >10MB | Appropriate error or compression | [ ] Pass / [ ] Fail | |
| 2.2.6 | View Image in Inbox | 1. Capture image<br>2. View in inbox detail | Image renders correctly | [ ] Pass / [ ] Fail | |

### 2.3 Voice Capture

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 2.3.1 | Start Voice Recording | 1. Open capture<br>2. Tap microphone | Recording starts, visual indicator shown | [ ] Pass / [ ] Fail | |
| 2.3.2 | Voice Transcription | 1. Record "This is a test"<br>2. Stop recording | Transcribed text displayed | [ ] Pass / [ ] Fail | |
| 2.3.3 | Edit Transcription | 1. After transcription, edit text<br>2. Submit | Edited text saved | [ ] Pass / [ ] Fail | |
| 2.3.4 | Cancel Recording | 1. Start recording<br>2. Cancel | Recording discarded, no item created | [ ] Pass / [ ] Fail | |
| 2.3.5 | Microphone Permission | 1. Block mic permission<br>2. Try voice capture | Appropriate error message | [ ] Pass / [ ] Fail | |

### 2.4 Email Forwarding

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 2.4.1 | Forward Email to Inbox | 1. Forward email to dedicated address | Email appears in inbox within 30s | [ ] Pass / [ ] Fail | |
| 2.4.2 | Email Metadata Extraction | 1. Forward email<br>2. Check inbox item | Shows sender, subject, body | [ ] Pass / [ ] Fail | |
| 2.4.3 | Email with Attachments | 1. Forward email with PDF attachment | Attachment accessible in item | [ ] Pass / [ ] Fail | |
| 2.4.4 | HTML Email Rendering | 1. Forward HTML formatted email | Body renders correctly (or plain text fallback) | [ ] Pass / [ ] Fail | |

### 2.5 Inbox List View

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 2.5.1 | View Inbox List | 1. Navigate to Inbox page | List of unprocessed items shown | [ ] Pass / [ ] Fail | |
| 2.5.2 | Inbox Sorting | 1. Check default sort order | Newest items first | [ ] Pass / [ ] Fail | |
| 2.5.3 | Item Preview | 1. View item in list | Shows preview, source icon, timestamp | [ ] Pass / [ ] Fail | |
| 2.5.4 | Item Detail View | 1. Click on inbox item | Full detail page opens | [ ] Pass / [ ] Fail | |
| 2.5.5 | Empty Inbox State | 1. Process all items to empty inbox | Empty state message displayed | [ ] Pass / [ ] Fail | |
| 2.5.6 | Inbox Pagination | 1. Add 50+ items<br>2. Scroll/paginate | All items accessible | [ ] Pass / [ ] Fail | |

---

## Epic 3: AI Triage & Classification

### 3.1 Classification Service

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 3.1.1 | Auto-Classification Trigger | 1. Capture new item<br>2. Wait for processing | Item classified within 5 seconds | [ ] Pass / [ ] Fail | |
| 3.1.2 | Classification Categories | 1. Check classified item | Shows category (Action/Note/Reference/etc.) | [ ] Pass / [ ] Fail | |
| 3.1.3 | Confidence Score Display | 1. View classified item | Confidence score (0-1) displayed | [ ] Pass / [ ] Fail | |
| 3.1.4 | Classification Reasoning | 1. View item receipt | AI reasoning explanation shown | [ ] Pass / [ ] Fail | |
| 3.1.5 | LLM Provider Switching | 1. In settings, change LLM provider<br>2. Capture item | Classification uses new provider | [ ] Pass / [ ] Fail | |

### 3.2 Action Extraction

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 3.2.1 | Extract Action from Note | 1. Capture "Remind me to call John tomorrow" | Action candidate extracted | [ ] Pass / [ ] Fail | |
| 3.2.2 | Multiple Actions Extraction | 1. Capture text with 3 action items | All 3 actions extracted | [ ] Pass / [ ] Fail | |
| 3.2.3 | Due Date Extraction | 1. Capture "Submit report by Friday" | Due date identified | [ ] Pass / [ ] Fail | |
| 3.2.4 | Person Extraction | 1. Capture text mentioning people | People tagged/extracted | [ ] Pass / [ ] Fail | |
| 3.2.5 | Low Confidence Action Flag | 1. Capture ambiguous action | Flagged as low confidence (<0.6) | [ ] Pass / [ ] Fail | |

### 3.3 Auto-Tagging

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 3.3.1 | Topic Tag Extraction | 1. Capture "Notes from marketing meeting" | Tagged with "marketing" | [ ] Pass / [ ] Fail | |
| 3.3.2 | Project Linking | 1. Capture mentioning existing project name | Linked to project | [ ] Pass / [ ] Fail | |
| 3.3.3 | Date Extraction | 1. Capture with dates mentioned | Dates extracted as metadata | [ ] Pass / [ ] Fail | |
| 3.3.4 | View Tags on Item | 1. Open classified item | Tags visible in UI | [ ] Pass / [ ] Fail | |

### 3.4 Confidence Routing (Bouncer)

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 3.4.1 | Low Confidence to Needs Review | 1. Capture ambiguous item<br>2. Check routing | Item in "Needs Review" queue | [ ] Pass / [ ] Fail | |
| 3.4.2 | High Confidence Auto-File | 1. Capture clear action<br>2. Check status | Auto-filed with receipt | [ ] Pass / [ ] Fail | |
| 3.4.3 | Receipt Generation | 1. Check filed item | Receipt shows category, score, reasoning | [ ] Pass / [ ] Fail | |
| 3.4.4 | Receipts Tab Access | 1. Navigate to Receipts | List of AI-filed items visible | [ ] Pass / [ ] Fail | |
| 3.4.5 | Configure Confidence Threshold | 1. In settings, change threshold to 0.8<br>2. Capture item | Threshold respected | [ ] Pass / [ ] Fail | |

### 3.5 Background Processing

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 3.5.1 | Processing Status Indicator | 1. Capture item<br>2. Check inbox immediately | Shows "Processing" status | [ ] Pass / [ ] Fail | |
| 3.5.2 | Processing Completion | 1. Wait for processing | Status changes to "Complete" | [ ] Pass / [ ] Fail | |
| 3.5.3 | Error Handling | 1. Simulate LLM failure<br>2. Check item | Shows "Error" with retry option | [ ] Pass / [ ] Fail | |
| 3.5.4 | Retry on Failure | 1. After error, click retry | Item re-processed | [ ] Pass / [ ] Fail | |

---

## Epic 4: Daily Swipe Review

### 4.1 Swipe Card Component

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 4.1.1 | Card Content Display | 1. Open daily review | Card shows content, AI classification, confidence | [ ] Pass / [ ] Fail | |
| 4.1.2 | Swipe Right Gesture | 1. Swipe card right | Card animates out, shows green/check | [ ] Pass / [ ] Fail | |
| 4.1.3 | Swipe Left Gesture | 1. Swipe card left | Card animates out, shows red/X | [ ] Pass / [ ] Fail | |
| 4.1.4 | Swipe Up Gesture | 1. Swipe card up | Card marked urgent, shows orange | [ ] Pass / [ ] Fail | |
| 4.1.5 | Swipe Down Gesture | 1. Swipe card down | Card hidden/archived | [ ] Pass / [ ] Fail | |
| 4.1.6 | Haptic Feedback (Mobile) | 1. On mobile, perform swipe | Device vibrates on action | [ ] Pass / [ ] Fail | |
| 4.1.7 | Gesture Threshold | 1. Small swipe (< threshold)<br>2. Release | Card returns to center | [ ] Pass / [ ] Fail | |
| 4.1.8 | Card Stack Visual | 1. View review screen | Cards stacked behind current card | [ ] Pass / [ ] Fail | |

### 4.2 Swipe Actions

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 4.2.1 | Agree (Right) - File Item | 1. Swipe right on item | Item filed per AI classification | [ ] Pass / [ ] Fail | |
| 4.2.2 | Disagree (Left) - Opens Modal | 1. Swipe left | Correction modal opens | [ ] Pass / [ ] Fail | |
| 4.2.3 | Urgent (Up) - Mark Priority | 1. Swipe up | Item marked urgent, surfaced to top | [ ] Pass / [ ] Fail | |
| 4.2.4 | Hide (Down) - Archive | 1. Swipe down | Item archived | [ ] Pass / [ ] Fail | |
| 4.2.5 | Undo Action (5s window) | 1. Swipe any direction<br>2. Tap Undo within 5s | Action undone, card restored | [ ] Pass / [ ] Fail | |
| 4.2.6 | Undo Expiration | 1. Swipe<br>2. Wait >5 seconds | Undo option disappears | [ ] Pass / [ ] Fail | |

### 4.3 Daily Review Screen

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 4.3.1 | Progress Indicator | 1. Start review with 10 items | Shows "1 of 10" | [ ] Pass / [ ] Fail | |
| 4.3.2 | Progress Updates | 1. Process 3 items | Shows "4 of 10" | [ ] Pass / [ ] Fail | |
| 4.3.3 | Session Stats | 1. Process items | Shows agreed/disagreed/urgent/hidden counts | [ ] Pass / [ ] Fail | |
| 4.3.4 | Completion Celebration | 1. Process all items | Celebration animation plays | [ ] Pass / [ ] Fail | |
| 4.3.5 | Session Summary | 1. Complete review | Shows "12 items in 3:24" format | [ ] Pass / [ ] Fail | |
| 4.3.6 | Gesture Hints (First 3 Cards) | 1. Start fresh review | Gesture hints visible | [ ] Pass / [ ] Fail | |
| 4.3.7 | Gesture Hints Hide | 1. Process 4+ cards | Hints no longer shown | [ ] Pass / [ ] Fail | |

### 4.4 Disagree Flow & Correction

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 4.4.1 | Fix Now Option | 1. Swipe left<br>2. Choose "Fix now" | Correction interface opens | [ ] Pass / [ ] Fail | |
| 4.4.2 | Send to Weekly Review | 1. Swipe left<br>2. Choose "Weekly review" | Item deferred to weekly | [ ] Pass / [ ] Fail | |
| 4.4.3 | Change Category | 1. Fix now<br>2. Select different category | Category updated | [ ] Pass / [ ] Fail | |
| 4.4.4 | Edit Extracted Actions | 1. Fix now<br>2. Edit action text | Changes saved | [ ] Pass / [ ] Fail | |
| 4.4.5 | Correction Saved for AI Learning | 1. Make correction<br>2. Check audit log | Correction recorded | [ ] Pass / [ ] Fail | |

### 4.5 Session Persistence

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 4.5.1 | Resume After Close | 1. Process 5 of 10 items<br>2. Close browser<br>3. Return to review | Resumes at item 6 | [ ] Pass / [ ] Fail | |
| 4.5.2 | Start Fresh Option | 1. Click "Start fresh" | Review restarts from beginning | [ ] Pass / [ ] Fail | |
| 4.5.3 | Session Expiry (24h) | 1. Start review<br>2. Wait 24h<br>3. Return | Fresh session started | [ ] Pass / [ ] Fail | |

---

## Epic 5: Weekly Review & Organization

### 5.1 Objectives Management

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 5.1.1 | Create Yearly Objective | 1. Navigate to Objectives<br>2. Create yearly objective | Objective saved | [ ] Pass / [ ] Fail | |
| 5.1.2 | Create Monthly Objective | 1. Create monthly under yearly | Linked to parent | [ ] Pass / [ ] Fail | |
| 5.1.3 | Create Weekly Objective | 1. Create weekly under monthly | Linked to parent | [ ] Pass / [ ] Fail | |
| 5.1.4 | Edit Objective | 1. Click edit on objective<br>2. Update title | Changes saved | [ ] Pass / [ ] Fail | |
| 5.1.5 | Mark Objective Complete | 1. Check completion checkbox | Marked complete with timestamp | [ ] Pass / [ ] Fail | |
| 5.1.6 | Carry Forward Objective | 1. Incomplete objective<br>2. Start new week | Option to carry forward shown | [ ] Pass / [ ] Fail | |
| 5.1.7 | Delete Objective | 1. Delete an objective | Removed from list | [ ] Pass / [ ] Fail | |

### 5.2 Weekly Review Wizard

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 5.2.1 | Start Weekly Review | 1. Click "Start Weekly Review" | Wizard opens at Step 1 | [ ] Pass / [ ] Fail | |
| 5.2.2 | Step 1: Objectives Review | 1. Review objectives<br>2. Confirm/update<br>3. Next | Moves to Step 2 | [ ] Pass / [ ] Fail | |
| 5.2.3 | Step 2: Priorities Selection | 1. Select priority projects<br>2. Next | Moves to Step 3 | [ ] Pass / [ ] Fail | |
| 5.2.4 | Step 3: Actions Review | 1. Review actions for priorities<br>2. Next | Moves to Step 4 | [ ] Pass / [ ] Fail | |
| 5.2.5 | Step 4: Inbox Processing | 1. Process all mandatory queues<br>2. Complete | Review marked complete | [ ] Pass / [ ] Fail | |
| 5.2.6 | Progress Sidebar | 1. During wizard | Shows current step highlighted | [ ] Pass / [ ] Fail | |
| 5.2.7 | Navigate Back | 1. On Step 3, click Step 1 | Returns to Step 1 | [ ] Pass / [ ] Fail | |
| 5.2.8 | Session Persistence | 1. Close mid-review<br>2. Return | Resumes at correct step | [ ] Pass / [ ] Fail | |

### 5.3 PARA Structure

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 5.3.1 | Create Project | 1. Click "New Project"<br>2. Fill form<br>3. Save | Project created | [ ] Pass / [ ] Fail | |
| 5.3.2 | Create Area | 1. Click "New Area"<br>2. Fill form<br>3. Save | Area created | [ ] Pass / [ ] Fail | |
| 5.3.3 | Create Resource | 1. Create resource in area | Resource linked to area | [ ] Pass / [ ] Fail | |
| 5.3.4 | Edit Project | 1. Edit project details | Changes saved | [ ] Pass / [ ] Fail | |
| 5.3.5 | Archive Project | 1. Mark project complete | Moved to Archive | [ ] Pass / [ ] Fail | |
| 5.3.6 | View Project Detail | 1. Click project | Shows actions, notes, files | [ ] Pass / [ ] Fail | |
| 5.3.7 | View Area Detail | 1. Click area | Shows linked projects | [ ] Pass / [ ] Fail | |
| 5.3.8 | PARA Navigation | 1. Check sidebar | Shows Projects, Areas, Resources, Archive | [ ] Pass / [ ] Fail | |
| 5.3.9 | Item Count Badges | 1. Add items to project | Badge updates | [ ] Pass / [ ] Fail | |
| 5.3.10 | Reorder Areas | 1. Drag area in sidebar | Order persisted | [ ] Pass / [ ] Fail | |

### 5.4 Inbox Processing in Weekly Review

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 5.4.1 | View Needs Review Queue | 1. In Step 4, view queue | Shows low-confidence items | [ ] Pass / [ ] Fail | |
| 5.4.2 | View Disagreements Queue | 1. Switch to Disagreements tab | Shows deferred items | [ ] Pass / [ ] Fail | |
| 5.4.3 | File Item to Project | 1. Click "File to..."<br>2. Select project | Item filed | [ ] Pass / [ ] Fail | |
| 5.4.4 | File Item to Area | 1. File to area | Item filed, note created | [ ] Pass / [ ] Fail | |
| 5.4.5 | Archive Item | 1. Click Archive on item | Item archived | [ ] Pass / [ ] Fail | |
| 5.4.6 | Bulk Archive All | 1. Click "Archive All" | All queue items archived | [ ] Pass / [ ] Fail | |
| 5.4.7 | Mandatory Queue Completion | 1. Empty Needs Review + Disagreements | "Complete" button enabled | [ ] Pass / [ ] Fail | |
| 5.4.8 | Blocked Completion | 1. Leave items in mandatory queue | "Complete" button disabled | [ ] Pass / [ ] Fail | |

### 5.5 Auto-Archive & Bankruptcy

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 5.5.1 | Auto-Archive Warning (2 days before) | 1. Have item >13 days old | Warning banner shown | [ ] Pass / [ ] Fail | |
| 5.5.2 | Auto-Archive Trigger (15 days) | 1. Item reaches 15 days | Auto-archived with tag | [ ] Pass / [ ] Fail | |
| 5.5.3 | Archived Item Tag | 1. Check auto-archived item | Tagged "Unprocessed - [date]" | [ ] Pass / [ ] Fail | |
| 5.5.4 | Declare Bankruptcy Button | 1. Click "Declare Bankruptcy" | Confirmation dialog opens | [ ] Pass / [ ] Fail | |
| 5.5.5 | Bankruptcy Confirmation | 1. Type "RESET" in dialog<br>2. Confirm | All items archived | [ ] Pass / [ ] Fail | |
| 5.5.6 | Bankruptcy Wrong Confirmation | 1. Type "reset" (lowercase) | Button remains disabled | [ ] Pass / [ ] Fail | |
| 5.5.7 | Archive Page View | 1. Navigate to Archive | Shows all archived items | [ ] Pass / [ ] Fail | |
| 5.5.8 | Restore from Archive | 1. Click Restore on item | Item returned to inbox | [ ] Pass / [ ] Fail | |
| 5.5.9 | Archive Filtering | 1. Filter by "Unprocessed" | Only unprocessed items shown | [ ] Pass / [ ] Fail | |
| 5.5.10 | Configure Auto-Archive Days | 1. In settings, change to 30 days | Setting saved | [ ] Pass / [ ] Fail | |
| 5.5.11 | Disable Auto-Archive | 1. Set to "Never" | Auto-archive disabled | [ ] Pass / [ ] Fail | |

---

## Epic 6: Calendar & Search

### 6.1 Calendar Integration (Read)

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 6.1.1 | View Calendar Week | 1. Navigate to Calendar<br>2. View week view | Shows Outlook events | [ ] Pass / [ ] Fail | |
| 6.1.2 | View Calendar Day | 1. Toggle to day view | Day schedule shown | [ ] Pass / [ ] Fail | |
| 6.1.3 | Event Details | 1. Click on event | Shows title, time, attendees | [ ] Pass / [ ] Fail | |
| 6.1.4 | Calendar Sync | 1. Click Refresh | Latest events fetched | [ ] Pass / [ ] Fail | |
| 6.1.5 | Navigate Weeks | 1. Click next/prev week | Calendar updates | [ ] Pass / [ ] Fail | |
| 6.1.6 | All-Day Events | 1. View day with all-day event | Displayed correctly | [ ] Pass / [ ] Fail | |

### 6.2 Calendar Summary in Weekly Review

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 6.2.1 | Summary Panel Visibility | 1. Start weekly review | Calendar summary in sidebar | [ ] Pass / [ ] Fail | |
| 6.2.2 | Total Meeting Hours | 1. Check summary | Correct meeting hour count | [ ] Pass / [ ] Fail | |
| 6.2.3 | Available Focus Hours | 1. Check summary | Shows 40 - meeting hours | [ ] Pass / [ ] Fail | |
| 6.2.4 | Busiest Day Indicator | 1. Check summary | Busiest day highlighted | [ ] Pass / [ ] Fail | |
| 6.2.5 | Overload Warning (>30h) | 1. Have heavy meeting week | Warning indicator shown | [ ] Pass / [ ] Fail | |
| 6.2.6 | Daily Breakdown Chart | 1. Check summary | Shows hours per day | [ ] Pass / [ ] Fail | |
| 6.2.7 | Back-to-Back Detection | 1. Have back-to-back meetings | Warning shown | [ ] Pass / [ ] Fail | |

### 6.3 Time Block Creation

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 6.3.1 | Schedule Button on Action | 1. View action item | "Schedule" button visible | [ ] Pass / [ ] Fail | |
| 6.3.2 | Open Time Block Modal | 1. Click Schedule | Modal opens with date/time picker | [ ] Pass / [ ] Fail | |
| 6.3.3 | Free Slot Suggestions | 1. Select date | Available time slots shown | [ ] Pass / [ ] Fail | |
| 6.3.4 | Duration Options | 1. View duration selector | Shows 30m, 1h, 2h, Custom | [ ] Pass / [ ] Fail | |
| 6.3.5 | Create Time Block | 1. Select slot + duration<br>2. Confirm | Event created in Outlook | [ ] Pass / [ ] Fail | |
| 6.3.6 | Action-Event Linking | 1. Create time block | Action shows scheduled date | [ ] Pass / [ ] Fail | |
| 6.3.7 | Conflict Warning | 1. Select conflicting time | Warning shown | [ ] Pass / [ ] Fail | |
| 6.3.8 | Delete Time Block | 1. On scheduled action, delete block | Event removed from calendar | [ ] Pass / [ ] Fail | |

### 6.4 Semantic Search

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 6.4.1 | Open Search (Cmd+K) | 1. Press Cmd/Ctrl+K | Search dialog opens | [ ] Pass / [ ] Fail | |
| 6.4.2 | Keyword Search | 1. Search "marketing meeting" | Relevant results returned | [ ] Pass / [ ] Fail | |
| 6.4.3 | Semantic Search | 1. Search "team planning discussions" | Results by meaning, not just keywords | [ ] Pass / [ ] Fail | |
| 6.4.4 | Search Performance (<1s) | 1. Time search query | Results in under 1 second | [ ] Pass / [ ] Fail | |
| 6.4.5 | Result Types | 1. Verify results | Includes notes, actions, emails, etc. | [ ] Pass / [ ] Fail | |
| 6.4.6 | Result Snippet | 1. View search result | Shows relevant content snippet | [ ] Pass / [ ] Fail | |
| 6.4.7 | Navigate to Result | 1. Click search result | Opens item detail | [ ] Pass / [ ] Fail | |
| 6.4.8 | New Content Indexing | 1. Capture new item<br>2. Search for it after 30s | Item found in search | [ ] Pass / [ ] Fail | |

### 6.5 Search Filters & History

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| 6.5.1 | Filter by Type | 1. Search with type filter "Notes" | Only notes returned | [ ] Pass / [ ] Fail | |
| 6.5.2 | Filter by Project | 1. Filter by specific project | Only project items returned | [ ] Pass / [ ] Fail | |
| 6.5.3 | Filter by Area | 1. Filter by area | Only area items returned | [ ] Pass / [ ] Fail | |
| 6.5.4 | Filter by Date Range | 1. Set date range | Only items in range | [ ] Pass / [ ] Fail | |
| 6.5.5 | Filter by Tags | 1. Select tag filters | Only tagged items returned | [ ] Pass / [ ] Fail | |
| 6.5.6 | Combined Filters | 1. Apply multiple filters | Filters combine correctly (AND) | [ ] Pass / [ ] Fail | |
| 6.5.7 | Recent Searches | 1. Perform searches<br>2. Open search again | Recent searches displayed | [ ] Pass / [ ] Fail | |
| 6.5.8 | Clear Search History | 1. Click "Clear history" | History cleared | [ ] Pass / [ ] Fail | |
| 6.5.9 | Save Search | 1. Click "Save search"<br>2. Enter name | Saved to favorites | [ ] Pass / [ ] Fail | |
| 6.5.10 | Load Saved Search | 1. Click saved search | Query and filters restored | [ ] Pass / [ ] Fail | |
| 6.5.11 | Delete Saved Search | 1. Delete saved search | Removed from list | [ ] Pass / [ ] Fail | |

---

## Non-Functional Tests

### Performance Tests

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| NFR-1 | Capture Performance | 1. Time capture to confirmation | < 2 seconds (NFR1) | [ ] Pass / [ ] Fail | |
| NFR-2 | Search Performance | 1. Time search query | < 1 second (NFR2) | [ ] Pass / [ ] Fail | |
| NFR-3 | AI Classification Speed | 1. Time item classification | < 5 seconds (NFR3) | [ ] Pass / [ ] Fail | |
| NFR-4 | Swipe Review Flow | 1. Process 20 items<br>2. Time session | < 5 minutes (NFR4) | [ ] Pass / [ ] Fail | |
| NFR-5 | Swipe Gesture Feedback | 1. Perform swipe gesture | < 100ms feedback (NFR6) | [ ] Pass / [ ] Fail | |

### Usability Tests

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| NFR-6 | Mobile Responsiveness | 1. Test on iPhone/Android | Fully functional (NFR5) | [ ] Pass / [ ] Fail | |
| NFR-7 | Zero Capture Decisions | 1. Capture various items | No organization decisions required (NFR7) | [ ] Pass / [ ] Fail | |

### Reliability Tests

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| NFR-8 | No Data Loss | 1. Capture items<br>2. Verify persistence | All items preserved (NFR8) | [ ] Pass / [ ] Fail | |
| NFR-9 | Audit Trail | 1. Check AI classification logs | Full history available (NFR9) | [ ] Pass / [ ] Fail | |
| NFR-10 | API Failure Recovery | 1. Simulate LLM failure<br>2. Check retry | Graceful retry (NFR10) | [ ] Pass / [ ] Fail | |

### Accessibility Tests

| ID | Test Case | Steps | Expected Result | Status | Notes |
|----|-----------|-------|-----------------|--------|-------|
| A11Y-1 | Keyboard Navigation | 1. Navigate using only keyboard | All features accessible | [ ] Pass / [ ] Fail | |
| A11Y-2 | Screen Reader | 1. Test with VoiceOver/NVDA | Content properly announced | [ ] Pass / [ ] Fail | |
| A11Y-3 | Color Contrast | 1. Check contrast ratios | WCAG AA compliance | [ ] Pass / [ ] Fail | |
| A11Y-4 | Button Alternatives to Swipe | 1. Disable touch<br>2. Use button controls | All swipe actions available as buttons | [ ] Pass / [ ] Fail | |

---

## Test Execution Notes

### Issues Found

| Issue # | Test ID | Description | Severity | Status |
|---------|---------|-------------|----------|--------|
| | | | | |
| | | | | |
| | | | | |

### Blocked Tests

| Test ID | Reason | Dependency |
|---------|--------|------------|
| | | |
| | | |

### Additional Observations

```
[Space for tester notes and observations]
```

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | | | |
| Developer | | | |
| Product Owner | | | |

---

## Appendix: Test Data Requirements

### Required Test Data

1. **User Account:** Microsoft account with Outlook/Calendar access
2. **Email Address:** Dedicated forwarding address configured
3. **Sample Content:**
   - 20+ inbox items of varying types
   - 5 projects with actions and notes
   - 3 areas with linked projects
   - Calendar with meetings for the week
4. **Image Files:** 3 test images (jpg, png, screenshot)
5. **Audio:** Microphone access for voice capture

### Environment Variables

```bash
# Required for testing
NEXTAUTH_URL=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
DATABASE_URL=
OPENAI_API_KEY=
N8N_WEBHOOK_URL=
CRON_SECRET=
```
