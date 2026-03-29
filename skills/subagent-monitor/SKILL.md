---
name: subagent-monitor
description: Automatically monitor long-running subagent tasks and notify the user of progress or completion. Use when spawning subagents that may take longer than 1-2 minutes, or when the user asks to check task progress periodically. Triggers on phrases like "check progress", "monitor this task", "let me know when done", or when spawning long-running subagents.
---

# Subagent Monitor

Automatically set up periodic progress checks for long-running subagent tasks.

## When to Use

- After spawning a subagent that is expected to take more than 2 minutes
- When the user asks "완료되면 알려줘", "체크해줘", "확인해"
- When multiple subagents are running in parallel

## Workflow

### 1. Determine Check Interval

- **1 minute** (`*/1 * * * *`): Tasks expected to finish within 5 minutes (e.g., simple analysis)
- **5 minutes** (`*/5 * * * *`): Tasks expected to take 5-30 minutes (e.g., multi-repo analysis, large code reviews)
- **15 minutes** (`*/15 * * * *`): Very long tasks (e.g., full security audits, large migrations)

Default: **5 minutes** when unsure.

### 2. Register a Cron Monitor

Use `openclaw cron add` to create a progress-check cron job:

```
openclaw cron add \
  --name "monitor-<brief-task-name>" \
  --cron "<interval>" \
  --tz "Asia/Seoul" \
  --announce \
  --message "<monitoring instruction>"
```

The monitoring message should instruct the cron session to:
1. Check subagent status via `subagents --action=list`
2. If tasks are still running, report brief progress (e.g., "아직 진행 중입니다")
3. If all tasks are done, report completion summary
4. **Disable itself** after confirming completion: `openclaw cron disable --name "monitor-<name>"`

### 3. Include Task Context

In the cron message, include:
- What tasks were spawned (brief description)
- Expected number of tasks
- What to report when done
- The cron name to disable on completion

### Example Cron Message

```
서브에이전트 상태를 확인해:
- GitHub 보안 분석 (3개 에이전트)
- 아직 진행 중이면 "아직 진행 중입니다"라고 알려줘
- 모두 완료되면 결과를 요약해서 알려줘
- 완료 확인 후: openclaw cron disable --name "monitor-github-audit"
```

### 4. Cleanup

The cron job self-disables after detecting completion. Remove it later with:
```
openclaw cron rm --name "monitor-<name>"
```

## Rules

- Never create duplicate monitors for the same task
- Always use `--announce` so the user gets notified
- Always include self-disable instruction in the message
- Use descriptive names: `monitor-<what>-<date>` pattern
- Keep monitoring messages concise — the cron session has limited context
