# 검증 방법론 레퍼런스

## Testing Pyramid (테스트 피라미드)

```
        ┌──────────┐
        │  E2E     │  10% — 전체 사용자 시나리오
       ┌┴──────────┴┐
       │ Integration │  20% — 모듈 간 상호작용
      ┌┴────────────┴┐
      │   Unit Tests  │  70% — 개별 단위 테스트
      └──────────────┘
```

**비율 가이드**: Unit 70%, Integration 20%, E2E 10%
**이유**: 단위 테스트가 빠르고 안정적. E2E는 느리고 깨지기 쉬움.

---

## 검증 방법론 카탈로그

### 1. Unit Testing (단위 테스트)
- **목적**: 개별 함수/클래스/컴포넌트 검증
- **도구**: Jest, Vitest, Bun test, Pytest
- **필수 케이스**:
  - Happy path (정상 동작)
  - Sad path (예외/에러)
  - Boundary values (경계값: 0, -1, MAX, MIN, empty string)
  - Null/undefined/empty inputs
  - Type mismatch inputs

### 2. Integration Testing (통합 테스트)
- **목적**: 모듈 간 상호작용 검증
- **대상**: API 엔드포인트, DB 쿼리, 파일 I/O, 외부 서비스 연동
- **도구**: Supertest, Testcontainers, MSW (Mock Service Worker)
- **핵심**: 실제 의존성 사용 (모킹 최소화)

### 3. E2E Testing (엔드투엔드 테스트)
- **목적**: 사용자 관점 전체 플로우 검증
- **도구**: Playwright, Cypress, Puppeteer
- **대상**: 핵심 사용자 시나리오만 (너무 많으면 유지보수 어려움)

### 4. Property-Based Testing (속성 기반 테스트)
- **목적**: 특정 입력이 아닌 "속성(불변성)"을 검증
- **원리**: 랜덤/퍼지 입력으로 엣지 케이스 자동 발견
- **도구**: fast-check (JS), Hypothesis (Python), PropEr (Erlang)
- **예시**: "역렬열한 결과를 다시 역렬열하면 원래와 같다" (1000회 무작위 검증)

### 5. Mutation Testing (돌연변이 테스트)
- **목적**: 테스트 품질 측정 ("테스트가 정말 버그를 잡는가?")
- **원리**: 코드에 의도적 변이(> → <, == → !=)를 주고 테스트가 이를 감지하는지
- **도구**: Stryker (JS), PIT (Java), cargo-mutants (Rust)
- **목표**: Mutation Score ≥ 80%
- **한계**: 느리므로 CI에서만 실행 권장

### 6. Snapshot Testing (스냅샷 테스트)
- **목적**: UI 렌더링 결과가 예상과 일치하는지
- **도구**: Jest snapshot, Playwright screenshots
- **주의**: 의도치 않은 변경도 감지하므로 리뷰 필수

### 7. Contract Testing (계약 테스트)
- **목적**: 마이크로서비스/API 간 인터페이스 호환성
- **도구**: Pact
- **원리**: 소비자가 기대하는 API 형식을 기록, 제공자가 이를 충족하는지 검증

### 8. Chaos Engineering (카오스 엔지니어링)
- **목적**: 시스템 장애 시 복원력 검증
- **도구**: Gremlin, Chaos Mesh, Litmus
- **예시**: DB 연결 끊기, 네트워크 지연, Pod 삭제 후 자가 복구 확인

---

## 검증 적용 가이드

### 기본 (모든 프로젝트 필수)
1. **Unit Tests** — 모든 public 함수
2. **Build 성공** — 타입 체크, 린트
3. **기존 테스트 회귀 없음**

### 권장 (대부분의 프로젝트)
4. **Integration Tests** — API, DB, 파일 I/O
5. **E2E Tests** — 핵심 시나리오 (3~5개)

### 고급 (품질이 중요한 프로젝트)
6. **Property-Based Tests** — 핵심 로직 불변성
7. **Mutation Tests** — CI에서 주기적 실행

### 특수 상황
- **UI 변경**: Snapshot Tests 필수
- **마이크로서비스**: Contract Tests 필수
- **분산 시스템**: Chaos Engineering 권장

---

## 보안 검증 추가 체크리스트

### SAST (Static Application Security Testing)
- **도구**: Semgrep, ESLint security plugin, SonarQube
- **시점**: 커밋 전 / PR 리뷰 시

### DAST (Dynamic Application Security Testing)
- **도구**: OWASP ZAP, Burp Suite
- **시점**: 배포 전 스테이징 환경

### Dependency Scanning
- **도구**: npm audit, Snyk, Dependabot
- **시점**: CI 파이프라인

### Secret Detection
- **도구**: Gitleaks, TruffleHog
- **시점**: pre-commit hook
