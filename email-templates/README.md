# Email Templates

This directory contains the HTML templates used for transactional emails sent via Resend.

## Templates

- **welcome-completed.html**: Sent when a user completes the onboarding flow.
- **welcome-abandoned.html**: Sent to users who dropped off during onboarding.
- **resume-session.html**: Magic link email for resuming sessions.
- **signup-other.html**: Sent when a user signs up on behalf of someone else.
- **followup-3day.html**: Nurture email sent 3 days after sign-up.
- **group-intro.html**: Sent when a group is approved and active.

## Formatting Guidelines

When editing templates, follow these best practices for maximum email client compatibility (Outlook, Gmail, etc.):

1.  **Table-Based Layout**: Use standard HTML tables (`<table>`, `<tr>`, `<td>`) for layout structure. Avoid `div` based layouts or Flexbox/Grid as they often break in legacy email clients.
2.  **Centering**:
    *   Use a full-width wrapper: `<center class="wrapper">`
    *   Align tables: `<table align="center">`
    *   Align cells: `<td align="center">`
3.  **Inline CSS**: All styling should be inline (e.g., `<p style="margin:0; color: #333;">`). While a `<style>` block in the head is good for responsive queries, critical styles must be inlined.
4.  **No React/JS**: Remove all React artifacts like `<!--$-->` comments, `className`, or `onClick` handlers. Use standard `class` and `style`.
5.  **Typography**: Use system font stacks (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...`) for fast loading.
6.  **Variables**: Use the mustache syntax `{{{variable}}}` (triple braces prevent HTML escaping).

## Updating Templates on Resend

We use a programmatic approach to keep our local HTML files in sync with Resend's template system.

### The "Nuke and Pave" Strategy

To ensure absolute consistency and avoid drift, we treat our local HTML files as the source of truth for *pushing* updates, but always pull the latest version before making changes.

### Pulling Updates from Resend (IMPORTANT)

Before making any changes to a template, you **MUST** pull the latest version from the Resend UI. This prevents accidentally overwriting changes made directly in the Resend editor.

To pull the latest version of a template (e.g., `welcome-completed`), run the following command:

```bash
npx tsx scripts/pull_resend_template.ts welcome-completed
```
*(The script automatically finds the template by name and saves it to the corresponding `.html` file.)*

To refresh all local templates at once, run the script without any arguments:
```bash
npx tsx scripts/pull_resend_template.ts
```

### Pushing Updates to Resend ("Nuke and Pave")

After pulling and editing a template locally, you can push it back to Resend. Our strategy for pushing is a full replacement to ensure consistency:

1.  **Verify**: Check if the template exists by name.
2.  **Delete**: Remove the existing template from Resend.
3.  **Wait**: Pause briefly (1s) to respect API rate limits.
4.  **Create**: Upload the fresh HTML content as a new template with the same name.
5.  **Publish**: Set the template to active.
6.  **Verify**: Fetch the new template to confirm it was created successfully.

### Full Workflow

To update a template (e.g., `welcome-completed.html`), you must first pull the latest version, then edit the local file, and finally push the changes back to Resend.

**Example:**

1.  **Pull the latest version from Resend:**
    ```bash
    npx tsx scripts/pull_resend_template.ts welcome-completed
    ```
2.  **Edit the local file:** `email-templates/welcome-completed.html`.
3.  **Push the changes back to Resend:**
    ```bash
    npx tsx scripts/update_resend_template.ts welcome-completed.html
    ```
    *(The script automatically infers the template name from the file name)*

### Maintenance Notes

> [!IMPORTANT]
> **Keep the Update Script in Sync**
>
> If you add a **new template** or add **new variables** to an existing template, you **MUST** update the `TEMPLATE_CONFIG` object in `scripts/update_resend_template.ts`.
>
> The script relies on this configuration to know which variables to register with Resend. If a variable is used in HTML but not declared in the script, Resend may not render it correctly.

### Template Configuration

The script contains a configuration map `TEMPLATE_CONFIG` defining subjects and variables for each template.

| Template | Subject | Variables |
| :--- | :--- | :--- |
| `welcome-completed` | Welcome to DadCircles! | `location` |
| `welcome-abandoned` | Complete your DadCircles profile | `location`, `magic_link` |
| `resume-session` | Resume your DadCircles session | `magic_link` |
| `group-intro` | You've been matched! | `name` |
| `followup-3day` | Checking in from DadCircles | `location` |
| `signup-other` | Welcome to DadCircles | `location` |
