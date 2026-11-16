# Feature Specification: Chat-style Video Creation and Live Progress

**Feature Branch**: `003-chat-style-create`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "Rewrite the create-video screen as a chat-like composer (similar to Claude's chat box). One input for every kind of content, with the content type chosen from a popover select of 6 types. A popover select of 4 aspect ratios plus a seconds input validated 30–180. A voice button that opens a dialog to pick a voice with audible preview. A toggle for automatic vs. step-by-step approval. A detailed summary and a 'Bắt đầu tạo video' button that moves to a progress detail page, where every status shows a live log of what the system is doing."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Compose a video request in one chat-like box (Priority: P1)

A signed-in user opens "Create video" and sees a single, focused composer, like a chat input, instead of a long multi-card form. They type or paste their content into one input. Beside it, compact controls let them pick the content type (Idea, Written script, Article/web page, GitHub repository, Table, Audio/Video file — 6 types), the aspect ratio (4 options), and the length in seconds. Changing the content type changes what the single input accepts (text, link, or file attachment) without changing the layout.

**Why this priority**: This is the core of the redesign. Without a working composer nothing else is reachable, and it alone already lets a user submit a valid request.

**Independent Test**: Open the create screen, pick each of the 6 content types, provide valid content, choose an aspect ratio and a length, and confirm the request can be submitted with exactly the chosen values.

**Acceptance Scenarios**:

1. **Given** the create screen is open, **When** the user opens the content-type selector, **Then** exactly 6 types are listed, each with a short name and hint, and the current one is marked.
2. **Given** the type is "Idea", **When** the user switches to "Article/web page", **Then** the same input area now expects a link (with a link placeholder), and text typed for the previous type is preserved if the user switches back.
3. **Given** the type is "Table" or "Audio/Video file", **When** the user attaches a file in the composer, **Then** the file name and a remove control appear in the input area, and the composer accepts only the file kinds that type allows.
4. **Given** the user opens the aspect-ratio selector, **When** they look at the options, **Then** exactly 4 ratios are shown (9:16, 16:9, 1:1, 4:5), each with a small shape preview, and 9:16 is selected by default.
5. **Given** the length field, **When** the user enters a value below 30 or above 180, or a non-number, **Then** an inline message states the allowed range (30–180 seconds) and submission is blocked until corrected; values 30 and 180 are accepted.
6. **Given** the composer content is empty or too short/invalid for the chosen type, **When** the user tries to continue, **Then** a clear message says what is missing and nothing is submitted.

---

### User Story 2 - Choose and preview a narrator voice (Priority: P2)

The user presses a "Voice" button in the composer. A dialog opens listing the available voices (name, gender, region and quality tier as already known to the product). The user can play a short audio sample of any voice before choosing, select one, and close the dialog. The button then shows the chosen voice's name.

**Why this priority**: Voice is a key quality decision, and hearing it before committing avoids wasted videos; a default voice lets the flow work without it.

**Independent Test**: Open the dialog, play two different voices' previews, select one, close, and confirm the button label and the summary reflect the selection.

**Acceptance Scenarios**:

1. **Given** no change by the user, **When** the composer loads, **Then** the default voice is preselected and shown on the button.
2. **Given** the voice dialog is open, **When** the user presses play on a voice, **Then** a sample is heard; pressing play on another voice stops the first; a preview that cannot play shows a short, non-technical message without closing the dialog.
3. **Given** a voice is highlighted, **When** the user confirms it, **Then** the dialog closes and the button and summary show that voice; dismissing the dialog leaves the previous choice unchanged.
4. **Given** the dialog is open, **When** the user uses only the keyboard, **Then** they can move through voices, play a preview, select, and close.

---

### User Story 3 - Choose how the video is made: automatic or step-by-step (Priority: P2)

The user toggles between "Automatic" (the system goes from content to finished video without stopping) and "Step-by-step approval" (the system pauses after key stages so the user can review and approve before continuing). The toggle states what each mode means in one short line.

**Why this priority**: It controls whether the user stays in control or gets speed; a sensible default (automatic) keeps the flow working.

**Independent Test**: Flip the toggle, see the summary update, submit, and verify the created request carries the chosen mode.

**Acceptance Scenarios**:

1. **Given** the composer loads, **When** no change is made, **Then** the toggle reflects the product's current default mode (Automatic).
2. **Given** the toggle is switched, **When** the user reads the summary, **Then** it names the selected mode.
3. **Given** Step-by-step is selected, **When** the video is created, **Then** the progress page pauses at the script and storyboard approval points and leads the user to the existing review screen to approve or change; in Automatic it does not pause.

---

### User Story 4 - Review a detailed summary and start (Priority: P1)

Before starting, the user sees a detailed summary of everything they chose: content type and a short preview of the content (or file name/link), aspect ratio, length, voice, mode, whether the brand kit is applied (when they have one), and their remaining video quota and plan limits. A prominent **"Bắt đầu tạo video"** (English: "Start creating video") button submits the request. If quota or plan length limits would be exceeded, the button is disabled and the reason plus an upgrade path is shown.

**Why this priority**: The summary and start button are the single point of commitment; the flow is incomplete without them.

**Independent Test**: Fill the composer, check every value appears in the summary, press Start, and confirm the user lands on the progress page for the newly created video.

**Acceptance Scenarios**:

1. **Given** valid input, **When** the user looks at the summary, **Then** it shows content type, content preview, aspect, length, voice, mode and remaining quota, and updates immediately as any choice changes.
2. **Given** valid input and available quota, **When** the user presses Start, **Then** the button shows a busy state, the request is submitted once (repeated clicks do not create duplicates), and the user is taken to that video's progress page.
3. **Given** quota is exhausted or the length exceeds the plan limit, **When** the user views the summary, **Then** Start is disabled with an explanation and an upgrade link.
4. **Given** the submission fails (network or server error), **When** the user presses Start, **Then** an understandable error is shown, the composer keeps all entered values, and the user can retry.

---

### User Story 5 - Watch live progress with a log for every stage (Priority: P1)

After Start, the user lands on a progress page for that video. It shows the ordered production stages (script, style, storyboard, voice-over, quality check, render) with each stage's status (waiting, running, needs approval, done, failed). A live log streams, in plain language and in real time, what the system is doing in each stage (for example "Writing the script…", "Recording voice for scene 3 of 8…"). The log updates without refreshing the page, stays attached to its stage, and persists so reopening the page later shows earlier entries. When the video finishes, the page shows the result with preview and download; on failure it shows what went wrong in plain language and what the user can do.

**Why this priority**: The user explicitly wants to see what is happening; without it, long-running creation feels like a black box.

**Independent Test**: Start a video (mock providers are enough), watch stages change status and log lines appear live, reload the page mid-way and confirm earlier log lines are still there and live updates resume.

**Acceptance Scenarios**:

1. **Given** a video is in production, **When** the user is on the progress page, **Then** the current stage is highlighted and new log lines appear within about 2 seconds of the system doing the work, without a manual refresh.
2. **Given** several stages have run, **When** the user selects a stage, **Then** the log is filtered to that stage's entries; an "all" view shows everything in time order.
3. **Given** the log is growing, **When** the user scrolls up to read, **Then** auto-follow pauses and a "jump to latest" control appears; otherwise the view follows the newest line.
4. **Given** the user reloads or returns later, **When** the page opens, **Then** past log entries and statuses are restored and live updates continue if the video is still running.
5. **Given** Step-by-step mode, **When** a stage needs approval, **Then** the page clearly shows "waiting for you", with the output to review and Approve / change actions, and the log notes the pause.
6. **Given** a stage fails, **When** it fails, **Then** that stage is marked failed, the log shows a plain-language reason, and a retry or support action is offered; no technical names (engines, providers, tools) ever appear.
7. **Given** the video completes, **When** the last stage ends, **Then** the page shows the finished video with play and download actions.

---

### Edge Cases

- User switches content type after entering content: values entered per type are kept for the session; only the active type's value is submitted.
- Pasted text exceeds the type's maximum length: a visible counter and message appear; nothing is silently truncated.
- Link types (Article, GitHub): an invalid or unreachable link shows a clear message at submit time, not a technical error.
- Attaching a wrong file kind or an oversized file: rejected immediately, stating the accepted kinds and size.
- Length field left empty, decimal, negative, or very large: treated as invalid with the range message.
- Voice preview unavailable (audio blocked, network failure): the dialog still works for selection; a short message replaces the sample.
- Voice list empty or failing to load: the composer shows an error state and Start is disabled until a voice is available.
- User navigates away during creation: production continues on the server; returning to the progress page shows the current state and full log.
- Live connection drops: the page shows a "reconnecting" indicator, then catches up on missed log lines without duplicates.
- Two tabs open on the same video: both show consistent status and log; an approval made in one is reflected in the other.
- Very long log (thousands of lines): the page remains responsive; older lines can be loaded on demand.
- Narrow (mobile) screens: composer controls wrap or collapse into a compact row; dialogs and popovers fit the screen; the log is reachable below the stage list.
- Vietnamese and English: all new text exists in both languages; Vietnamese text with diacritics displays and wraps correctly in the input, selectors and log.

## Requirements _(mandatory)_

### Functional Requirements

**Composer (create screen)**

- **FR-001**: The create screen MUST present one chat-style composer containing a single input area for all content types, replacing the current multi-card form.
- **FR-002**: Users MUST be able to choose the content type from a popover selector offering exactly 6 types: Idea, Written script, Article/web page, GitHub repository, Table, Audio/Video file.
- **FR-003**: The single input area MUST adapt to the chosen type (free text for Idea and Written script, link for Article and GitHub, file attachment for Table and Audio/Video) while keeping the same position and size behavior.
- **FR-004**: The composer MUST validate content per type against the product's current limits and show clear messages, reusing existing error wording where it exists.
- **FR-005**: For Audio/Video file, the composer MUST offer the existing option to use the source audio as the voice-over.
- **FR-006**: Users MUST be able to choose the aspect ratio from a popover selector with exactly 4 options (9:16, 16:9, 1:1, 4:5), default 9:16, each showing a small shape preview.
- **FR-007**: Users MUST be able to enter the video length in whole seconds; values outside 30–180 or non-numeric MUST show an inline range message and block submission; 30 and 180 MUST be accepted.
- **FR-008**: The composer MUST show the selected voice on a button; pressing it MUST open a dialog listing available voices with their descriptive attributes (gender, region, quality tier); a default voice MUST be preselected.
- **FR-009**: The voice dialog MUST let users play an audio preview per voice, ensure only one preview plays at a time, allow selecting a voice, and allow closing without changing the choice.
- **FR-010**: The composer MUST provide a toggle between Automatic and Step-by-step approval, with a one-line explanation of each, defaulting to Automatic.
- **FR-011**: When the user's workspace has a brand kit, the composer MUST offer an option to apply it (on by default, as today); otherwise the option is not shown.
- **FR-012**: The composer MUST preserve all entered values when switching content type, opening/closing dialogs, and after a failed submission.

**Summary and start**

- **FR-013**: The screen MUST show a detailed summary that updates live: content type, content preview (or link/file name), aspect ratio, length, voice, mode, brand-kit use, and remaining videos / plan limits.
- **FR-014**: The summary MUST include a primary button labelled "Bắt đầu tạo video" (English: "Start creating video") that submits the request.
- **FR-015**: The Start button MUST be disabled, with a stated reason, when content is invalid, a required field is missing, or the plan's video count or length limit would be exceeded; an upgrade path MUST be offered for plan limits.
- **FR-016**: Submitting MUST create exactly one video request regardless of repeated clicks, show a busy state, and on success navigate to that video's progress page.
- **FR-017**: On submission failure the screen MUST show a plain-language error, keep all inputs, and allow retry.

**Progress page and live log**

- **FR-018**: The progress page MUST list every production stage in order with a status of waiting, running, needs approval, done, or failed.
- **FR-019**: The page MUST show a live activity log in which every stage produces human-readable entries describing what is being done (start, meaningful sub-steps with counts such as "scene 3 of 8", completion, and failure), each with a timestamp and its stage.
- **FR-020**: Log entries MUST appear on the page in real time (target within 2 seconds) without manual refresh.
- **FR-021**: Log entries and stage statuses MUST persist so that reloading or returning later restores the full history; live updates MUST resume if the video is still running.
- **FR-022**: Users MUST be able to view the log for all stages or filtered to one stage; the view MUST auto-follow the newest entry unless the user scrolls away, with a control to jump to the latest.
- **FR-023**: In Step-by-step mode the page MUST pause at the product's existing approval points (script review and storyboard review), mark that stage "needs approval", and lead the user to the existing review screen where they can approve or change the output; in Automatic mode it MUST NOT pause.
- **FR-024**: On failure (including "needs attention") the page MUST keep showing the progress view with the full log, give a plain-language reason for the failing stage, and offer a retry or support action.
- **FR-025**: On completion the page MUST show the finished video with play and download actions.
- **FR-026**: Log text, errors and statuses MUST never expose technical names (engine, provider, library or tool names, stack traces, internal IDs), consistent with the product's user-facing error policy.
- **FR-027**: If the live connection drops the page MUST indicate reconnecting and, once restored, catch up on missed entries without duplicates.
- **FR-028**: Only members of the video's workspace MUST be able to view its progress and log.

**Cross-cutting**

- **FR-029**: All new user-visible text MUST exist in Vietnamese and English, use theme tokens and shared components, and be accessible by keyboard and screen readers (selectors, dialog, toggle, and a log region that announces stage changes politely).
- **FR-030**: The composer and progress page MUST be usable on mobile widths (down to 360 px) with no horizontal scroll.

### Key Entities _(include if feature involves data)_

- **Video request**: The user's chosen content type and content, aspect ratio, length (30–180 s), voice, mode (automatic / step-by-step), brand-kit flag; owned by a workspace; becomes a video project when started.
- **Voice**: A selectable narrator with name, descriptive attributes (gender, region, quality tier), a default flag, and an audio sample for preview.
- **Production stage**: One step of making the video (script, style, storyboard, voice-over, quality check, render) with an order, a status, and an optional approval requirement.
- **Log entry**: A timestamped, plain-language message belonging to one video and one stage, with a severity (info, progress, warning, error), persisted in order.
- **Plan allowance**: The user's remaining videos and maximum video length, used by the summary to enable or block Start.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A returning user can go from opening "Create video" to pressing Start with default settings (idea typed) in under 30 seconds, and in under 90 seconds when changing every option.
- **SC-002**: At least 90% of first-time testers complete a valid request on their first attempt without help.
- **SC-003**: 100% of invalid inputs (length outside 30–180, empty or malformed content, wrong file kind) are blocked with a message that names the fix; 0 invalid requests reach the server.
- **SC-004**: Users hear a voice preview within 2 seconds of pressing play in at least 95% of attempts.
- **SC-005**: During production, new log lines appear on screen within 2 seconds of the system performing the step in at least 95% of cases, and every stage shows at least one start and one end entry.
- **SC-006**: After a page reload or a dropped connection, 100% of earlier log entries and current stage statuses are shown again, with no duplicated or missing lines.
- **SC-007**: In usability testing, at least 90% of users can correctly say what the system is doing right now and which stage is next by looking at the progress page, without asking.
- **SC-008**: 0 occurrences of technical names (engines, providers, tools, stack traces) in any visible log line, status or error, verified across success, failure and retry runs.
- **SC-009**: The create screen and progress page have no keyboard-only accessibility blockers and remain fully usable at 360 px width.
- **SC-010**: Support contacts of the kind "I don't know what is happening with my video" decrease by at least 50% after release.

## Assumptions

- The 6 content types, 4 aspect ratios, length range 30–180 s, voice catalog, automatic/review modes, brand-kit option and quota rules already exist in the product; this feature changes how they are presented and adds voice preview and the live log, not their underlying meaning.
- "Popover shadcn/ui select items" is read as a compact popover-style selector from the existing UI kit; the exact component choice is a plan-level decision.
- The existing production stages and review/approval points are reused; they only need to emit user-readable log messages and be viewable live.
- Voice samples are short clips; playing them must not consume the user's video quota.
- The progress page replaces or evolves the current project detail page for in-progress videos; finished videos keep their existing detail and editing capabilities.
- Log entries are kept for as long as the video exists; no separate retention policy is introduced.
- Batch creation, editing a finished video, billing flows and the marketing site are out of scope.
- Users are authenticated and belong to a workspace; permissions follow the existing workspace model.
