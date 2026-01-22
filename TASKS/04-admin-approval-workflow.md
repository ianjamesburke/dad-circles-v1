# Admin Approval Workflow - Version 1 Spec

**Status**: Ready for Implementation
**Goal**: Create a manual approval workflow for matching groups before sending introduction emails
**Target**: End-to-end testing with 5-10 fake user profiles

---

## Overview

Transform the admin matching workflow from automatic group creation and immediate email sending to a manual approval process where admins can review, approve, or reject groups before introduction emails are sent. This enables quality control during early rollout and provides a foundation for future automation.

---

## Current State Analysis

### What Works Today
- Admin dashboard has three tabs: Sessions, Leads, Matching
- Matching tab shows stats (total/matched/unmatched users)
- Two matching buttons exist: "Run Test Match" and "Run Production Match"
- Groups are created with `test_mode: boolean` flag
- Groups have status field: 'pending', 'active', 'inactive'
- Email service (`emailService.ts`) gracefully handles missing Resend API key by logging simulated emails
- Group introduction email template exists and is well-designed

### Current Problems
1. **Test Mode Confusion**: Separate test users vs. production users creates artificial separation and unrealistic testing
2. **No Approval UI**: Groups are created but there's no way to review them before sending emails
3. **Immediate Email Sending**: Emails are triggered automatically or via scheduled job, no manual gate
4. **Limited Group Visibility**: Can see groups in list but can't inspect members or validate quality
5. **Can't Delete Bad Groups**: No way to reject poorly matched groups before they go live

---

## Proposed Changes

### 1. Eliminate Test Mode Concept

**Change**: Remove the artificial separation between test and production users. All matching runs create groups with status='pending' by default.

**Rationale**:
- Testing should use the same user data pool as production to be realistic
- The `status` field already provides the needed control (pending vs. active)
- Simplifies the mental model and reduces code complexity

**Implementation**:
- Remove "Run Test Match" vs. "Run Production Match" distinction
- Replace with single button: "Run Matching Algorithm (Dry Run)"
- All groups created start with `status: 'pending'`
- Keep `test_mode` field in database for backward compatibility but always set to `false`
- Update matching algorithm to never auto-send emails, only create pending groups

**Database Impact**:
- No schema changes needed (status field already exists)
- Existing test_mode field can remain but won't be used going forward
- Future groups all have test_mode=false

---

### 2. Add Group Approval Interface

**Change**: Create a dedicated approval workflow section in the Matching tab showing all pending groups with rich detail.

**What Needs to Be Built**:

#### A. Pending Groups Section (New)
Replace the current "Formed Groups" section with two sections:
1. **Pending Groups (Needs Approval)** - Groups with status='pending'
2. **Active Groups** - Groups with status='active' (already sent emails)

#### B. Pending Group Card Design
Each pending group should display:
- Group name and location
- Life stage
- Created timestamp
- Member count
- Preview of member details:
  - Session ID (truncated)
  - Email (if available)
  - Child age/due date
  - Location (verify all same)
- Two prominent actions:
  - **Green "Approve & Send Emails" button** (primary action)
  - **Red "Delete Group" button** (secondary, destructive)

#### C. Expanded Group Detail View
Clicking a pending group opens an expanded view showing:
- Full group metadata
- Complete member list with all profile details
- Age gap analysis (show youngest and oldest child in group)
- Location verification (confirm all members in same city/state)
- Email preview (show what will be sent)
- Action buttons (approve, delete)

---

### 3. Implement Approval Actions

#### A. Approve & Send Emails Flow

**Frontend Flow**:
1. User clicks "Approve & Send Emails" on a pending group
2. Confirmation dialog: "Send introduction emails to [X] members?"
3. Loading state while processing
4. Call new function: `database.approveAndEmailGroup(groupId)`
5. Success message: "Emails sent to [X] members"
6. Group moves from Pending to Active section

**Backend Implementation** (new callable function or database method):
```
approveAndEmailGroup(groupId):
  1. Fetch group data from Firestore
  2. Validate group is in 'pending' status
  3. Fetch all member profiles
  4. Build member details array (email, name, child info)
  5. Call EmailService.sendGroupIntroductionEmail()
  6. Update group in Firestore:
     - status: 'active'
     - emailed_member_ids: [emails that succeeded]
     - introduction_email_sent_at: timestamp
  7. Return success/failure result
```

**Email Handling**:
- Use existing `EmailService.sendGroupIntroductionEmail()` method
- Already gracefully handles missing Resend API key (logs simulated emails)
- In development without API key: logs "📧 SIMULATED GROUP EMAIL" with full details
- In production with API key: sends real emails via Resend
- Returns list of successfully emailed members

#### B. Delete Group Flow

**Frontend Flow**:
1. User clicks "Delete Group" on a pending group
2. Confirmation dialog: "Delete [Group Name]? This will unassign all members so they can be rematched."
3. Loading state while processing
4. Call new function: `database.deleteGroup(groupId)`
5. Success message: "Group deleted and members unmarked"
6. Group removed from list
7. Stats refresh automatically

**Backend Implementation** (new database method):
```
deleteGroup(groupId):
  1. Fetch group data
  2. Validate group is in 'pending' status (can't delete active groups)
  3. Loop through member_ids:
     - Update each user profile: group_id = null, matched_at = null
  4. Delete group document from Firestore
  5. Return success
```

**Safety**:
- Only allow deleting groups with status='pending'
- Active groups that already sent emails cannot be deleted (would confuse users)
- Show warning if trying to delete active group

---

### 4. Improve Matching Button & Result Display

**Change**: Make the matching workflow clearer and show immediate results.

#### A. Matching Button Changes
- Remove: "Run Test Match" and "Run Production Match" buttons
- Remove: "Seed Test Data" button (move to separate dev tools section if needed)
- Keep: "Clear Test Data" button but rename to "Clear All Test Data" and move to bottom

**New Primary Button**:
- Label: "Run Matching Algorithm"
- Color: Blue (primary action)
- Icon: Lightning bolt or gear
- Description text below: "Creates new groups with status='pending' for review"

#### B. Matching Result Display
After running matching algorithm:
1. Show result summary banner:
   - "✅ Created [X] new groups with [Y] members"
   - "[Z] users remain unmatched"
2. Auto-scroll to Pending Groups section
3. Highlight newly created groups (e.g., subtle animation or border color)

#### C. Statistics Panel Enhancement
Keep existing stats cards but add:
- "Pending Groups" count badge
- Visual indicator when pending groups need attention (orange badge)

---

### 5. Remove Scheduled Job Dependency (For Now)

**Change**: Phase 1 is entirely manual. Remove or disable any automatic email sending.

**What to Change**:
- Keep scheduled functions in code but ensure they don't auto-send emails
- Scheduled matching job should only create pending groups, not send emails
- Group email processing job should be disabled or only process groups that are already approved
- Document that automation will come in Phase 2

---

### 6. End-to-End Testing Workflow

**What Admin Should Be Able to Do**:

1. **Create Test Users** (manually via chat interface):
   - Go through onboarding flow 5-10 times
   - Use different session IDs
   - Enter varied data: different cities, life stages, due dates
   - Complete onboarding so users become matching_eligible

2. **Run Matching**:
   - Go to Admin Dashboard → Matching tab
   - Click "Run Matching Algorithm"
   - See result banner: "Created 1 new group with 4 members, 2 users remain unmatched"

3. **Review Pending Groups**:
   - See new group in "Pending Groups" section
   - Click to expand and inspect members
   - Verify:
     - All members in same city/state
     - All members in same life stage
     - Age gap makes sense
     - All have emails

4. **Approve & Send**:
   - Click "Approve & Send Emails" button
   - Confirm action
   - If Resend not configured: See console logs showing simulated emails
   - If Resend configured: See actual emails sent to all member addresses
   - Group moves to "Active Groups" section

5. **Handle Bad Groups**:
   - If a group looks wrong (wrong location, bad age gap, etc.)
   - Click "Delete Group"
   - Confirm deletion
   - Members are unmarked (group_id cleared)
   - Can run matching again to re-form groups

---

## Implementation Checklist

### Phase 1: Data Layer
- [ ] Add `database.approveAndEmailGroup(groupId)` method
- [ ] Add `database.deleteGroup(groupId)` method
- [ ] Update matching algorithm to never auto-send emails (all groups start pending)
- [ ] Add `database.getPendingGroups()` and `database.getActiveGroups()` helper methods

### Phase 2: Admin UI - Matching Controls
- [ ] Replace "Run Test Match" / "Run Production Match" with single "Run Matching Algorithm" button
- [ ] Update button styling and add descriptive text
- [ ] Show result banner after matching completes
- [ ] Add loading states during matching

### Phase 3: Admin UI - Pending Groups Section
- [ ] Create "Pending Groups (Needs Approval)" section above "Active Groups"
- [ ] Design pending group card with all needed info
- [ ] Add "Approve & Send Emails" button to each card
- [ ] Add "Delete Group" button to each card
- [ ] Implement confirmation dialogs for both actions
- [ ] Show loading states during approval/deletion

### Phase 4: Admin UI - Group Detail View
- [ ] Make pending group cards expandable (click to see detail)
- [ ] Show full member list with complete profile data
- [ ] Display age gap analysis
- [ ] Show email preview
- [ ] Duplicate action buttons in expanded view

### Phase 5: Admin UI - Active Groups Section
- [ ] Separate active groups into their own section
- [ ] Show "Active Groups" with sent email timestamp
- [ ] Display emailed member count
- [ ] Make expandable to see member details (read-only)
- [ ] No action buttons for active groups

### Phase 6: Stats & Polish
- [ ] Add "Pending Groups" stat to stats panel
- [ ] Add visual indicator badge when pending groups exist
- [ ] Auto-refresh stats after approve/delete actions
- [ ] Improve error messaging for failed operations
- [ ] Add success toasts/notifications

### Phase 7: Testing & Documentation
- [ ] Test full workflow with 5-10 fake profiles
- [ ] Verify email logging works without Resend API key
- [ ] Test approval, deletion, and re-matching flows
- [ ] Document workflow in AGENTS.md
- [ ] Update README with admin workflow instructions

---

## User Experience Flow

### Happy Path
```
Admin logs in
  → Goes to Matching tab
  → Sees "15 unmatched users" in stats
  → Clicks "Run Matching Algorithm"
  → Sees banner: "Created 2 new groups with 8 members, 7 remain unmatched"
  → Sees 2 groups in "Pending Groups" section
  → Clicks first group to expand
  → Reviews members (all look good)
  → Clicks "Approve & Send Emails"
  → Confirms action
  → Sees success message: "Emails sent to 4 members"
  → Group moves to "Active Groups" section
  → Stats update: "7 matched, 8 unmatched, 0 pending"
  → Repeats for second group
```

### Rejection Path
```
Admin reviews pending group
  → Notices age gap is too wide (6mo old and 15mo old in Infant group)
  → Clicks "Delete Group"
  → Confirms: "Delete and unmark members for rematching"
  → Group disappears from list
  → 4 users return to unmatched pool
  → Clicks "Run Matching Algorithm" again
  → New groups formed with better matches
```

---

## Email Integration Details

### How Emails Work in Phase 1

**Without Resend API Key** (Development):
- `EmailService.sendGroupIntroductionEmail()` detects no API key
- Logs detailed message: "📧 SIMULATED GROUP EMAIL" with recipient, group name, etc.
- Returns `success: true` and list of all member emails
- Group marked as "active" and introduction_email_sent_at timestamp set
- Admin can verify in console logs that emails would have been sent

**With Resend API Key** (Production):
- `EmailService.sendGroupIntroductionEmail()` sends real emails via Resend API
- Each member receives actual group introduction email
- Returns list of successfully delivered emails
- Failed emails are logged but don't block approval
- Group marked as "active" with actual send timestamp

**Email Content**:
- Uses existing template in `EmailService.generateGroupIntroductionEmail()`
- Subject: "Meet Your DadCircles Group: [Group Name]"
- Displays all group members with names and child info
- Clear call-to-action: "Reply All to Say Hi!"
- Instructions for first meetup coordination

---

## Database Schema (No Changes Needed)

Existing schema already supports this workflow:

```typescript
Group {
  group_id: string
  name: string
  created_at: number
  location: { city, state_code }
  member_ids: string[]
  member_emails: string[]
  status: 'pending' | 'active' | 'inactive'  // ← We use this
  emailed_member_ids: string[]
  introduction_email_sent_at?: number
  test_mode: boolean  // ← Keep but always false
  life_stage: LifeStage
}
```

Key fields for approval workflow:
- `status='pending'`: Needs approval, no emails sent
- `status='active'`: Approved and emails sent
- `emailed_member_ids`: List of members who got emails
- `introduction_email_sent_at`: When approved

---

## Success Criteria

**Version 1 is complete when**:

1. ✅ Admin can run matching algorithm with single button
2. ✅ All new groups start with status='pending'
3. ✅ Admin can see list of pending groups with member details
4. ✅ Admin can approve individual groups (triggers email sending)
5. ✅ Admin can delete bad groups (unmarks members)
6. ✅ Email service works in both dev (simulated) and prod (real) modes
7. ✅ Active groups are separated from pending groups
8. ✅ Stats accurately reflect pending/active/unmatched counts
9. ✅ End-to-end test succeeds: Create 5-10 users → Match → Review → Approve → Emails logged/sent

---

## Future Enhancements (Not in V1)

- **Phase 2**: Semi-automated approval with rules (auto-approve groups meeting criteria)
- **Phase 3**: Scheduled daily matching job with email notifications to admin
- **Phase 4**: Edit group members before approval (move users between groups)
- **Phase 5**: Batch approval (approve all pending groups at once)
- **Phase 6**: Analytics (group formation rates, email response rates, meetup tracking)
- **Phase 7**: WhatsApp integration replaces reply-all emails

---

## Technical Notes

### Frontend Architecture
- All changes contained within `AdminDashboard.tsx` and `database.ts`
- No new pages or routes needed
- Use existing Firebase Client SDK patterns
- Maintain consistent styling with current dashboard design

### Backend Architecture
- Add two new methods to `database.ts` interface
- Consider creating callable functions for approval/deletion if auth is needed later
- Email sending uses existing `EmailService` in cloud functions
- No changes to matching algorithm logic, just remove auto-email triggers

### Error Handling
- Handle missing Resend API key gracefully (already done)
- Show user-friendly errors for failed approvals
- Validate group status before approval/deletion
- Catch and log all Firestore errors
- Don't let email failures block group activation

### Performance
- Pending groups query should be fast (indexed by status)
- Batch read member profiles when expanding group details
- Use optimistic UI updates where possible
- Debounce stats refresh after actions

---

## Open Questions (To Resolve During Implementation)

1. Should we add a "Notes" field to groups for admin comments?
2. Should deleted groups be archived or permanently removed?
3. Should we track who approved each group (admin user ID)?
4. Should there be an "undo" for accidental approvals?
5. Should we show a preview of the email before approving?

**Recommendation**: Keep V1 simple, add these in later iterations based on actual usage.

---

## Summary

This spec transforms the admin matching workflow from automatic to manual approval-based. The key insight is that the `status` field already gives us the control we need - we just need to build the UI around it. By eliminating the test/production split and making everything go through pending approval, we create a realistic testing environment and a solid foundation for future automation.

The implementation is primarily frontend work (AdminDashboard UI improvements) with a few new database methods. The email service already handles both development and production modes gracefully. End result: Admin can confidently review and approve groups before introduction emails go out, ensuring quality during early rollout.
