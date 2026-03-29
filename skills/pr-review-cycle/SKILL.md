---
name: pr-review-cycle
description: >
  PR 생성 후 리뷰-수정-머지 사이클 자동화. Gemini + Copilot 리뷰 요청,
  리뷰 피드백 분석, 수정 + 검증, 재리뷰, 승인 시 머지까지 반복.
  모든 프로젝트에 범용 적용.
  트리거: "pr-review", "PR 리뷰 사이클", "리뷰 처리", "PR 머지"
allowed-tools: Read, Write, Edit, Exec, sessions_spawn, web_search
---

# PR Review Cycle (리뷰-수정-머지 사이클)

PR이 등록된 후부터 머지까지의 전체 프로세스를 관리합니다.

## 핵심 원칙

1. **리뷰는 반드시 요청** — PR 생성 즉시 Gemini(`/gemini review`) + Copilot
2. **리뷰는 꼼꼼히 분석** — 모든 피드백을 시맨틱하게 분류 (보안/성능/스타일/기능)
3. **수정 후 반드시 검증** — 빌드 + 테스트 + 동작 확인 (pre-dev-review의 검증 원칙 준수)
4. **자동 반복** — 수정 필요시 재커밋 → 재리뷰 → 반복
5. **CI 성공 + 리뷰 승인 = 머지** — 두 조건 모두 충족 시에만 머지

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

---

## Phase 2: 리뷰 대기 & 분석

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
# PR 리뷰 코멘트 수집
gh api repos/{REPO}/pulls/{PR_NUMBER}/comments
gh api repos/{REPO}/pulls/{PR_NUMBER}/reviews
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

수정 후 **각 리뷰 코멘트에 개별 답글**을 남기고, 최종적으로 **요약 리뷰**를 작성합니다.

**Step 1: 개별 답글** — 각 리뷰 코멘트의 하위 답글로 처리 내용 기록:
```bash
# 반영한 경우
gh api repos/{REPO}/pulls/comments/{COMMENT_ID}/replies -X POST \
  -f body="✅ 반영 완료 — 구체적 수정 내용. 검증: 테스트 통과"

# 무시하는 경우 (반드시 사유 명시)
gh api repos/{REPO}/pulls/comments/{COMMENT_ID}/replies -X POST \
  -f body="⚪ 무시 — 무시 사유를 명시합니다."
```

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

푸시 후 자동으로 Copilot이 재리뷰. Gemini는 수동 요청:

```bash
gh pr comment {PR_NUMBER} --repo {REPO} --body "/gemini review"
```

이후 Phase 2로 돌아가서 리뷰 재대기.

**반복 종료 조건:**
- [ ] reviewDecision === "APPROVED" (승인)
- [ ] 필수 수정 0건 + CI 성공 (코멘트만 있는 경우)

---

## Phase 5: 머지

**머지 조건 (모두 충족 시):**
1. ✅ CI 모든 체크 성공
2. ✅ 리뷰어 승인 (APPROVED)
3. ✅ 필수 수정 모두 반영
4. ✅ 머지 충돌 없음

```bash
# 상태 최종 확인
gh pr checks {PR_NUMBER} --repo {REPO}
gh pr view {PR_NUMBER} --repo {REPO} \
  --json mergeStateStatus,reviewDecision

# 머지
gh pr merge {PR_NUMBER} --repo {REPO} --merge
# 또는 --squash, --rebase (프로젝트 컨벤션 따름)
```

**머지 실패 시:**
- mergeStateStatus === "DIRTY" → 로컬에서 rebase 후 푸시
- CI 실패 → Phase 3으로 돌아가 수정

---

## Phase 6: 사후 정리

머지 완료 후:

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

---

## 자동화 모드 (서브에이전트)

전체 사이클을 서브에이전트로 자동 실행:

```
sessions_spawn(task="
  PR #{PR_NUMBER}의 리뷰 사이클을 자동으로 처리해.

  1. 현재 PR 상태 확인 (gh pr view)
  2. 리뷰 피드백 수집 및 분류
  3. 필수/권장 수정 항목 추출
  4. 수정 실행 (코드 수정 + 검증)
  5. 커밋 & 푸시
  6. /gemini review 재요청
  7. 최종 결과 보고 (머지 가능 여부)

  검증 규칙:
  - 빌드 성공 필수
  - 기존 테스트 회귀 없음 필수
  - 수정 후 반드시 테스트로 증명

  리뷰 요청:
  - Gemini: gh pr comment {N} --body '/gemini review'
  - Copilot: 자동 (설정 확인)

  무시해도 되는 피드백:
  - 이미 처리된 것
  - 프로젝트 컨벤션 충돌
  - 과도한 엔지니어링
")
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
