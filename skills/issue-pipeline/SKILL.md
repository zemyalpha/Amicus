---
name: issue-pipeline
description: >
  GitHub 이슈를 순차적으로 자동 처리하는 파이프라인.
  PR 병합 후 다음 이슈 자동 시작, 큰 이슈 자동 하위 분할, 이슈 큐 관리.
  pr-review-cycle 및 task-tracker와 연동.
  트리거: "issue-pipeline", "이슈 파이프라인", "다음 이슈", "이슈 큐", "issue queue"
allowed-tools: Read, Write, Edit, Exec, sessions_spawn
---

# Issue Pipeline (이슈 자동 처리 파이프라인)

GitHub 이슈를 순차적으로 자동 처리합니다. PR 병합 후 다음 이슈를 자동 시작하고, 큰 이슈는 하위 이슈로 분할합니다.

## 핵심 원칙

1. **순차 처리** — 한 이슈씩 처리, 병렬 작업 지양
2. **자동 진행** — PR 병합 시 다음 이슈 자동 시작
3. **자동 분할** — 작업량이 큰 이슈는 하위 이슈로 나눔
4. **큐 관리** — 다음에 처리할 이슈를 미리 등록
5. **task-tracker 연동** — 모든 작업 상태 추적

---

## 이슈 큐 파일

### 경로
```
workspace/tasks/issue-queue.json
```

### 형식
```json
{
  "repo": "AmicusLab/Amicus",
  "current": {
    "issue_number": 50,
    "title": "데몬 SSE 스트리밍 채팅 API",
    "status": "in_progress|review|merged|done",
    "pr_number": 53,
    "subagent_session": "agent:main:subagent:...",
    "started_at": "2026-03-30T00:50:00+09:00"
  },
  "queue": [
    {
      "issue_number": 51,
      "title": "대시보드 채팅 UI 컴포넌트",
      "priority": "high"
    },
    {
      "issue_number": 52,
      "title": "채팅 히스토리 관리",
      "priority": "medium"
    }
  ],
  "completed": [
    {
      "issue_number": 50,
      "title": "데몬 SSE 스트리밍 채팅 API",
      "pr_number": 53,
      "merged_at": "2026-03-30T01:30:00+09:00"
    }
  ],
  "blocked": []
}
```

---

## Phase 1: 이슈 큐 초기화

처음 파이프라인을 시작할 때:

```bash
# 레포의 오픈 이슈 목록 조회 (라벨별 정렬)
gh issue list --repo {REPO} --state open --json number,title,labels \
  --jq '.[] | {number, title, priority: (.labels | map(.name) | join(","))}'
```

**우선순위 정렬 기준:**

---

## Phase 1.5: 새 이슈 등록 및 자동 재정렬

새 이슈가 등록되면 **자동으로 큐를 재정렬**합니다.

### 정렬 규칙 (우선순위 순)

1. **high-priority 라벨** → 최우선
2. **Phase 순서** — Phase 1 > Phase 2 > ...
3. **같은 Phase 내에서는** 이슈 번호 순서 (오래된 것 우선)

### 재정렬 로직

```bash
# 새 이슈 등록 후 재정렬
node -e "
const fs = require('fs');
const path = 'tasks/issue-queue.json';
const data = JSON.parse(fs.readFileSync(path));

// 정렬 함수
const priorityOrder = { 'high-priority': 0, 'high': 0, 'medium': 1, 'low': 2 };
const sortIssues = (a, b) => {
  // 1. high-priority 우선
  if (a.priority === 'high' && b.priority !== 'high') return -1;
  if (b.priority === 'high' && a.priority !== 'high') return 1;
  // 2. Phase 순서
  if (a.phase !== b.phase) return (a.phase || 99) - (b.phase || 99);
  // 3. 이슈 번호 순서
  return a.issue_number - b.issue_number;
};

data.queue.sort(sortIssues);
fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Queue reordered');
"
```

### 새 이슈 등록 트리거

- GitHub에서 새 이슈 생성 감지 (webhook 또는 폴링)
- 사용자가 "이슈 #N 추가"라고 요청
- 하트비트에서 새 이슈 확인

### 등록 후 처리

```
새 이슈 #N 등록
    ↓
issue-queue.json의 queue에 추가
    ↓
자동 재정렬 실행
    ↓
ISSUE-PIPELINE.md 동기화
    ↓
사용자에게 알림: "이슈 #N이 큐에 추가되었습니다 (현재 순서: N위)"
```

---

**기본 우선순위 정렬 기준:**
1. `priority:critical` / `priority:high` 라벨
2. phase 순서 (`phase-1` > `phase-2` > ...)
3. 이슈 번호 순서 (오래된 것 우선)

### 큐 등록

```bash
node -e "
const fs = require('fs');
const path = 'tasks/issue-queue.json';
const data = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {
  repo: '', current: null, queue: [], completed: [], blocked: []
};
data.repo = process.argv[1];
// process.argv[2+] = issue numbers
process.argv.slice(2).forEach(n => {
  data.queue.push({issue_number: parseInt(n), priority: 'medium'});
});
fs.writeFileSync(path, JSON.stringify(data, null, 2));
" 'AmicusLab/Amicus' '51' '52' '53'
```

---

## Phase 2: 이슈 자동 분할 ( 큰 이슈 감지)

이슈를 처리하기 전에 작업량을 평가합니다.

### 분할 기준

이슈가 다음 조건 중 하나를 만족하면 **분할 대상**:
- 아키텍처 변경 포함
- 3개 이상의 독립적인 파일 그룹 수정
- "과도 수정" 기준 해당 (pre-dev-review 참고)
- 본문에 여러 독립적인 작업이 나열됨

### 분할 프로세스

```
이슈 #N 분석
    ↓
  작업량 평가
    ├─ 작음 (단일 PR) → 그대로 처리
    └─ 큼 (다중 PR) → 하위 이슈 생성
        ↓
      gh issue create --repo {REPO} \
        --title "[#N-{i}] {하위 작업명}" \
        --body "Parent: #{N}\n\n## 작업 내용\n..." \
        --label "phase-{N}"
        ↓
      원래 이슈에 코멘트: "하위 이슈로 분할: #{N1}, #{N2}, #{N3}"
      큐에 하위 이슈 등록, 원래 이슈는 큐에서 제거
```

### 분할 프롬프트 (서브에이전트용)

이슈 본문과 관련 코드를 분석하여 분할 계획을 수립:

```
이슈 #{N}: {title}

본문:
{body}

이 이슈를 독립적인 하위 이슈들로 분할하세요. 각 하위 이슈는:
1. 하나의 PR로 완료 가능해야 함
2. 선행 이슈가 완료되어야만 시작 가능 (순차 의존)
3. 명확한 완료 기준이 있어야 함

출력 형식:
- 하위 이슈 1: {이름} — {수정 파일 목록}
- 하위 이슈 2: {이름} — {수정 파일 목록}
...
```

---

## Phase 3: 이슈 처리 시작

### 3.1 큐에서 다음 이슈 선택

```bash
node -e "
const fs = require('fs');
const path = 'tasks/issue-queue.json';
const data = JSON.parse(fs.readFileSync(path));

// 현재 작업 중인 것이 없으면 큐에서 다음 것 선택
if (!data.current && data.queue.length > 0) {
  const next = data.queue.shift();
  data.current = {
    issue_number: next.issue_number,
    title: next.title,
    status: 'in_progress',
    started_at: new Date().toISOString()
  };
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log('NEXT:' + next.issue_number + ':' + next.title);
} else if (data.current) {
  console.log('BUSY:' + data.current.issue_number + ':' + data.current.status);
} else {
  console.log('EMPTY');
}
"
```

### 3.2 이슈 분석 → pre-dev-review → 개발

```
큐에서 이슈 선택
    ↓
이슈 내용 분석 (본문, 라벨, 댓글)
    ↓
  ├─ 분할 필요? → Phase 2 (하위 이슈 생성) → 큐 업데이트 → 다시 3.1
  └─ 그대로 처리 → pre-dev-review 적용
      ↓
    서브에이전트에 개발 위임
    ↓
    PR 생성
    ↓
    ⚠️ [필수] PR 생성 후 즉시 실행:
    1. task-tracker에 등록 (pending.json)
    2. issue-queue.json 업데이트 (status='review')
    3. pr-review-cycle 서브에이전트 실행
```

### 3.3 PR 생성 후 필수 작업 (자동화)

⚠️ **PR 생성 후 반드시 다음 3단계를 자동으로 실행해야 합니다:**

```bash
# 1. task-tracker에 등록
cat > /workspace/tasks/pending.json << 'EOF'
{
  "tasks": [{
    "id": "pr-review-{PR_NUMBER}",
    "type": "pr-review",
    "task": "PR #{PR_NUMBER} 리뷰 사이클 ({REPO})",
    "prNumber": {PR_NUMBER},
    "repo": "{REPO}",
    "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "expectedMinutes": 30
  }]
}
EOF

# 2. issue-queue.json 상태 업데이트
node -e "
const fs = require('fs');
const path = '/workspace/tasks/issue-queue.json';
const data = JSON.parse(fs.readFileSync(path));
if (data.current) {
  data.current.pr_number = {PR_NUMBER};
  data.current.status = 'review';
}
fs.writeFileSync(path, JSON.stringify(data, null, 2));
"

# 3. Gemini 리뷰 요청
gh pr comment {PR_NUMBER} --repo {REPO} --body "/gemini review"
```

### 3.4 pr-review-cycle 자동 시작

⚠️ **PR 생성 후 pr-review-cycle 서브에이전트를 즉시 실행:**

```
sessions_spawn(
  attachAs={mountPath: "/workspace"},
  task="
  ## ⚠️ 0. 공통 규칙 읽기 (필수)
  read /workspace/RULES.md
  주요 규칙: 한글 작성, 검증 결과 등록 필수, 폴링 최대 10회

  ## 1. 작업 내용
  PR #{PR_NUMBER} 리뷰 사이클 자동화...
  ",
  label="PR #{PR_NUMBER} 리뷰 사이클",
  runTimeoutSeconds=1800  # 30분
)
```

**실행 시점:** PR 생성 커밋 직후, 사용자에게 "PR 생성 완료" 알림 전

### 3.5 서브에이전트 완료 후 재리뷰 검증 (메인 에이전트 필수)

⚠️ **서브에이전트 완료 후 메인 에이전트가 반드시 재리뷰 결과를 확인해야 합니다:**

```bash
# 1. 재리뷰 결과 확인 (필수)
gh pr view {PR_NUMBER} --repo {REPO} --json latestReviews,reviewDecision

# 2. 새 리뷰가 있는지 확인
# latestReviews[].submittedAt이 /gemini review 요청 시간 이후인지 체크

# 3. 새 리뷰 있으면 → Phase 3 (수정 루프)# 4. 새 리뷰 없음 + CI 성공 → "병합 가능 상태" 알림
```

**검증 체크리스트:**
- [ ] `/gemini review` 재요청 완료
- [ ] 재리뷰 결과 확인 (새 리뷰 도착 여부)
- [ ] 새 리뷰 있음 → 수정 루프 시작
- [ ] 새 리뷰 없음 + CI 성공 → "병합 가능 상태" 알림

---

## Phase 4: PR 병합 후 자동 진행

### 4.1 병합 감지

PR 리뷰 완료 → 머지 후:

```
PR #{N} 머지 완료
    ↓
issue-queue.json 업데이트:
  current.status = 'merged'
  current.merged_at = now
  current → completed 배열로 이동
  current = null
    ↓
task-tracker에서 작업 해제
    ↓
큐 확인:
  ├─ 큐에 다음 이슈 있음 → Phase 3 (자동 시작)
  └─ 큐 비어있음 → 사용자에게 "파이프라인 완료" 알림
```

### 4.2 자동 시작 알림

다음 이슈를 자동 시작할 때 사용자에게 알림:

```
✅ #{N} 머지 완료!

다음 이슈 자동 시작:
→ #{M} {title}
- 작업량: {small|medium|large}
- 예상 PR: {1|여러 개}

하위 이슈 분할이 필요하면 분할 후 알려드릴게요.
```

---

## Phase 5: 파이프라인 상태 관리

### 상태 조회

```bash
# 현재 파이프라인 상태
node -e "
const fs = require('fs');
const path = 'tasks/issue-queue.json';
if (!fs.existsSync(path)) { console.log('NO_PIPELINE'); process.exit(0); }
const data = JSON.parse(fs.readFileSync(path));
console.log('=== Issue Pipeline ===');
console.log('Repo:', data.repo);
console.log('Current:', data.current ? '#' + data.current.issue_number + ' (' + data.current.status + ')' : 'None');
console.log('Queue:', data.queue.length, 'issues');
console.log('Completed:', data.completed.length, 'issues');
data.queue.forEach(q => console.log('  - #' + q.issue_number + ':', q.title));
"
```

### 큐 수동 조작

```bash
# 이슈를 큐에 추가
# → issue-queue.json의 queue 배열에 {issue_number, title, priority} 추가

# 큐에서 이슈 제거
# → queue에서 해당 issue_number 제거

# 긴급 이슈를 큐 맨 앞으로
# → queue에서 꺼내서 unshift

# 파이프라인 일시 중지
# → current.status를 'paused'로 변경
```

---

## pr-review-cycle 연동

⚠️ **PR 생성 직후 자동으로 실행되어야 합니다. 수동으로 하트비트에서 처리하지 마세요.**

### PR 생성 완료 → 자동 실행 체크리스트

```
PR 생성 완료
    ↓
[필수] 즉시 실행:
    ├─ 1. task-tracker에 등록 (pending.json)
    │      id: "pr-review-{PR_NUMBER}"
    │      type: "pr-review"
    │
    ├─ 2. issue-queue.json 업데이트
    │      current.pr_number = {PR_NUMBER}
    │      current.status = 'review'
    │
    ├─ 3. Gemini 리뷰 요청
    │      gh pr comment {PR_NUMBER} --body "/gemini review"
    │
    └─ 4. pr-review-cycle 서브에이전트 실행
           sessions_spawn(attachAs={mountPath: "/workspace"}, task="...")
```

### pr-review-cycle 서브에이전트 실행 예시

```
sessions_spawn(
  label: "PR #{PR_NUMBER} 리뷰 사이클",
  attachAs: { mountPath: "/workspace" },
  task: "
    PR #{PR_NUMBER}의 리뷰 사이클을 자동으로 처리해.

    ## 0. workspace 마운트 확인
    ls /workspace/tasks/pending.json  # 접근 가능해야 함

    ## 1. PR 상태 확인
    gh pr view {PR_NUMBER} --repo {REPO} --json state,reviewDecision,statusCheckRollup

    ## 2. 3분마다 폴링 (최대 30분)
    ## 3. 리뷰 피드백 시 수정 + 검증
    ## 4. 답글 작성
    ## 5. 완료 시 pending.json 업데이트

    완료 후: /workspace/tasks/pending.json에서 해당 task 제거
  "
)
```

---

## 하트비트 연동

HEARTBEAT.md에 다음이 있으면 자동 체크 (이미 task-tracker에 포함됨):

```markdown
- [ ] pending 작업 상태 확인 (task-tracker)
```

추가로 파이프라인 상태도 체크:

```markdown
- [ ] pending 작업 상태 확인 (task-tracker)
- [ ] 이슈 파이프라인 진행 상태 확인 (issue-pipeline)
```

하트비트에서 issue-pipeline 체크:
```
issue-queue.json 읽기
    ├─ current == null && queue.length > 0 → ⚠️ 큐에 이슈가 있는데 처리 안 됨 → 자동 시작
    ├─ current.status == 'review' → pr-review-cycle이 처리 중 → 조용히 대기
    ├─ current.status == 'in_progress' → 서브에이전트 실행 중 → task-tracker로 확인
    └─ current == null && queue.length == 0 → 파이프라인 유휴 상태
```

---

## 전체 흐름

```
이슈 큐 초기화
    ↓
┌─────────────────────────┐
│ 큐에서 다음 이슈 선택     │ ←──────────┐
└─────────┬───────────────┘             │
          ↓                             │
   이슈 분석 & 분할 판단                │
     ├─ 분할 → 하위 이슈 생성 → 큐 업데이트 ─┘
     └─ 그대로 처리                    │
          ↓                            │
   pre-dev-review → 서브에이전트 개발   │
          ↓                            │
   PR 생성                             │
          ↓                            │
   ⚠️ [필수] PR 생성 후 즉시:          │
     1. pending.json 등록              │
     2. issue-queue.json 상태='review' │
     3. Gemini 리뷰 요청               │
     4. pr-review-cycle 서브에이전트 실행
          ↓                            │
   pr-review-cycle (3분 폴링)          │
     ├─ 수정 필요 → 수정 → 재리뷰       │
     └─ 승인 + CI 통과                  │
          ↓                            │
   PR 병합                             │
          ↓                            │
   완료 처리 → ────────────────────────┘
          ↓
   큐 비어있음 → 사용자에게 완료 알림
```

---

## ⚠️ 흔한 실수 (방지)

1. **PR 생성 후 아무것도 안 함** → pending.json 등록 안 됨 → 하트비트 감지 실패
2. **issue-queue.json 상태를 'pr_created'로 설정** → 'review'여야 함
3. **pr-review-cycle을 수동으로 나중에 실행** → PR 생성 즉시 자동 실행해야 함
4. **Gemini 리뷰 요청 누락** → `/gemini review` 댓글 필수
