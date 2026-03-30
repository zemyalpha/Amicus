---
name: pr-review-cycle
description: >
  PR 생성 후 리뷰-수정-병합 준비 사이클 자동화. Gemini + Copilot 리뷰 요청,
  리뷰 피드백 분석, 수정 + 검증, 재리뷰, 병합 가능 상태까지 반복.
  모든 프로젝트에 범용 적용.
  트리거: "pr-review", "PR 리뷰 사이클", "리뷰 처리", "PR 머지"
allowed-tools: Read, Write, Edit, Exec, sessions_spawn, web_search
---

# PR Review Cycle (리뷰-수정-병합 준비 사이클)

PR이 등록된 후부터 **병합 가능 상태**까지의 전체 프로세스를 관리합니다.

⚠️ **머지는 사용자가 직접 합니다.** 에이전트는 병합 가능 상태까지만 처리합니다.

## 핵심 원칙

1. **모든 댓글/코멘트는 한글로 작성** — 인라인 코멘트 답글, PR 댓글, 커밋 메시지 본문
2. **PR 생성 전 검증 필수** — 검증 결과 없으면 PR 생성 금지
3. **리뷰는 반드시 요청** — PR 생성 즉시 Gemini(`/gemini review`) + Copilot
4. **리뷰는 꼼꼼히 분석** — 모든 피드백을 시맨틱하게 분류 (보안/성능/스타일/기능)
5. **리뷰 처리 후 검증 결과 등록 필수** — 없으면 재리뷰 요청 금지
6. **⚠️ 검증 결과 댓글은 메인 에이전트가 직접 등록** — 서브에이전트에 맡기지 않음 (매번 까먹음)
7. **자동 반복** — 수정 필요시 재커밋 → 재리뷰 → 반복
8. **task-tracker 등록 필수** — 리뷰 사이클 시작 시 등록, 완료 시 해제 (하트비트 백업)

## Task Tracker 등록/해제

⚠️ **리뷰 사이클 시작 시 반드시 task-tracker에 등록:**
```json
// workspace/tasks/pending.json에 추가
{
  "id": "pr-review-{PR_NUMBER}",
  "type": "pr-review",
  "task": "PR #{PR_NUMBER} 리뷰 사이클 ({REPO})",
  "prNumber": {PR_NUMBER},
  "repo": "{REPO}",
  "startedAt": "{ISO_timestamp}",
  "expectedMinutes": 30,
  "lastCheckAt": "{ISO_timestamp}",
  "lastCommentCount": 0,
  "round": 1
}
```

⚠️ **리뷰 사이클 종료 시 반드시 해제** (병합 완료, 또는 사용자가 취소)
- `pending.json`에서 해당 task 제거

---

## Phase 0: PR 생성 전 검증 (필수)

⚠️ **검증 결과 없이 PR을 생성하면 안 됩니다.**

PR 생성 전 반드시 완료해야 할 것:

1. **빌드 성공**
2. **테스트 통과**
3. **검증 결과 문서화** (PR description에 포함)

**UI 컴포넌트 추가 필수:**
4. **스크린샷 또는 동작 GIF** (Before/After)

```bash
# PR 생성 전 검증 체크리스트
echo "## PR 생성 전 검증

### 필수
- [ ] 빌드: bun run build 성공
- [ ] 테스트: bun test 전부 통과

### UI 변경 시 추가
- [ ] 스크린샷: Before/After 촬영
- [ ] 동작 확인: 실제로 동작하는지 수동 테스트

→ 모두 완료되면 PR 생성 가능"

# 검증 실패 시
# ❌ PR 생성 불가 — 검증을 먼저 완료하세요.
```

**PR description에 포함할 검증 결과:**
```markdown
## 🧪 검증 결과

### 빌드 & 테스트
- **빌드**: ✅ 성공
- **테스트**: N/N 통과

### UI 변경 (해당 시)
| Before | After |
|--------|-------|
| ![before]({URL}) | ![after]({URL}) |

### 동작 확인
- [ ] 기능 A 정상 동작
- [ ] 기능 B 정상 동작
```

---

## Phase 1: 리뷰 요청

PR 생성 직후 또는 새 커밋 푸시 후:

```bash
# Gemini 리뷰 요청 (반드시 이 형식)
gh pr comment {PR_NUMBER} --repo {REPO} --body "/gemini review"

# Copilot은 자동 리뷰 설정되어 있으면 생략 가능
# 미설정 시: PR에 코딩 에이전트 자동 리뷰 설정 확인
```

**확인사항:**
- [ ] PR이 open 상태인지
- [ ] CI가 실행 중/완료인지
- [ ] 이전 리뷰 댓글이 있는지 (같은 PR에 재리뷰)
- [ ] **task-tracker에 등록** (pr-{PR_NUMBER}, type: "pr-review", timeout: 60분)
- [ ] **issue-queue.json에 current.pr_number 업데이트** (파이프라인 사용 시)

---

## Phase 2: 리뷰 대기 & 분석

### 2.0 폴링 규칙

- **주기**: **3분마다** `gh pr view`로 상태 확인
- **대상**: 리뷰 도착 여부, CI 상태, 새 코멘트
- **종료 조건**: 리뷰 승인(APPROVED) + CI 성공, 또는 수정 요청(CHANGES_REQUESTED)
- **타임아웃**: 30분 초과 시 사용자에게 "리뷰/CI 상태 확인 필요" 알림
- **최대 폴링**: 10회 (30분), 이후 사용자에게 보고

```
리뷰 요청 → 3분 간격 폴링 시작
    ↓
  3분마다 gh pr view 확인
    ├─ 새 리뷰 도착 → 2.1 분석 시작
    ├─ CI 완료 → 상태 체크
    ├─ CI 실행 중 → 계속 대기
    └─ 변화 없음 → 다음 3분 대기
    ↓
  30분 초과 → 사용자에게 알림
```

### 2.1 리뷰 도착 감지

```bash
# PR 상태 확인
gh pr view {PR_NUMBER} --repo {REPO} \
  --json state,mergeStateStatus,reviewDecision,statusCheckRollup,latestReviews,comments
```

**상태 판단:**
| reviewDecision | 의미 | 다음 단계 |
|---------------|------|---------|
| APPROVED | 승인 완료 | Phase 4 (머지 가능 여부 확인) |
| CHANGES_REQUESTED | 수정 요청 | Phase 3 (수정) |
| REVIEW_REQUIRED | 리뷰 대기 | 대기 후 재확인 |
| COMMENTED | 코멘트만 | 피드백 내용에 따라 분기 |

### 2.2 리뷰 피드백 분류

모든 리뷰 코멘트를 수집하고 분류:

```bash
# PR 리뷰 코멘트 수집 (인라인 코멘트)
gh api repos/{REPO}/pulls/{PR_NUMBER}/comments

# PR-level 리뷰 수집
gh api repos/{REPO}/pulls/{PR_NUMBER}/reviews
```

⚠️ **중요: 두 API는 다른 것을 반환합니다**
- `comments` → 인라인 라인별 코멘트 (여기에 답글을 달아야 함)
- `reviews` → PR-level 리뷰 (전체 평가)

### 2.2.1 답글 여부 검증 (필수)

**모든 인라인 코멘트에 답글이 달렸는지 반드시 확인합니다.**

```bash
# 인라인 코멘트와 답글 상태 확인
gh api repos/{REPO}/pulls/{PR_NUMBER}/comments --jq '
  .[] | 
  select(.in_reply_to_id == null) |  # 원본 코멘트만
  {
    id: .id,
    user: .user.login,
    body_preview: .body[:50],
    has_reply: false  # 아래에서 체크
  }
'

# 각 코멘트에 대한 답글 확인
# (in_reply_to_id가 있는 코멘트 = 답글)
```

**검증 로직:**
```
모든 인라인 코멘트 수집
    ↓
각 코멘트별로 in_reply_to_id가 해당 코멘트인 답글이 있는지 확인
    ↓
답글 없는 코멘트 목록 작성
    ↓
0개 → ✅ 모든 코멘트에 답글 완료
N개 → ⚠️ 답글 누락 → 즉시 답글 작성
```

**답글 누락 시:**
```bash
# 누락된 코멘트에 즉시 답글
echo '{"body":"✅ 반영 완료 — 수정 내용"}' | \
  gh api repos/{REPO}/pulls/comments/{COMMENT_ID}/replies -X POST --input -
```

**피드백 분류 기준:**

| 카테고리 | 설명 | 우선순위 |
|---------|------|---------|
| 🔴 보안 | 취약점, 인증, 권한, 데이터 노출 | 즉시 수정 |
| 🟠 기능/로직 | 잘못된 동작, 누락, 버그 | 즉시 수정 |
| 🟡 성능 | 메모리, 쿼리, 레이턴시 | 권장 수정 |
| 🔵 아키텍처 | 구조, 결합도, 확장성 | 권장 수정 |
| ⚪ 스타일/컨벤션 | 네이밍, 포맷, 일관성 | 선택 수정 |
| 💡 제안 | 개선 아이디어, 대안 | 선택 사항 |

### 2.3 피드백 분석 보고서

```markdown
# PR #{N} 리뷰 분석

## 리뷰어별 요약
- Gemini: {요약}
- Copilot: {요약}

## 필수 수정 (MUST FIX)
1. [파일:라인] 설명 — 카테고리

## 권장 수정 (SHOULD FIX)
1. [파일:라인] 설명 — 카테고리

## 선택 수정 (NICE TO HAVE)
1. [파일:라인] 설명 — 카테고리

## 무시 (DISMISS)
1. [파일:라인] 설명 — 사유
```

**무시 기준:**
- 이미 처리된 피드백 (이전 라운드)
- 프로젝트 컨벤션과 충돌하는 스타일 의견
- 과도한 엔지니어링 (현재 스코프 불필요)
- 단순 선호도 (명확한 근거 없는 의견)

---

## Phase 3: 수정 + 검증

### 3.0 리뷰 처리 후 검증 결과 등록 (필수)

⚠️ **리뷰 피드백을 처리한 후 반드시 검증 결과를 PR 댓글로 등록해야 합니다. 없으면 재리뷰 요청 금지.**

**모든 PR에 필수:**
- [ ] 빌드 성공
- [ ] 테스트 통과
- [ ] **검증 결과를 PR 댓글로 등록**

**UI 컴포넌트가 포함된 PR 추가 필수:**
- [ ] **스크린샷 또는 동작 GIF 첨부** (Before/After)
- [ ] **실제 동작 확인 (수동 테스트)**

```bash
# 리뷰 처리 후 검증 결과 PR 댓글 등록 (필수)
gh pr comment {PR_NUMBER} --repo {REPO} --body "
## 🧪 검증 결과 (리뷰 수정 후)

### 리뷰 처리
- ✅ 반영: N건
- ⚪ 무시: N건 (사유 요약)

### 빌드 & 테스트
- **빌드**: ✅ 성공
- **테스트**: N/N 통과

### UI 변경 (해당 시)
| Before | After |
|--------|-------|
| ![before]({URL}) | ![after]({URL}) |

---
✅ 검증 완료 — 재리뷰 요청 가능
"
```

**등록하지 않으면:**
```
❌ 재리뷰 요청 금지 — 리뷰 처리 후 검증 결과가 등록되지 않음
→ 위 형식으로 검증 결과를 먼저 등록하세요.
```

### 3.1 수정 범위 판단

리뷰 피드백을 분석하고 수정 범위를 평가:

**과도 수정 기준 (다음 중 하나 이상):**
- 원래 PR 범위와 무관한 영역 수정 필요
- 아키텍처 구조 변경이 필요
- 수정 예상 작업량이 원래 PR의 50% 이상

```
수정 범위 평가
    ↓
  ├─ 소규모 (현재 PR에서 수정 가능)
  │   → 3.2 수정 실행
  │
  └─ 과도 수정 (현재 PR 범위 초과)
      → 이슈 등록 (Phase 3.5)
      → 현재 PR은 가능한 범위만 수정 후 머지
```

### 3.5 과도 수정 → 이슈 등록

과도 수정이 필요한 항목은 별도 이슈로 등록:

```bash
gh issue create --repo {REPO} \
  --title "[Follow-up] PR #{N} 리뷰 후속 수정: {요약}" \
  --body "$(cat <<EOF
## 원본 PR
#{PR_URL}

## 후속 수정 필요 항목
${과도_수정_항목_목록}

## 수정 계획 (pre-dev-review 적용 예정)
1. ${항목1}
2. ${항목2}

## 관련 파일
- ${파일목록}

## 참고
이 이슈는 PR #{N} 리뷰에서 식별되었으나, 수정 범위가 과도하여 별도 이슈로 분리되었습니다.
EOF
)" \
  --label "enhancement,follow-up"
```

**이슈 등록 후:**
- 현재 PR에서는 **소규모 수정만 반영** (즉시 수정 가능한 것들)
- 과도 수정 항목은 PR 댓글에 남겨둠:
  ```
  > 다음 항목들은 수정 범위가 크아 별도 이슈로 분리했습니다:
  > - #{이슈번호}: 설명
  ```

### 3.2 수정 계획 (소규모)

필수/권장 수정 항목 중 **현재 PR에서 처리 가능한 것만** 계획:

```markdown
## 수정 계획 (Round N)
### 이번 수정
1. [MUST] 파일.ts:L42 — ENOENT 처리 방식 변경
2. [SHOULD] 파일.ts:L15 — fs.access 제거 (TOCTOU)

### 별도 이슈로 분리
1. [FOLLOW-UP → #{이슈번호}] 아키텍처 리팩토링
```

### 3.3 수정 실행

```bash
# 브랜치 체크아웃
cd /tmp/{REPO} && git checkout {BRANCH}

# 수정 (서브에이전트 사용 가능)
# ...

# 검증 (필수)
bun install
bun test
bun run build
```

**검증 원칙 (pre-dev-review 준수):**
- [ ] 빌드 성공
- [ ] 기존 테스트 전부 통과 (회귀 없음)
- [ ] 새/수정된 테스트 통과
- [ ] 수정 내용이 실제로 동작하는지 확인

### 3.4 PR 리뷰 처리 결과 기록

수정 후 **각 리뷰 코멘트에 개별 답글**을 남기고, **PR-level review에도 답글**, 최종적으로 **요약 리뷰**를 작성합니다.

**Step 0: PR-level review (summary) 답글** — `#pullrequestreview-*` 형태의 리뷰는 line-level이 아님!
```bash
# PR-level review는 issue comment로 답글 (review comments API 안 됨)
gh pr comment {PR_NUMBER} --repo {REPO} --body "## 리뷰 처리 결과
@{reviewer}
전체 피드백 반영 완료: (요약)
검증: 빌드 성공, 테스트 N/N 통과, CI ✅"
```

**Step 1: 개별 답글** — 각 line-level 리뷰 코멘트의 하위 답글로 처리 내용 기록:

⚠️ **중요: `-f body="..."` 사용 금지! 반드시 `--input -` + JSON 파이프 방식 사용**
```bash
# ✅ 올바른 방식 (--input - 사용)
echo '{"body":"✅ 반영 완료 — 구체적 수정 내용"}' | \
  gh api repos/{REPO}/pulls/{COMMENT_ID}/replies -X POST --input - --jq '.html_url'

# ❌ 잘못된 방식 (-f body 사용 시 404 에러)
gh api repos/{REPO}/pulls/comments/{COMMENT_ID}/replies -f body="..."  # 404!

# 반영한 경우
echo '{"body":"✅ 반영 완료 — 구체적 수정 내용. 검증: 테스트 통과"}' | \
  gh api repos/{REPO}/pulls/{COMMENT_ID}/replies -X POST --input - --jq '.html_url'

# 무시하는 경우 (반드시 사유 명시)
echo '{"body":"⚪ 무시 — 무시 사유를 명시합니다."}' | \
  gh api repos/{REPO}/pulls/{COMMENT_ID}/replies -X POST --input - --jq '.html_url'
```

**답글은 반드시 모든 리뷰 코멘트에 대해 개별로 작성**합니다. 건너뛰지 마세요.

**Step 2: 요약 리뷰** — 전체 처리 결과를 간단히 요약:
```bash
gh pr review {PR_NUMBER} --repo {REPO} --event COMMENT \
  --body "## 리뷰 처리 결과
- ✅ 반영: N건
- ⚪ 무시: N건 (사유 요약)
- 🔀 이슈 분리: N건
- 검증: 테스트 N/N 통과, 빌드 성공"
```

**무시하는 항목에는 반드시 무시 사유를 명시**하여 나중에 확인 가능하도록 합니다.

**참고:** GitHub API에서 오래된 커밋의 리뷰 코멘트에는 개별 답글(replies)을 달 수 없는 경우가 있습니다. 이 경우 해당 항목은 요약 리뷰에 포함하여 처리합니다.

### 3.4 검증 실패 시 소규모 재계획 루프

```
검증 실행 (빌드 + 테스트 + 동작 확인)
    ↓
  ├─ 통과 → Phase 4 (재리뷰 요청)
  │
  └─ 실패
      ↓
    실패 원인 분석
      ↓
    소규모 수정 재계획:
      - 어떤 테스트가 실패했는가?
      - 어떤 파일/로직을 다시 수정해야 하는가?
      - 재검증 시나리오는?
      ↓
    수정 재실행
      ↓
    재검증
      ↓
      ├─ 통과 → Phase 4
      └─ 실패 → 루프 (최대 3회)
           └─ 3회 초과 → 원인 분석 후 사용자 보고
```

### 3.3 커밋 & 푸시

```bash
git add -A
git commit -m "fix: address review feedback - {요약}"
git push
```

**커밋 메시지 규칙:**
- `fix: address review feedback - {구체적 내용}`
- 여러 수정 시 줄바꿈으로 나열 가능

---

## Phase 4: 재리뷰 요청

푸시 후 **반드시 두 리뷰어 모두에게 재리뷰 요청:**

```bash
# Gemini 재리뷰 (댓글로 요청)
gh pr comment {PR_NUMBER} --repo {REPO} --body "/gemini review"

# Copilot 재리뷰 — push마다 자동이지만, 명시적으로 재요청하려면
# 방법 1: PR에 @copilot 코멘트 (자동 트리거)
gh pr comment {PR_NUMBER} --repo {REPO} --body "@copilot please re-review"

# 방법 2: GitHub API로 review 재요청 (코멘트 트리거 안 될 경우)
gh api repos/{REPO}/pulls/{PR_NUMBER}/reviews -X POST \
  --input - <<'EOF'
{"event":"COMMENT","body":"@copilot please re-review after latest changes"}
EOF
```

⚠️ **두 리뷰어 모두 재리뷰 요청은 필수** — 하나만 요청하지 마세요.

⚠️ **재리뷰 요청 후 반드시 3분 폴링 시작:**
```bash
# 재리뷰 요청 직후, 반드시 아래를 실행하여 리뷰 결과를 대기
sleep 180 && gh pr view {PR_NUMBER} --repo {REPO} \
  --json reviewDecision,statusCheckRollup,mergeStateStatus \
  --jq '{review: .reviewDecision, ci: .statusCheckRollup[0].conclusion, merge: .mergeStateStatus}'
```
- 폴링 결과에서 **새 리뷰 코멘트가 있으면 즉시 수정** (Phase 2 → Phase 3 → Phase 4 반복)
- 폴링 결과에서 **새 코멘트 없고 CI 성공이면** 병합 가능 상태 확인
- **폴링을 잊지 마세요 — 처리 후 "끝"이 아니라 폴링이 항상 따라야 합니다**

이후 Phase 2로 돌아가서 리뷰 재대기.

**반복 종료 조건:**
- [ ] **새 리뷰 코멘트 0건 (마지막 답글 이후)** + CI 성공 → **병합 가능**
- [ ] reviewDecision === "APPROVED" (승인) — Copilot/Gemini는 거의 안 하므로 위 조건이 실질적 판단 기준

⚠️ **중요:** Copilot과 Gemini는 COMMENTED만 반복하고 APPROVED를 거의 내리지 않습니다.
따라서 **"새 코멘트 없음 + CI 성공"**이 실질적인 병합 가능 판단 기준입니다.

### 4.1 리뷰 처리 후 검증 결과 등록 (필수)

⚠️ **리뷰 피드백을 처리한 후 반드시 검증 결과를 PR 댓글로 등록해야 합니다. 없으면 재리뷰 요청 금지.**

```bash
# 리뷰 처리 후 검증 결과 PR 댓글 등록 (필수)
gh pr comment {PR_NUMBER} --repo {REPO} --body "
## 🧪 검증 결과 (리뷰 수정 후)

### 리뷰 처리
- ✅ 반영: N건
- ⚪ 무시: N건 (사유 요약)

### 빌드 & 테스트
- **빌드**: ✅ 성공
- **테스트**: N/N 통과

### UI 변경 (해당 시)
| Before | After |
|--------|-------|
| ![before]({URL}) | ![after]({URL}) |

---
✅ 검증 완료 — 재리뷰 요청 가능
"
```

**등록하지 않으면:**
```
❌ 재리뷰 요청 금지 — 리뷰 처리 후 검증 결과가 등록되지 않음
→ 위 형식으로 검증 결과를 먼저 등록하세요.
```

---

## Phase 5: 재리뷰 결과 확인 및 병합 가능 상태 알림

⚠️ **병합 전 반드시 재리뷰 결과를 확인해야 합니다.** 재리뷰 요청 후 새 리뷰가 왔는지 확인하세요.

### 5.1 재리뷰 결과 확인 (필수)

```bash
# 최신 리뷰 확인
gh pr view {PR_NUMBER} --repo {REPO} \
  --json latestReviews,reviewDecision

# 재리뷰 요청 시간과 비교하여 새 리뷰가 왔는지 확인
# latestReviews[].submittedAt이 /gemini review 요청 시간 이후인지 체크
```

**재리뷰 결과 분석:**
- **새 리뷰 있음** → 리뷰 내용 분석 → Phase 3로 이동 (수정 루프)
- **새 리뷰 없음 + CI 성공** → 병합 가능 상태 알림 (Phase 5.2)

### 5.2 병합 가능 상태 알림

⚠️ **머지는 사용자가 직접 합니다.** 에이전트는 병합 가능 상태까지만 처리합니다.

**병합 가능 조건 (모두 충족 시):**
1. ✅ **검증 결과 PR 댓글 등록 완료** (Phase 3.0/4.1)
2. ✅ CI 모든 체크 성공
3. ✅ **새 리뷰 코멘트 0건** (마지막 답글 이후 추가된 필수 피드백 없음)
4. ✅ 머지 충돌 없음

**병합 가능 상태 확인:**
```bash
# 상태 최종 확인
gh pr checks {PR_NUMBER} --repo {REPO}
gh pr view {PR_NUMBER} --repo {REPO} \
  --json mergeStateStatus,reviewDecision

# 검증 결과 댓글 확인
gh pr view {PR_NUMBER} --repo {REPO} --json comments --jq '
  .comments[] | select(.body | contains("🧪 검증 결과"))
'
```

**사용자에게 알림:**
```
✅ PR #{N} 병합 가능 상태입니다!

📋 체크리스트:
- [x] 검증 결과 등록 완료
- [x] CI 성공
- [x] 리뷰 라운드: N회 완료
- [x] 충돌 없음

---
병합하려면: **"병합해"** 또는 **"/merge"**라고 하세요.
(자동 병합은 금지됩니다)
```

**병합 불가능 시:**
```
❌ PR #{N} 병합 불가능

원인:
- 검증 결과 미등록 → Phase 3.0/4.1 수행 필요 (⚠️ 필수)
- CI 실패 → 수정 필요
- 새 리뷰 피드백 있음 → Phase 3로 돌아가 처리 필요
- 충돌 있음 → rebase 필요
```

⚠️ **검증 결과 없으면 병합 불가** — PR description 또는 댓글에 🧪 검증 결과가 없으면 사용자에게 "병합 불가"를 알려야 합니다.

**병합 불가능 시:**
```
❌ PR #{N} 병합 불가능

원인:
- 검증 결과 미등록 → Phase 3.0/4.1 수행 필요 (⚠️ 필수)
- CI 실패 → 수정 필요
- 새 리뷰 피드백 있음 → Phase 3로 돌아가 처리 필요
- 충돌 있음 → rebase 필요
```

⚠️ **검증 결과 없으면 병합 불가** — PR description 또는 댓글에 🧪 검증 결과가 없으면 사용자에게 "병합 불가"를 알려야 합니다.

---

## Phase 6: 사후 정리 (병합 완료 후)

⚠️ **사용자가 직접 병합한 후에만 이 Phase를 실행합니다.**

병합 완료 확인 후:

```markdown
# PR #{N} 완료 보고

- **머지 방식**: merge/squash/rebase
- **리뷰 라운드**: N회
- **수정 커밋**: N개
- **주요 수정 내용**: ...
- **미반영 피드백**: (있는 경우) 사유
```

브랜치 정리:
```bash
git branch -d {BRANCH}
git push origin --delete {BRANCH}
```

### 6.1 task-tracker 해제

```bash
# task-tracker에서 완료 처리
completeTask(id="pr-{PR_NUMBER}")
```

### 6.2 issue-pipeline 자동 진행

이슈 파이프라인이 활성화된 경우:

```
issue-queue.json 업데이트:
  current → completed 배열로 이동
  current = null
    ↓
큐에서 다음 이슈 확인:
  ├─ 다음 이슈 있음 → 자동 시작 (issue-pipeline Phase 3)
  └─ 큐 비어있음 → 사용자에게 "파이프라인 완료" 알림
```

사용자에게 알림:
```
✅ PR #{N} 머지 완료!

다음 이슈 자동 시작:
→ #{M} {title}
```

---

## 자동화 모드 (서브에이전트)

⚠️ **서브에이전트는 기본적으로 workspace에 접근할 수 없습니다.**
반드시 `attachAs`로 workspace를 마운트하고 task에 pending.json 업데이트를 포함하세요.

전체 사이클을 서브에이전트로 자동 실행:

```
sessions_spawn(
  attachAs={mountPath: "/workspace"},
  task="
  PR #{PR_NUMBER}의 리뷰 사이클을 자동으로 처리해.

  ## ⚠️ 0. 공통 규칙 읽기 (필수)
  먼저 공통 규칙을 읽고 따르세요:
  ```bash
  read /workspace/RULES.md
  ```
  주요 규칙:
  - 모든 출력은 한글로
  - 작업 완료 후 검증 결과 PR 댓글 등록 필수
  - 폴링 최대 10회 (30분)

  ## 1. Task Tracker 등록 (필수)
  ```bash
  # /workspace/tasks/pending.json에 등록
  cat > /workspace/tasks/pending.json << 'EOF'
  {
    \"tasks\": [{
      \"id\": \"pr-review-{PR_NUMBER}\",
      \"type\": \"pr-review\",
      \"task\": \"PR #{PR_NUMBER} 리뷰 사이클 ({REPO})\",
      \"prNumber\": {PR_NUMBER},
      \"repo\": \"{REPO}\",
      \"startedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"expectedMinutes\": 30,
      \"lastCheckAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"lastCommentCount\": 0,
      \"round\": 1
    }]
  }
  EOF
  ```

  ## 1. PR 상태 확인
  gh pr view {PR_NUMBER} --repo {REPO}

  ## 2. 리뷰 피드백 수집 및 분류
  ## 3. 필수/권장 수정 항목 추출
  ## 4. 수정 실행 (코드 수정 + 검증)
  ## 5. 커밋 & 푸시
  ## 6. /gemini review 재요청
  ## 7. 최종 결과 보고 (머지 가능 여부)

  ## 8. 완료 전 필수 체크 (실패하면 완료하지 말 것)
  ```bash
  # 답글 없는 코멘트 수 확인
  UNREPLIED=$(gh api repos/{REPO}/pulls/{PR_NUMBER}/comments --jq '[.[] | select(.in_reply_to_id == null and (.replies | length == 0))] | length')
  if [ \"$UNREPLIED\" -gt 0 ]; then
    echo \"❌ $UNREPLIED개 코멘트에 답글 없음 — 답글 작성 후 다시 체크\"
    exit 1
  fi
  echo \"✅ 모든 코멘트에 답글 완료\"

  # 빌드/테스트 확인
  bun run build && bun test
  ```

  ## 9. 완료 시 Task Tracker 해제 (필수)
  ```bash
  # pending.json에서 제거
  echo '{\"tasks\": []}' > /workspace/tasks/pending.json
  ```

  검증 규칙:
  - 빌드 성공 필수
  - 기존 테스트 회귀 없음 필수
  - 수정 후 반드시 테스트로 증명
  - **모든 리뷰 코멘트에 답글 필수** (체크리스트로 검증)

  리뷰 요청:
  - Gemini: gh pr comment {N} --body '/gemini review'
  - Copilot: 자동 (설정 확인)

  무시해도 되는 피드백:
  - 이미 처리된 것
  - 프로젝트 컨벤션 충돌
  - 과도한 엔지니어링
"
)

## ⚠️ 메인 에이전트 완료 후 검증 (필수)

서브에이전트 완료 후 **반드시 메인 에이전트가 검증**:

```bash
# 답글 없는 코멘트 수 확인
UNREPLIED=$(gh api repos/{REPO}/pulls/{PR_NUMBER}/comments --jq '[.[] | select(.in_reply_to_id == null and (.replies | length == 0))] | length')

if [ \"$UNREPLIED\" -gt 0 ]; then
  echo \"⚠️ 답글 $UNREPLIED개 누락 → 추가 처리 필요\"
  # 서브에이전트 재실행 또는 직접 답글 작성
fi
```

**검증 체크리스트:**
- [ ] 모든 리뷰 코멘트에 답글 완료 (0개 미답글)
- [ ] CI 성공
- [ ] 검증 결과 댓글 등록 완료
```

### 대안: 메인 에이전트가 직접 등록/해제

서브에이전트가 복잡해지는 것을 피하려면:

```
# 메인 에이전트에서 등록
write(path="/workspace/tasks/pending.json", content={
  "tasks": [{
    "id": "pr-review-{PR_NUMBER}",
    "type": "pr-review",
    ...
  }]
})

# 서브에이전트 실행 (attachAs 불필요)
sessions_spawn(task="PR #{PR_NUMBER} 리뷰 처리...")

# 서브에이전트 완료 후 메인 에이전트에서 해제
write(path="/workspace/tasks/pending.json", content={"tasks": []})
```

---

## 다중 PR 병렬 처리

여러 PR이 있을 때:

1. **병렬 가능**: 서로 다른 브랜치, 다른 모듈 → 각각 서브에이전트
2. **순차 필수**: 같은 모듈, 의존 관계 → 순차 처리

```bash
# 병렬 처리 예시
sessions_spawn(task="PR #34 처리...")  # 파일 시스템 도구
sessions_spawn(task="PR #XX 처리...")  # 대시보드 채팅 (다른 모듈이므로 병렬 OK)
```

---

## 메모리 기록

완료 후 `memory/YYYY-MM-DD.md`에 기록:
```markdown
### PR #{N} 리뷰 사이클 완료
- 리포: {REPO}, 브랜치: {BRANCH}
- 리뷰 라운드: N회 (Gemini N회, Copilot N회)
- 수정 커밋: N개
- 머지: ✅/❌, 방식: merge/squash/rebase
- 미반영 피드백: (있는 경우)
```
