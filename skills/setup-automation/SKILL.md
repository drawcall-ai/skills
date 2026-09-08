---
name: setup-automation
description: "Set up or modify event-driven and scheduled automations that use Dagu to launch T3 Code threads with a task prompt, including Linear issue-to-GitHub-PR workflows. Use for this external automation stack, not app reminders."
---

# Dagu and T3 Code automations

An automation connects a trigger, a Dagu workflow, and a T3 Code thread prompt. Establish the intended trigger, repository or workspace, and completion condition from the request. For issue-to-PR work, completion means a verified draft PR or an explicit no-change outcome.

## Discover the deployment

Reuse an existing deployment and its authentication when available. Consult operator-provided documentation and inspect non-secret version, help, and service-status output to identify the service user, workspace, Dagu workflow directory and queue, T3 environment endpoint, and tunnel routes. Confirm which receiver and repository mappings already exist before adding another. Do not assume hostnames, installation paths, account IDs, or credential locations from another deployment.

Keep private deployment notes outside the published skill. Discovery does not require opening credential files or dumping service environments. Use the deployment's supported authentication mechanism without printing tokens. Installing software, changing services or tunnel routes, and sending a live test event must fit the user's authorized scope; a request to package documentation does not authorize those operations.

## Connect the services

For a new deployment, install compatible versions of Node.js, the chosen coding provider CLI, T3 Code, Dagu, GitHub CLI, and cloudflared from official distributions. Check installed versions and command help before using the commands below. Verify native terminal support; T3's node-pty dependency may require compiler tooling on a fresh Linux host. Run coding sessions as an unprivileged service user with a persistent home directory.

For Codex, run `codex login --device-auth` as that service user and have the user complete the generated code in their local browser. Verify `codex login status` and a small real model request. Run `t3 connect --headless` for T3's browser authorization and return the authorization code to the same waiting terminal. Use `t3 service install` when installing its background service; persistent Linux user services need a reachable systemd user manager and lingering to survive logout. A saved Connect login alone does not start a server. Verify remote visibility from the T3 web app and live server reachability.

Dagu runs its scheduler and UI together with `dagu start-all`. Bind service origins to loopback and use Cloudflare Tunnel hostnames where external access is needed. Protect management access with Dagu authentication or an appropriate access policy. Keep provider webhook routes separately authenticated with the provider's signature protocol so an interactive browser login does not block deliveries. Check real HTTPS and certificate coverage: a certificate for `*.example.com` does not cover `dagu.internal.example.com`.

## Receive and route events

Prefer the installed receiver when extending the same provider. For [Linear webhooks](https://linear.app/developers/webhooks), verify the `Linear-Signature` HMAC-SHA256 over the original request bytes with a constant-time comparison, then validate the signed JSON's `webhookTimestamp` for freshness and check the workspace. Persist accepted events before returning HTTP 200 and acknowledge within Linear's five-second deadline. Keep a durable pending state so a temporary Dagu outage cannot silently discard an accepted event.

Define the trigger precisely. For a label-based Linear workflow, trigger on issue creation with the label or an update that adds it; unrelated edits to an already labeled issue must not launch another session. Resolve the repository through a configured label-ID allowlist, requiring exactly one mapping. Surface unknown or ambiguous targets. Fetch current issue context, comments, parent, and related issues before starting work. Pass validated event IDs or context-file paths to scripts; never interpolate issue text into shell commands.

Deduplicate authenticated events in durable storage and atomically claim each logical run before enqueueing. Do not rely solely on an unsigned delivery header as the deduplication key. Persist the event-to-run mapping, branch, worktree, T3 thread and command IDs, and eventual PR URL. Concurrent deliveries and process restarts must reuse that state. Define whether a later qualifying event resumes an existing issue run or intentionally starts a new one; a delivery retry must never imply new work.

## Run the Dagu workflow

Enqueue a parameterized workflow with `dagu enqueue --run-id <stable-id> <dag> -- EVENT_ID=<id>`, substituting values from trusted run state. For scheduled work, use a Dagu schedule with an explicit timezone and a stable identity for each scheduled occurrence. Use the same preparation, dispatch, and verification stages for either trigger.

Validate YAML with `dagu validate <dag>` against the installed version. Consult the [CLI reference](https://docs.dagu.sh/getting-started/cli) and [queue configuration](https://docs.dagu.sh/server-admin/queues): entrypoint names derive from filenames, shell steps use `run`, and a named global queue controls concurrency across workflows. Keep the workflow active through outcome verification if the queue is intended to limit concurrent coding sessions; a dispatch-only step would release its slot while the thread is still working.

Prepare an isolated worktree and unique branch per logical run, then write the context file and prompt. On retry, reuse the recorded worktree and branch. A T3 thread is not a filesystem sandbox; use the intended service account and permissions. Keep context files, dispatch records, and logs out of the target repository's commits.

## Launch T3 over HTTP

T3 exposes authenticated `POST /api/orchestration/dispatch`; launching work does not require a WebSocket client. Issue an environment bearer token with `t3 auth session issue --ttl <duration> --label <label> --token-only` as the service user when authorized. Deliver it directly to protected secret storage without logging stdout or shell tracing. Plan renewal before expiration. A T3 Connect OAuth token is not an environment bearer token.

Read the deployed version's [HTTP contract](https://github.com/pingdotgg/t3code/blob/main/packages/contracts/src/environmentHttp.ts) and [command schemas](https://github.com/pingdotgg/t3code/blob/main/packages/contracts/src/orchestration.ts) before changing payloads; the linked main branch may differ from the installed release. Use `Authorization: Bearer <environment-token>` and `Content-Type: application/json`. The request body is the command object itself, not a wrapper or array.

Create or reuse a project for the configured repository, select an installed and authenticated provider and available model, then send these commands in order:

1. `thread.create`: include a stable `commandId`, `threadId`, `projectId`, title, model selection, runtime mode, branch, worktree path, and creation timestamp, plus any fields required by the installed schema. Confirm creation before starting a turn.
2. `thread.turn.start`: use a distinct stable `commandId` and the same `threadId`; include a user message with `messageId`, `role: "user"`, prompt text and attachments (an empty array when absent), runtime and interaction modes, and creation timestamp.

Persist both exact command objects before sending them. Retry an ambiguous network failure with the same command ID and unchanged body, including timestamps and message IDs, so T3's command receipts can prevent duplicate work. Apply bounded retries to transient failures; stop and report authentication, schema, or permission errors instead of retrying indefinitely or generating fresh IDs.

Use [the issue-to-PR prompt](references/issue-to-pr.md) for coding work, substituting trusted routing and context placeholders. Match runtime permissions to the user's authorization and verify GitHub access for branch pushes and draft PR creation. If the selected mode requires an approval that unattended execution cannot provide, surface the blocker rather than silently broadening permissions.

## Verify the outcome

An accepted dispatch only confirms submission. Poll authenticated `GET /api/orchestration/threads/<threadId>` and inspect the requested turn's completion, provider errors, and pending approvals. Bound execution time and record the Dagu run ID and T3 thread ID in logs without tokens or full request headers. A timeout is an unresolved run, not permission to launch a replacement; reconcile the existing thread before retrying.

For issue-to-PR work, query GitHub for the configured repository and exact run branch, including existing closed PRs before considering creation. Verify the returned PR's URL, head branch and commit, base branch, open state, and draft status. Check the diff and validation results; a completed turn without a PR must be reported as a failure, blocker, or explicit no-change outcome. Do not create an empty PR to satisfy the completion check.

When implementing or changing a receiver or launcher, test invalid signatures, stale requests, duplicate and concurrent deliveries, routing errors, ordinary non-triggering updates, Dagu outages, and ambiguous dispatch responses. An authorized live test should follow one real provider event through Dagu and the T3 thread to the resulting artifact. A retry should resume or report existing work without creating another branch, thread, or PR. Report the artifact URL, validation results, how to trigger another run, and any unverified boundary. Keep credentials, private account identifiers, host details, and credential locations out of public reports and PRs.
