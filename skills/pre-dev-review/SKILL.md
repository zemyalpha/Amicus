---
name: pre-dev-review
description: >
  개발 전 사전 검토 스킬. 이슈/요구사항 분석 → 코드 분석 → 수정 계획 수립 →
  다중 전문가 검토(보안/기획/디자인/아키텍처) → 피드백 통합 → ALL OK 시 개발 시작.
  모든 프로젝트에 범용 적용 가능. TDD Red-Green-Refactor 강제.
  트리거: "pre-dev-review", "사전 검토", "개발 전 검토", "개발 계획"
allowed-tools: Read, Write, Edit, Exec, sessions_spawn, web_search, web_fetch
---

# Pre-Development Review (사전 개발 검토)

개발을 시작하기 전에 반드시 거쳐야 하는 다중 전문가 검토 프로세스.

## 핵심 원칙

1. **계획 없이 코딩 금지** — 이슈 분석 → 코드 분석 → 계획 → 검토 → 개발 순서
2. **다중 전문가 병렬 검토** — 4개 전문가 페르소나가 동시에 검토
3. **ALL OK 전에는 개발 불가** — 한 명이라도 BLOCK이면 계획 수정 후 재검토
4. **TDD 강제** — Red(실패 테스트) → Green(구현) → Refactor(개선) 순서 엄수
5. **검증은 증명이어야 함** — "수정함"이 아니라 "테스트로 증명함"

---

## Phase 0: 입력 구조화

사용자 입력(이슈, 요구사항, 자연어)을 구조화된 형식으로 변환:

```
TASK: [작업명]
GOAL: [목표]
SCOPE: [포함/제외 범위]
CONTEXT: [배경]
ACCEPTANCE_CRITERIA:
  1. [수용 기준 1]
  2. [수용 기준 2]
  ...
TEST_FOCUS: [테스트 우선 순위]
```

---

## Phase 1: 이슈 & 코드 분석

### 1.1 이슈 분석
- GitHub 이슈 읽기 (제목, 본문, 댓글, 라벨)
- 요구사항 파싅 → 수용 기준(Acceptance Criteria) 정의
- 엣지 케이스 식별

### 1.2 코드 분석
- 관련 파일 목록 추출 (`git diff`, `rg`, 파일 구조)
- 현재 구조/아키텍처 파악
- 의존성 맵핑
- 기존 테스트 파악

### 1.3 수정 계획 작성
출력: `IMPL_PLAN.md` 형식

```markdown
# 구현 계획: [TASK]

## 목표
[GOAL]

## 변경 파일
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| path/to/file.ts | 생성/수정/삭제 | 변경 내용 |

## 구현 단계
### Step 1: [단계명]
- 테스트: [Red] 어떤 테스트를 먼저 작성할지
- 구현: [Green] 어떻게 구현할지
- 리팩터: [Refactor] 어떻게 개선할지

### Step 2: ...

## 위험도
- [ ] 보안 영향
- [ ] 성능 영향
- [ ] 하위 호환성
- [ ] 기존 기능 영향
```

---

## Phase 2: 다중 전문가 검토 (병렬)

4개 서브에이전트를 병렬로 실행. 각 전문가는 IMPL_PLAN.md을 검토하고:

- **APPROVE**: 계획이 검토 관점에서 적합함
- **REQUEST_CHANGES**: 수정 필요 (이유 + 구체적 대안 명시)
- **BLOCK**: 심각한 문제 (개발 중지 사유)

### 🔒 보안 전문가

**검토 방법론: STRIDE + DREAD**

STRIDE 위협 모델링:
| 위협 | 검토 포인트 |
|------|------------|
| Spoofing | 인증/식별 위장 가능성 |
| Tampering | 데이터 무결성 조작 가능성 |
| Repudiation | 행위 부인/추적 불가 |
| Info Disclosure | 민감 정보 노출 |
| Denial of Service | 서비스 거부 가능성 |
| Elevation of Privilege | 권한 상승 |

DREAD 점수화 (각 1~10):
- Damage / Reproducibility / Exploitability / Affected Users / Discoverability
- 총합 ≥ 21: HIGH, 11-20: MEDIUM, ≤ 10: LOW

**체크리스트:**
- [ ] 입력 검증 (Injection, XSS, Path Traversal)
- [ ] 인증/인가 로직 적절성
- [ ] 민감 데이터 암호화/마스킹
- [ ] 하드코딩된 시크릿/토큰 없음
- [ ] 의존성 취약점
- [ ] 에러 메시지에 정보 노출 없음
- [ ] 로그에 민감 정보 포함 안 됨

### 📋 기획자

**검토 방법론: User Story Mapping + Edge Case Analysis**

**체크리스트:**
- [ ] 모든 요구사항이 계획에 반영됨
- [ ] 엣지 케이스 식별 및 처리 계획 (null, empty, timeout, concurrent)
- [ ] 에러 시나리오 정의 (400, 401, 403, 404, 409, 429, 500)
- [ ] API/인터페이스 변경이 하위 호환성 유지
- [ ] 수용 기준(Acceptance Criteria)이 명확하고 검증 가능
- [ ] 사용자 시나리오가 엔드-투-엔드로 커버됨
- [ ] 롤백/복구 계획

### 🎨 디자이너

**검토 방법론: WCAG 2.1 AA + State Design**

**체크리스트:**
- [ ] 기존 디자인 시스템/컴포넌트와 일관성
- [ ] 에러/로딩/빈 상태/성공 UI 정의
- [ ] 반응형 동작 (모바일/태블릿/데스크톱)
- [ ] 접근성 (색 대비 4.5:1, 키보드 네비게이션, ARIA)
- [ ] 애니메이션/트랜지션 적절성
- [ ] 텍스트 길이 다국어 대응

> **UI 변경이 없는 작업**: "N/A — UI 변경 없음"으로 패스

### 🏗️ 아키텍트

**검토 방법론: SOLID + NFR (Non-Functional Requirements)**

**체크리스트:**
- [ ] 단일 책임 원칙 (SRP) 준수
- [ ] 새로운 의존성 최소화 (기존 것으로 대체 불가한가?)
- [ ] 모듈 간 결합도 낮은가?
- [ ] 성능 영향 예측 (쿼리 N+1, 메모리, 레이턴시)
- [ ] 확장성 (트래픽/데이터 증가 대응)
- [ ] API 호환성 유지 (Breaking Change 없음)
- [ ] 기존 테스트와의 영향도
- [ ] 순환 의존 없음

---

## Phase 3: 피드백 통합

4명 결과를 종합:

```
결과 집계:
- APPROVE: N명
- REQUEST_CHANGES: N명
- BLOCK: N명

BLOCK이 1개라도 있으면:
  → 소규모 재계획 (해당 BLOCK 원인만 타겟팅)
  → BLOCK 원인 해결 → 해당 전문가만 재검토

REQUEST_CHANGES가 있으면:
  → 피드백 반영 → 전체 재검토 또는 해당 전문가만 재검토

ALL APPROVE:
  → Phase 4 (개발 시작)
```

### 피드백 반영 시 소규모 재계획 루프

피드백이 계획 수정을 요구할 때, 전체 Phase 1부터 다시 하는 것이 아니라 **해당 문제만 타겟팅**한 소규모 계획을 수립:

```
피드백 수신 (BLOCK 또는 REQUEST_CHANGES)
    ↓
문제 분석 (어떤 관점에서, 왜 문제인가?)
    ↓
소규모 수정 계획:
  - 대상: 영향받는 파일/모듈만
  - 범위: 해당 문제 해결에 필요한 최소 변경
  - 검증: 어떻게 증명할지
    ↓
계획 승인 후 수정 실행
    ↓
해당 전문가 재검토
    ↓
  ├─ APPROVE → 다음 전문가 또는 Phase 4
  └─ 여전히 BLOCK → 루프 (최대 3회)
       └─ 3회 초과 → 사용자에게 보고
```

---

## Phase 4: TDD 개발 (Red-Green-Refactor)

### Iron Law
```
실패하는 테스트 없이 프로덕션 코드를 작성하지 마라.
테스트가 먼저 작성되었음을 증명하지 못한 코드는 없는 것과 같다.
```

### Red → Green → Refactor 사이클

**Red (실패하는 테스트 먼저):**
- 구현 전 테스트 작성
- 테스트가 실패하는 것을 **확인** (Red witnessed)
- 실패 로그를 기록

**Green (최소 구현으로 통과):**
- 테스트를 통과시키는 최소한의 코드만 작성
- 과잉 구현 금지

**Refactor (개선):**
- 테스트가 여전히 통과하는지 확인하면서 리팩토링
- 중복 제거, 네이밍 개선, 구조 개선

### 각 단계 검증 (빌드-테스트-증명)

```
수정 후 반드시:
1. 빌드 성공 확인 (tsc/compile)
2. 전체 테스트 실행 (기존 테스트 회귀 없음)
3. 새 테스트 통과 확인
4. 동작 검증 (수동 또는 스크립트로 실제 동작 확인)
```

---

## Phase 5: 완성 검증 (Post-Implementation Verification)

### 검증 방법론 계층 (Testing Pyramid 기반)

```
        ┌──────────┐
        │  E2E     │  10% — 전체 플로우 검증
       ┌┴──────────┴┐
       │ Integration │  20% — 모듈 간 상호작용
      ┌┴────────────┴┐
      │   Unit Tests  │  70% — 개별 함수/컴포넌트
      └──────────────┘
```

### 검증 체크리스트

**Unit Tests (필수):**
- [ ] 모든 public 함수에 테스트
- [ ] 정상 케이스 (happy path)
- [ ] 예외 케이스 (null, empty, error)
- [ ] 경계값 (boundary values)
- [ ] 엣지 케이스 (Phase 2에서 식별한 것들)

**Integration Tests (필요시):**
- [ ] 모듈 간 상호작용
- [ ] DB/파일시스템/네트워크 I/O
- [ ] API 엔드포인트

**E2E Tests (필요시):**
- [ ] 사용자 시나리오 엔드-투-엔드
- [ ] 에러 복구 시나리오

**Property-Based Testing (고급, 선택):**
- 불변성(invariants)이 항상 유지되는지 검증
- 랜덤 입력으로 엣지 케이스 자동 발견

**Mutation Testing (고급, 선택):**
- 테스트 품질 검증: 코드에 변이를 주고 테스트가 이를 감지하는지
- 감지율 80% 이상 권장

**Snapshot Testing (UI 변경시):**
- [ ] 이전 스냅샷과 비교
- [ ] 의도적 변경이면 스냅샷 업데이트

### 검증 결과에 따른 분기

**검증 통과 시:**
→ Phase 6 (PR 생성)로 진행

**검증 실패 시 — 소규모 재계획 루프:**
```
검증 실패
    ↓
실패 원인 분석 (어떤 테스트/검증이 실패했는가?)
    ↓
소규모 수정 계획 수립 (해당 실패만 타겟팅)
  - 어떤 파일을 어떻게 수정할지
  - 어떤 테스트를 추가/수정할지
  - 재검증 시나리오
    ↓
수정 실행 (Phase 4 TDD 사이클)
    ↓
재검증
    ↓
  ├─ 통과 → Phase 6
  └─ 실패 → 다시 루프 (최대 3회)
       └─ 3회 초과 → 원인을 사용자에게 보고
```

**루프 제한:**
- 동일 단계에서 최대 3회 반복
- 3회 초과 시: 근본 원인 분석 후 Phase 1로 되돌아가 전체 재검토
- 또는 해당 문제를 별도 이슈로 분리하여 현재 작업은 완료 처리

### 검증 증명

최종 결과물:
```markdown
# 검증 보고서: [TASK]

## 테스트 결과
- Unit: N개 통과 / N개 실패
- Integration: N개 통과
- E2E: N개 통과
- 커버리지: N% (목표: N% 이상)

## 회귀 테스트
- 기존 테스트 전부 통과: ✅/❌
- 실패 시 원인: [없음 / 설명]

## 수용 기준 충족
1. [AC 1]: ✅ 통과 (테스트: test_xxx)
2. [AC 2]: ✅ 통과 (테스트: test_xxx)

## 전문가 피드백 반영
- 보안: ✅ 모두 반영
- 기획: ✅ 모두 반영
- 디자인: N/A (UI 변경 없음)
- 아키텍트: ✅ 모두 반영

## 검증 루프 이력
- Round 1: ❌ 실패 (원인: X) → 수정 계획 수립
- Round 2: ✅ 통과
```

---

## Phase 6: PR → 리뷰 → 머지

1. PR 생성 (IMPL_PLAN.md 기준으로 설명 작성)
2. **검증 결과 첨부**: 테스트 결과, 커버리지, 스크린샷(있는 경우)
   ```bash
   # 검증 보고서를 PR 본문 또는 댓글에 첨부
   gh pr create --repo {REPO} --title "..." --body "$(cat <<EOF
   ## 구현 내용
   ...

   ## 검증 결과
   - 빌드: ✅ 성공
   - 테스트: Unit N개 / Integration N개 통과
   - 커버리지: N%
   - 스크린샷: (있는 경우 첨부)

   ## 전문가 검토 반영
   - 보안: ✅ / 기획: ✅ / 디자인: N/A / 아키텍트: ✅
   EOF
   )"
   
   # 스크린샷이 있는 경우 PR 댓글로 이미지 첨부
   gh pr comment {PR_NUMBER} --repo {REPO} --body "검증 스크린샷" --image path/to/screenshot.png
   ```
3. `/gemini review` 댓글로 Gemini 리뷰 요청 (Copilot은 자동)
4. 리뷰 피드백 반영 → **각 항목별로 PR에 처리 내용 댓글 기록** → 재커밋 → 재리뷰
5. **CI 성공 + 리뷰 승인 + 검증 보고서 첨부** → 머지

---

## 서브에이전트 실행 방법

Phase 2 (다중 전문가 검토) 시 4개 서브에이전트를 병렬 실행:

```bash
# 각 전문가별로 IMPL_PLAN.md + 관련 코드를 제공
sessions_spawn(mode="run", runtime="subagent",
  task="당신은 🔒 보안 전문가입니다. ... IMPL_PLAN.md를 검토하세요.
        STRIDE+DREAD 방법론으로 검토하고 APPROVE/REQUEST_CHANGES/BLOCK 판단.
        출력: [VERDICT] + [DREAD 점수] + [피드백 목록]")

sessions_spawn(mode="run", runtime="subagent",
  task="당신은 📋 기획자입니다. ...")
sessions_spawn(mode="run", runtime="subagent",
  task="당신은 🎨 디자이너입니다. ...")
sessions_spawn(mode="run", runtime="subagent",
  task="당신은 🏗️ 아키텍트입니다. ...")
```

모든 서브에이전트 완료 후 결과를 통합하여 Phase 3 진행.

---

## 메모리 기록

완료 후 `memory/YYYY-MM-DD.md`에 기록:
```markdown
### [TASK] Pre-Dev Review 완료
- 전문가 검토: 보안 ✅ 기획 ✅ 디자인 ✅ 아키텍트 ✅
- 피드백: N건 반영
- 검증: Unit N개 / Integration N개 / E2E N개
- PR: #번호, 상태: MERGED/OPEN
```
