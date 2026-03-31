---
name: pr-creator
description: PR 생성 시 반드시 따라야 하는 템플릿 규칙. 모든 PR은 WHY, WHAT, HOW, 테스트, 검증 정보를 포함해야 함. 트리거: "PR 생성", "pull request", "pr create"
allowed-tools: Read, Write, Edit, Exec
---

# PR 생성 스킬

## 핵심 원칙

**PR은 코드 리뷰어를 위한 문서입니다.** 코드만 보고도 무엇을, 왜, 어떻게 변경했는지 이해할 수 있어야 합니다.

---

## 필수 섹션

### 1. 제목 (Title)

형식: `<type>(<scope>): <subject>`

```
fix(test): 기존 실패 테스트 3건 수정
feat(auth): OAuth2 로그인 기능 추가
docs(api): API 문서 업데이트
```

---

### 2. WHY (왜 이 PR이 필요한가?)

**가장 중요한 섹션입니다.**

```markdown
## 🎯 Why (왜)

- **문제**: [어떤 문제가 있었는지]
- **원인**: [왜 이 문제가 발생했는지]
- **목표**: [이 PR으로 무엇을 달성하려는지]
- **관련 이슈**: Closes #<번호>
```

**좋은 예:**
> **문제**: Lit 데코레이터가 bun:test 환경에서 동작하지 않아 StatusBoard, SessionList 테스트가 실패함
> **원인**: bun:test가 TC39 데코레이터 Stage 3을 완전히 지원하지 않음
> **목표**: Mock 컴포넌트를 사용하여 테스트가 통과하도록 수정

**나쁜 예:**
> 테스트 수정함

---

### 3. WHAT (무엇을 변경했는가?)

```markdown
## 📝 What (무엇)

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `StatusBoard.test.ts` | 수정 | JSDOM + MockStatusBoard |
| `bunfig.toml` | 생성 | experimentalDecorators 설정 |
```

**체크리스트:**
- [ ] 모든 변경 파일이 나열됨
- [ ] 각 파일의 변경 유형이 명시됨 (생성/수정/삭제)
- [ ] 각 변경의 이유가 설명됨

---

### 4. HOW (어떻게 구현했는가?)

```markdown
## 🔧 How (어떻게)

### 접근 방식
1. [첫 번째 접근 방식]
2. [두 번째 접근 방식]
3. [최종 선택한 방식과 이유]

### 구현 세부사항
- [핵심 구현 내용]
- [사용한 패턴/알고리즘]
- [외부 의존성 변경]
```

**좋은 예:**
> ### 접근 방식
> 1. 실제 StatusBoard 컴포넌트 import → Lit 데코레이터 오류
> 2. JSDOM + MockStatusBoard 사용 → 성공
> 
> ### 구현 세부사항
> - MockStatusBoard는 HTMLElement를 상속
> - customElements.define()으로 등록
> - document.createElement()로 인스턴스 생성

---

### 5. 테스트 (어떻게 테스트했는가?)

```markdown
## 🧪 테스트

### 테스트 방법
```bash
bun test apps/dashboard/src/components/StatusBoard.test.ts
bun test apps/dashboard/src/components/SessionList.test.ts
```

### 테스트 결과
| 테스트 | 결과 |
|--------|------|
| StatusBoard > should be defined | ✅ Pass |
| StatusBoard > should have correct element name | ✅ Pass |
| SessionList > should be defined | ✅ Pass |
| SessionList > should have correct element name | ✅ Pass |

### 커버리지
- Unit Tests: N개 통과
- Integration Tests: N개 통과
- 전체 커버리지: N%
```

**필수 항목:**
- [ ] 테스트 실행 명령어
- [ ] 개별 테스트 결과
- [ ] 커버리지 정보

---

### 6. 검증 (어떻게 검증했는가?)

```markdown
## ✅ 검증

### 로컬 검증
- [x] `bun test` 전체 통과
- [x] 린트 검사 통과
- [x] 타입 검사 통과
- [x] 수동 테스트 완료

### CI 검증
- [ ] GitHub Actions 통과 (대기 중)
- [ ] CI 테스트 통과
- [ ] 빌드 성공

### 회귀 테스트
- [ ] 기존 테스트 모두 통과
- [ ] 새로운 테스트 추가됨
```

---

### 7. 영향도 (기존 기능에 미치는 영향)

```markdown
## ⚠️ 영향도

| 영역 | 영향 | 설명 |
|------|------|------|
| 기존 기능 | 없음 | 테스트 파일만 수정 |
| 성능 | 없음 | 프로덕션 코드 무변경 |
| 하위 호환성 | 유지 | API 변경 없음 |
```

---

### 8. 스크린샷/증거 (필요시)

```markdown
## 📸 스크린샷

### Before
[이전 상태 스크린샷]

### After
[이후 상태 스크린샷]
```

---

### 9. 리뷰어를 위한 참고사항

```markdown
## 💬 리뷰어 참고

- **집중 리뷰 영역**: [리뷰어가 특히 봐줬으면 하는 부분]
- **논의 필요**: [결정이 필요한 사항]
- **참고 링크**: [관련 문서/디자인]
```

---

### 10. 체크리스트

```markdown
## ☑️ 체크리스트

- [ ] 코드가 프로젝트 스타일 가이드를 따름
- [ ] 자체 리뷰 완료
- [ ] 주석/문서 업데이트
- [ ] 테스트 추가/수정
- [ ] 모든 테스트 통과
- [ ] CI 통과
- [ ] Breaking Change 없음 (또는 명시됨)
```

---

## PR 생성 프로세스

### Step 1: pre-dev-review 완료 확인
- [ ] IMPL_PLAN.md 작성됨
- [ ] 4개 전문가 검토 완료
- [ ] TDD 사이클 완료

### Step 2: 테스트 실행
```bash
bun test
bun run lint
bun run typecheck
```

### Step 3: PR 본문 작성
위 템플릿에 따라 작성

### Step 4: PR 생성
```bash
gh pr create --repo <owner>/<repo> \
  --title "<type>(<scope>): <subject>" \
  --body "$(cat pr-body.md)"
```

### Step 5: 리뷰 요청
```bash
gh pr comment <pr-number> --repo <owner>/<repo> --body "/gemini review"
```

### Step 6: 리뷰 피드백에 답글 ⚠️ 필수

**⚠️ 주의: `gh pr comment`가 아니라 리뷰 스레드에 직접 답글해야 함**

#### 방법 1: GitHub 웹 UI (권장)
1. PR 페이지 접속
2. 리뷰 코멘트의 **"Reply"** 버튼 클릭
3. 답글 작성

#### 방법 2: gh api 사용
```bash
# 리뷰 ID 확인
gh pr view <pr-number> --repo <owner>/<repo> --json reviews

# 리뷰 코멘트에 답글
gh api repos/<owner>/<repo>/pulls/<pr-number>/comments/<comment-id>/replies \
  --method POST \
  -f body="감사합니다. 피드백 반영했습니다."
```

**체크리스트:**
- [ ] 모든 리뷰 코멘트에 답글 작성 (스레드 내에서)
- [ ] 피드백 수용/반려 사유 명시
- [ ] 수정 사항은 커밋 후 코멘트로 알림

---

## ❌ 피해야 할 것

1. **"수정함"** → WHY가 없음
2. **"테스트 통과"** → 어떻게 검증했는지 없음
3. **코드만 보여주기** → 맥락 없음
4. **너무 긴 설명** → 핵심만 간결하게
5. **너무 짧은 설명** → 정보 부족

---

## ✅ 좋은 PR 예시

```markdown
## 🎯 Why
- **문제**: Lit 데코레이터가 bun:test에서 동작하지 않아 3개 테스트 실패
- **원인**: bun:test의 TC39 데코레이터 지원 미완료
- **목표**: Mock 컴포넌트로 테스트 통과

Closes #59

## 📝 What

| 파일 | 변경 | 설명 |
|------|------|------|
| StatusBoard.test.ts | 수정 | JSDOM + MockStatusBoard |
| SessionList.test.ts | 수정 | JSDOM + MockSessionList |
| bunfig.toml | 생성 | experimentalDecorators = true |

## 🔧 How
Lit 데코레이터 대신 Mock 컴포넌트 사용:
1. JSDOM으로 DOM 환경 구성
2. MockStatusBoard extends HTMLElement
3. customElements.define('status-board', MockStatusBoard)

## 🧪 테스트
```bash
bun test apps/dashboard/src/components/StatusBoard.test.ts
```

| 테스트 | 결과 |
|--------|------|
| StatusBoard > should be defined | ✅ Pass |
| StatusBoard > should have correct element name | ✅ Pass |

## ✅ 검증
- [x] 로컬 테스트 통과
- [x] 기존 테스트 회귀 없음
- [ ] CI 통과 (대기 중)

## ⚠️ 영향도
- 프로덕션 코드 무변경
- 테스트 파일만 수정
```
