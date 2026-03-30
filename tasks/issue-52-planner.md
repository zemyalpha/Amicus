# 기획자 검토 결과 - 이슈 #52 [Phase 1] 채팅 히스토리 관리

## 검토 일시
2026-03-30

## 검토 대상
- 계획 파일: `/workspace/tasks/issue-52-plan.md`
- 이슈 범위: 세션 기반 채팅 히스토리 저장, 불러오기/삭제 API, 대시보드 세션 목록, 이전 대화 불러오기, 테스트 작성

---

## 📋 기획자 검토 체크리스트

### ✅ 모든 요구사항이 계획에 반영됨

| 요구사항 | 반영 여부 | 계획 내 위치 |
|----------|----------|--------------|
| 세션 기반 채팅 히스토리 저장 | ✅ | ChatSession 타입, SessionService |
| 히스토리 불러오기/삭제 API | ✅ | GET/DELETE /api/chat/sessions |
| 대시보드에서 세션 목록 표시 | ✅ | SessionList 컴포넌트 |
| 이전 대화 불러오기 기능 | ✅ | 세션 선택 시 메시지 복원 |
| 테스트 작성 | ✅ | TDD 5단계 계획 |

**판단: PASS**

---

### ⚠️ 엣지 케이스 식별 및 처리 계획

| 엣지 케이스 | 계획에서 언급 | 구체적 처리 방안 | 상태 |
|-------------|---------------|------------------|------|
| **null/undefined** | ❌ | 없음 | 🔴 누락 |
| **빈 세션 (messages: [])** | ❌ | 없음 | 🔴 누락 |
| **빈 메시지 내용** | ❌ | 없음 | 🔴 누락 |
| **타이틀 자동 생성 실패** | ⚠️ | "첫 메시지 기반" 언급만 | 🟡 불명확 |
| **SQLite DB 손상** | ❌ | 없음 | 🔴 누락 |
| **동시 세션 접근** | ⚠️ | "트랜잭션" 언급만 | 🟡 불명확 |
| **대량 메시지 (100개 초과)** | ✅ | "메시지는 최대 100개 제한" | 🟢 명시됨 |
| **세션 ID 형식 오류** | ❌ | 없음 | 🔴 누락 |
| **페이지 이동 중 저장 실패** | ❌ | 없음 | 🔴 누락 |

**판단: NEEDS IMPROVEMENT**

**권장 보완:**
```typescript
// 엣지 케이스 처리 예시
- null/undefined: Optional chaining 및 기본값 사용
- 빈 세션: 타이틀을 "새 대화"로 기본 설정
- DB 손상: try-catch + 폴백 to in-memory
- 동시 접근: SQLite 트랜잭션으로 래핑
- 세션 ID 검증: UUID 형식 검증 미들웨어
```

---

### ⚠️ 에러 시나리오 정의

| HTTP 상태 코드 | 시나리오 | 계획에서 정의 | 상태 |
|----------------|----------|---------------|------|
| **400 Bad Request** | 잘못된 세션 ID 형식, 빈 필수 필드 | ❌ | 🔴 누락 |
| **401 Unauthorized** | 인증 필요 (제외 범위) | N/A | ⚪ 제외 |
| **403 Forbidden** | 다른 사용자 세션 접근 | ❌ | 🔴 누락 |
| **404 Not Found** | 존재하지 않는 세션 ID | ❌ | 🔴 누락 |
| **409 Conflict** | 동시 수정 충돌 | ❌ | 🔴 누락 |
| **429 Too Many Requests** | 세션 생성/삭제 요청 과다 | ❌ | 🔴 누락 |
| **500 Internal Server Error** | DB 오류, 예외 발생 | ❌ | 🔴 누락 |

**판단: NEEDS IMPROVEMENT**

**권장 보완:**
```typescript
// API 에러 응답 스펙 추가 필요
interface APIError {
  code: string;        // 'SESSION_NOT_FOUND', 'INVALID_ID', etc.
  message: string;
  details?: unknown;
}

// 라우트별 에러 처리 예시
app.get('/api/chat/sessions/:id', async (c) => {
  try {
    const session = await sessionService.getSession(id);
    if (!session) {
      return c.json({ code: 'SESSION_NOT_FOUND', message: '...' }, 404);
    }
    return c.json(session);
  } catch (e) {
    return c.json({ code: 'INTERNAL_ERROR', message: '...' }, 500);
  }
});
```

---

### ✅ API/인터페이스 변경이 하위 호환성 유지

| 항목 | 내용 | 상태 |
|------|------|------|
| 기존 API 유지 | `/api/chat/stream` 엔드포인트 변경 없음 | ✅ |
| 새 API 추가 | `/api/chat/sessions/*` 새로 추가 | ✅ |
| 타입 확장 | ChatSession 타입 추가 (기존 타입 수정 없음) | ✅ |
| 프론트엔드 | 기존 ChatPanel 동작 유지 | ✅ |

**판단: PASS**

---

### ✅ 수용 기준(Acceptance Criteria)이 명확하고 검증 가능

| AC | 명확성 | 검증 방법 | 상태 |
|----|--------|-----------|------|
| 1. 세션 생성 시 고유 ID 부여 | ✅ 명확 | 단위 테스트 | ✅ |
| 2. 대화 종료 시 자동 저장 | ✅ 명확 | 통합 테스트 | ✅ |
| 3. 대시보드에서 세션 목록 조회 | ✅ 명확 | E2E 테스트 | ✅ |
| 4. 이전 세션 선택 시 히스토리 복원 | ✅ 명확 | E2E 테스트 | ✅ |
| 5. 세션 삭제 기능 | ✅ 명확 | 단위/E2E 테스트 | ✅ |
| 6. 앱 재시작 후 세션 보존 | ✅ 명확 | 통합 테스트 | ✅ |

**판단: PASS**

---

### ⚠️ 사용자 시나리오가 엔드-투-엔드로 커버됨

| 시나리오 | E2E 커버 | 상태 |
|----------|----------|------|
| 새 세션 생성 → 메시지 전송 → 저장 확인 | ✅ | 🟢 |
| 페이지 새로고침 → 세션 목록 확인 → 복원 | ✅ | 🟢 |
| 세션 목록 → 이전 대화 선택 → 메시지 표시 | ⚠️ 암시적 | 🟡 |
| 세션 삭제 → 목록에서 제거 확인 | ❌ | 🔴 누락 |
| 여러 세션 생성 → 전환 → 각각 유지 | ❌ | 🔴 누락 |
| 빈 세션 생성 → 타이틀 표시 | ❌ | 🔴 누락 |
| 동시에 여러 탭에서 같은 세션 수정 | ❌ | 🔴 누락 |

**판단: NEEDS IMPROVEMENT**

**권장 보완 E2E 시나리오:**
```typescript
// 추가 필요한 E2E 테스트
describe('Chat Session E2E - Extended', () => {
  it('should delete session and remove from list', async () => { /* ... */ });
  it('should switch between multiple sessions', async () => { /* ... */ });
  it('should handle empty session with default title', async () => { /* ... */ });
  it('should handle concurrent session access', async () => { /* ... */ });
});
```

---

### ❌ 롤백/복구 계획

| 항목 | 계획 여부 | 상태 |
|------|-----------|------|
| DB 마이그레이션 실패 시 롤백 | ❌ | 🔴 누락 |
| 기능 비활성화 방법 | ❌ | 🔴 누락 |
| 데이터 복구 절차 | ❌ | 🔴 누락 |
| 기존 버전으로 복귀 | ❌ | 🔴 누락 |

**판단: FAIL - 보완 필요**

**권장 보완:**
```markdown
## 롤백 계획

### DB 마이그레이션
- SQLite 파일(`.db`) 백업 후 마이그레이션 실행
- 실패 시 백업 파일로 복구

### 기능 플래그
- `ENABLE_SESSION_HISTORY` 환경 변수로 기능 ON/OFF
- OFF 시 기존 인메모리 동작으로 폴백

### 데이터 복구
- 세션 데이터 손상 시 복구 불가 (사용자 알림)
- 정기 백업 스크립트 권장
```

---

## 📋 기획자 검토 결과

### 판단: **REQUEST_CHANGES**

### 이유

1. **엣지 케이스 처리 미흡**: null/undefined, 빈 세션, DB 손상, 동시 접근 등 핵심 엣지 케이스에 대한 구체적 처리 방안이 누락됨

2. **에러 시나리오 미정의**: API 응답 코드(400, 403, 404, 409, 429, 500)별 에러 처리 스펙이 없음

3. **E2E 시나리오 불충분**: 세션 삭제, 다중 세션 전환, 빈 세션 처리 등 필수 사용자 시나리오가 누락됨

4. **롤백/복구 계획 부재**: DB 손상, 기능 비활성화, 데이터 복구 등에 대한 계획이 전혀 없음

### 누락된 요구사항

- 없음 (모든 요구사항은 계획에 반영됨)

### 엣지 케이스 (보완 필요)

| 우선순위 | 엣지 케이스 | 권장 처리 |
|----------|-------------|-----------|
| 🔴 High | null/undefined 입력 | Optional chaining + 기본값 |
| 🔴 High | 빈 세션 (messages: []) | 기본 타이틀 "새 대화" |
| 🔴 High | 존재하지 않는 세션 조회 | 404 응답 |
| 🟡 Medium | DB 손상/접근 실패 | 인메모리 폴백 + 사용자 알림 |
| 🟡 Medium | 동시 세션 수정 | SQLite 트랜잭션 |
| 🟢 Low | 잘못된 UUID 형식 | 400 응답 + 검증 미들웨어 |

---

## 권장 조치 사항

### 1. 엣지 케이스 보완 (필수)

```typescript
// SessionService에 추가
async getSession(id: string): Promise<ChatSession | null> {
  if (!id || !this.isValidUUID(id)) {
    return null; // 400 Bad Request 유도
  }
  try {
    return await this.db.query(...);
  } catch (e) {
    console.error('DB error:', e);
    return null; // 500 Internal Error 유도
  }
}
```

### 2. 에러 응답 스펙 추가 (필수)

```typescript
// API 에러 코드 정의
export const ErrorCodes = {
  SESSION_NOT_FOUND: { code: 'SESSION_NOT_FOUND', status: 404 },
  INVALID_SESSION_ID: { code: 'INVALID_SESSION_ID', status: 400 },
  DB_ERROR: { code: 'DB_ERROR', status: 500 },
  RATE_LIMITED: { code: 'RATE_LIMITED', status: 429 },
} as const;
```

### 3. E2E 테스트 보완 (권장)

- 세션 삭제 시나리오 추가
- 다중 세션 전환 시나리오 추가
- 빈 세션 생성 시나리오 추가

### 4. 롤백 계획 추가 (필수)

- DB 백업/복구 절차 문서화
- 기능 플래그(`ENABLE_SESSION_HISTORY`) 추가
- 기존 버전 복귀 절차 정의

---

## 재검토 조건

다음 항목이 보완되면 **APPROVE**로 변경 가능:

- [ ] 엣지 케이스 처리 방안 명시 (null, empty, DB 오류)
- [ ] API 에러 응답 코드 정의 (400, 404, 500 최소)
- [ ] 롤백/복구 계획 추가
- [ ] E2E 테스트 시나리오 보완 (삭제, 다중 세션)

---

**검토자**: 기획자 AI (Subagent)
**검토 완료일**: 2026-03-30
