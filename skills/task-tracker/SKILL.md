---
name: task-tracker
description: >
  서브에이전트/긴 작업의 완료 감지를 상태 파일 기반 추적으로 보장.
  작업 시작 시 등록, 완료 시 해제, 하트비트에서 timeout 감지.
  Push 알림 누락을 방지하는 이중 확인(Push + Poll) 시스템.
  트리거: "task-tracker", "작업 추적", "task track"
allowed-tools: Read, Write, Edit, Exec
---

# Task Tracker (작업 완료 추적)

긴 작업(서브에이전트 등)이 완료되어도 알림이 누락되는 문제를 해결합니다.
Push(자동 알림) + Poll(하트비트 확인) 이중 체크로 완료 감지를 보장합니다.

## 핵심 원칙

1. **상태 파일이 진실의 원천** — 메모리가 아닌 파일에 기록
2. **등록 = 추적 시작** — 서브에이전트 실행 전 반드시 등록
3. **완료 = 등록 해제** — 완료 이벤트 수신 시 즉시 해제
4. **Timeout = 자동 알림** — 예상 시간 초과 시 하트비트에서 감지
5. **멱등성** — 여러 번 확인해도 안전

---

## 상태 파일

### 경로
```
workspace/tasks/pending.json
```

### 형식
```json
{
  "tasks": [
    {
      "id": "session-key 또는 고유 ID",
      "type": "subagent|exec|cron",
      "task": "작업 설명 (한 줄)",
      "started_at": "2026-03-30T00:31:00+09:00",
      "timeout_minutes": 10,
      "status": "running|completed|failed|timeout"
    }
  ],
  "completed": [
    {
      "id": "이전-작업-ID",
      "task": "완료된 작업 설명",
      "started_at": "...",
      "completed_at": "2026-03-30T00:35:00+09:00",
      "duration_seconds": 240
    }
  ]
}
```

---

## Phase 1: 작업 등록 (spawn 전)

서브에이전트를 실행하기 전에 반드시 상태 파일에 등록:

```javascript
// 서브에이전트 실행 전
const taskId = sessions_spawn(task="...", ...)

// 상태 파일에 등록
registerTask({
  id: taskId,
  type: "subagent",
  task: "작업 설명",
  timeout_minutes: estimate // 5, 10, 15, 30
})
```

**Timeout 가이드:**
| 작업 유형 | 권장 timeout |
|----------|-------------|
| 코드 수정 (서브에이전트) | 10분 |
| Docker 빌드 + 테스트 | 30분 |
| 단순 검색/분석 | 5분 |
| Cron 작업 | 해당 작업 예상 시간 |

### registerTask 구현

```bash
# pending.json 업데이트 (Node.js one-liner)
node -e "
const fs = require('fs');
const path = 'tasks/pending.json';
const data = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {tasks:[], completed:[]};
data.tasks.push({
  id: process.argv[1],
  type: process.argv[2],
  task: process.argv[3],
  started_at: new Date().toISOString(),
  timeout_minutes: parseInt(process.argv[4]),
  status: 'running'
});
fs.writeFileSync(path, JSON.stringify(data, null, 2));
" '$TASK_ID' 'subagent' 'PR#34 Docker 테스트' '30'
```

---

## Phase 2: 완료 처리 (이벤트 수신 시)

서브에이전트 완료 이벤트를 수신하면:

1. **pending에서 제거** (status를 completed로 변경)
2. **completed에 추가**
3. **사용자에게 결과 전달** (일반적인 응답 흐름)
4. **누락이 의심되면 pending 확인** — 이미 완료 처리됐는지 double-check

```bash
# 완료 처리
node -e "
const fs = require('fs');
const path = 'tasks/pending.json';
const data = JSON.parse(fs.readFileSync(path));
const idx = data.tasks.findIndex(t => t.id === process.argv[1]);
if (idx !== -1) {
  const task = data.tasks.splice(idx, 1)[0];
  task.status = 'completed';
  task.completed_at = new Date().toISOString();
  task.duration_seconds = Math.round((Date.now() - new Date(task.started_at)) / 1000);
  data.completed.push(task);
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}
" '$TASK_ID'
```

---

## Phase 3: 하트비트에서 완료/Timeout 체크

HEARTBEAT.md에 아래를 추가하여 매 하트비트마다 자동 확인:

```markdown
# HEARTBEAT.md
- [ ] pending 작업 상태 확인 (task-tracker)
```

### 하트비트 체크 로직

```
하트비트 트리거
    ↓
pending.json 읽기
    ↓
  ├─ 빈 배열 → 아무 작업 없음 (HEARTBEAT_OK)
  │
  └─ 작업이 있으면:
      ↓
    각 작업에 대해:
      ├─ timeout 초과? → 사용자에게 알림 + status를 timeout으로 변경
      ├─ sessions_list로 실제 상태 확인:
      │   ├─ 이미 완료됐지만 미처리 → 완료 처리 + 사용자에게 결과 전달
      │   └─ 여전히 실행 중 → 조용히 대기
      └─ process(action=poll)로 exec 작업 상태 확인 (exec 타인 경우)
```

### 하트비트 체크 스크립트

```bash
node -e "
const fs = require('fs');
const path = 'tasks/pending.json';
if (!fs.existsSync(path)) { console.log('NO_TASKS'); process.exit(0); }
const data = JSON.parse(fs.readFileSync(path));
const now = Date.now();
const alerts = [];
data.tasks.forEach(task => {
  const started = new Date(task.started_at).getTime();
  const elapsed = (now - started) / 60000; // minutes
  if (elapsed > task.timeout_minutes) {
    alerts.push({task, elapsed_minutes: Math.round(elapsed), type: 'TIMEOUT'});
  }
});
if (alerts.length > 0) {
  console.log('ALERTS:' + JSON.stringify(alerts));
} else {
  console.log('RUNNING:' + data.tasks.length);
}
"
```

**출력 처리:**
- `NO_TASKS` → 아무 작업 없음
- `ALERTS:...` → timeout된 작업 → 사용자에게 알림
- `RUNNING:N` → N개 실행 중 → 조용히 대기

---

## Phase 4: 정리

completed 목록은 주기적으로 정리 (하루 단위):

```bash
# 오래된 completed 항목 정리 (7일 이상)
node -e "
const fs = require('fs');
const path = 'tasks/pending.json';
if (!fs.existsSync(path)) process.exit(0);
const data = JSON.parse(fs.readFileSync(path));
const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
data.completed = data.completed.filter(t => new Date(t.completed_at).getTime() > cutoff);
fs.writeFileSync(path, JSON.stringify(data, null, 2));
"
```

---

## 전체 흐름

```
사용자 요청
    ↓
registerTask (pending.json에 등록)
    ↓
sessions_spawn (서브에이전트 실행)
    ↓
    ├─ Push 이벤트 수신 (정상)
    │   → completeTask → 사용자에게 결과 전달
    │
    ├─ Push 누락 (문제 상황)
    │   → 하트비트에서 pending.json 확인
    │   → sessions_list로 실제 상태 확인
    │   → 이미 완료됨 → completeTask → 사용자에게 결과 전달
    │
    └─ Timeout (예상 시간 초과)
        → 사용자에게 "작업이 {N}분 경과, 상태 확인 중" 알림
        → sessions_list로 실제 상태 확인
```

---

## 메모리 기록

완료 후 `memory/YYYY-MM-DD.md`에 기록:
```markdown
### 작업 추적 상태
- 진행 중: N개
- 완료: N개
- Timeout: N개 (있는 경우)
```
