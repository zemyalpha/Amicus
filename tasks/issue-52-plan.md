# Pre-Dev Review: 이슈 #52 [Phase 1] 채팅 히스토리 관리

## Phase 0: 입력 구조화

```
TASK: 채팅 히스토리 관리 기능 구현
GOAL: 사용자 대화 이력을 세션 단위로 저장/불러오기/삭제하여 재사용 가능하게 함
SCOPE:
  - 포함: 세션 생성/저장/불러오기/삭제 API, 대시보드 세션 목록 UI, 히스토리 영속성
  - 제외: 사용자 인증 (별도 이슈), 채팅 UI 자체 (PR #54 완료), SSE 스트리밍 (PR #53 완료)
CONTEXT:
  - SSE 스트리밍 API 완료 (PR #53 MERGED)
  - 채팅 UI 완료 (PR #54 MERGED)
  - ConversationManager 클래스 존재하나 미사용, 인메모리만 지원
ACCEPTANCE_CRITERIA:
  1. 세션 생성: 새 채팅 세션 생성 시 고유 ID 부여 및 저장
  2. 히스토리 저장: 대화 종료 시(페이지 이동, done 수신 등) 메시지 히스토리 자동 저장
  3. 세션 목록: 대시보드에서 저장된 세션 목록 조회 가능
  4. 세션 불러오기: 이전 세션 선택 시 히스토리 복원
  5. 세션 삭제: 세션 삭제 기능 제공
  6. 영속성: 앱 재시작 후에도 세션 보존
TEST_FOCUS:
  - 세션 CRUD 단위 테스트
  - API 엔드포인트 통합 테스트
  - UI 세션 목록 표시 E2E 테스트
```

---

## Phase 1: 이슈 & 코드 분석

### 1.1 기존 코드 구조

| 패키지 | 파일 | 역할 | 상태 |
|--------|------|------|------|
| `@amicus/types` | `chat.ts` | Message, ChatConfig, StreamChunk 타입 정의 | ✅ 완료 |
| `@amicus/core` | `ChatEngine.ts` | 채팅 엔진 (chat, chatStream) | ✅ 완료 |
| `@amicus/core` | `ConversationManager.ts` | 세션 관리자 (미사용) | ⚠️ 인메모리만 |
| `apps/daemon` | `routes/chat.ts` | 채팅 API 엔드포인트 | ✅ 스트리밍 완료 |
| `apps/dashboard` | `ChatPanel.ts` | 채팅 UI 컴포넌트 | ✅ 완료 |
| `apps/dashboard` | `signals.ts` | 글로벌 상태 (chatMessages signal) | ⚠️ 휘발성 |

### 1.2 현재 문제점

1. **ConversationManager 미사용**: ChatEngine에서 ConversationManager를 사용하지 않음
2. **인메모리만 지원**: ConversationManager가 Map 기반으로 영속성 없음
3. **Signal 휘발성**: `chatMessages` signal이 페이지 새로고침 시 초기화됨
4. **세션 개념 없음**: 단일 대화만 가능, 여러 세션 관리 불가

### 1.3 수정 계획

## 변경 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/types/src/chat.ts` | 수정 | ChatSession 타입 추가 |
| `packages/core/src/chat/ConversationManager.ts` | 수정 | 영속성 추가 (SQLite/Bun 기본 파일 저장) |
| `apps/daemon/src/routes/chat.ts` | 수정 | 세션 API 추가 (GET/DELETE) |
| `apps/daemon/src/services/SessionService.ts` | 생성 | 세션 관리 서비스 |
| `apps/dashboard/src/state/signals.ts` | 수정 | sessions signal, activeSessionId 추가 |
| `apps/dashboard/src/components/ChatPanel.ts` | 수정 | 세션 자동 저장 로직 |
| `apps/dashboard/src/components/SessionList.ts` | 생성 | 세션 목록 컴포넌트 |
| `apps/dashboard/src/api/chat.ts` | 수정 | 세션 API 함수 추가 |

---

## Phase 2: 다중 전문가 검토 (간소화)

### 🔒 보안 검토

| 위협 | 검토 포인트 | 판단 |
|------|------------|------|
| Tampering | 세션 데이터 무결성 | ✅ 로컬 파일/SQLite 사용 |
| Info Disclosure | 채팅 내용 노출 | ⚠️ 암호화 고려 필요 (Phase 2+에서 처리) |
| Repudiation | 세션 삭제 추적 | N/A - 사용자 요청에 의한 삭제 |

**체크리스트:**
- [x] 민감 데이터 암호화는 Phase 2+로 이관 (현재 로컬 저장만)
- [x] 세션 ID는 UUID 사용 (추측 불가)
- [x] 파일 저장은 앱 데이터 디렉토리로 제한 (path traversal 방지)

**결과: APPROVE** (Phase 1 범위 내에서 적절)

### 🏗️ 아키텍처 검토

**체크리스트:**
- [x] 단일 책임 원칙: SessionService로 세션 관리 분리
- [x] 기존 의존성 활용: ConversationManager 확장
- [x] API 호환성: 기존 `/api/chat/stream` 유지, 새 엔드포인트 추가
- [x] 성능: SQLite 인덱싱으로 세션 목록 조회 최적화

**데이터 모델:**
```typescript
interface ChatSession {
  id: string;           // UUID
  title: string;        // 첫 메시지 기반 자동 생성 또는 사용자 지정
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
```

**저장 방식 옵션 분석:**
| 방식 | 장점 | 단점 |
|------|------|------|
| JSON 파일 | 단순, 디버깅 용이 | 동시성 문제, 대량 세션 시 성능 |
| SQLite | 인덱싱, 트랜잭션, 표준 | 의존성 추가 |
| Bun SQLite (내장) | 의존성 없음, 빠름 | Bun 전용 |

**선택: Bun 내장 SQLite** (`bun:sqlite`) - 추가 의존성 없이 사용 가능

**결과: APPROVE**

---

## Phase 3: TDD 계획

### Step 1: 세션 타입 정의

**Red:**
```typescript
// packages/types/src/chat.ts
describe('ChatSession', () => {
  it('should create a valid session', () => {
    const session: ChatSession = {
      id: 'test-id',
      title: 'Test Session',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(session.id).toBe('test-id');
  });
});
```

**Green:** ChatSession 인터페이스 추가

### Step 2: SessionService 구현

**Red:**
```typescript
// apps/daemon/src/services/SessionService.test.ts
describe('SessionService', () => {
  it('should create a new session', async () => {
    const service = new SessionService(':memory:');
    const session = await service.createSession();
    expect(session.id).toBeDefined();
    expect(session.messages).toEqual([]);
  });

  it('should save and load messages', async () => {
    const service = new SessionService(':memory:');
    const session = await service.createSession();
    await service.addMessage(session.id, { role: 'user', content: 'Hello' });
    const loaded = await service.getSession(session.id);
    expect(loaded?.messages).toHaveLength(1);
  });

  it('should list sessions', async () => {
    const service = new SessionService(':memory:');
    await service.createSession();
    await service.createSession();
    const sessions = await service.listSessions();
    expect(sessions).toHaveLength(2);
  });

  it('should delete a session', async () => {
    const service = new SessionService(':memory:');
    const session = await service.createSession();
    await service.deleteSession(session.id);
    const loaded = await service.getSession(session.id);
    expect(loaded).toBeNull();
  });
});
```

**Green:** SessionService 구현 (Bun SQLite 사용)

### Step 3: API 엔드포인트

**Red:**
```typescript
// apps/daemon/src/routes/__tests__/chat-sessions.test.ts
describe('Chat Sessions API', () => {
  it('GET /api/chat/sessions returns session list', async () => {
    const res = await app.request('/api/chat/sessions');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  it('GET /api/chat/sessions/:id returns session with messages', async () => {
    // 세션 생성 후 조회
  });

  it('DELETE /api/chat/sessions/:id deletes session', async () => {
    // 세션 생성 후 삭제
  });
});
```

**Green:** chat.ts에 세션 라우트 추가

### Step 4: 프론트엔드 세션 목록

**Red:**
```typescript
// apps/dashboard/src/components/SessionList.test.ts
describe('SessionList', () => {
  it('should render session list', async () => {
    // 세션 목록 표시 테스트
  });

  it('should call onSelect when session clicked', async () => {
    // 세션 선택 이벤트
  });

  it('should call onDelete when delete clicked', async () => {
    // 세션 삭제 이벤트
  });
});
```

**Green:** SessionList 컴포넌트 구현

### Step 5: 통합 테스트

**Red:**
```typescript
// apps/dashboard/tests/chat-history.e2e.ts
describe('Chat History E2E', () => {
  it('should save and restore chat session', async () => {
    // 1. 메시지 전송
    // 2. 페이지 새로고침
    // 3. 세션 목록에서 이전 대화 확인
    // 4. 세션 선택 시 메시지 복원
  });
});
```

**Green:** 전체 기능 구현 후 통합

---

## 구현 단계 상세

### Step 1: 타입 정의 및 SessionService (백엔드)

**파일:**
1. `packages/types/src/chat.ts` - ChatSession 타입 추가
2. `apps/daemon/src/services/SessionService.ts` - 생성
3. `apps/daemon/src/services/SessionService.test.ts` - 테스트

**세부 내용:**
```typescript
// packages/types/src/chat.ts
export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionListResponse {
  sessions: Pick<ChatSession, 'id' | 'title' | 'createdAt' | 'updatedAt'>[];
}
```

### Step 2: API 엔드포인트 확장

**파일:**
1. `apps/daemon/src/routes/chat.ts` - 세션 라우트 추가
2. `apps/daemon/src/routes/__tests__/chat-sessions.test.ts` - 테스트

**API 설계:**
```
GET    /api/chat/sessions          -> SessionListResponse
GET    /api/chat/sessions/:id      -> ChatSession
DELETE /api/chat/sessions/:id      -> { success: boolean }
POST   /api/chat/sessions          -> ChatSession (새 세션 생성)
PATCH  /api/chat/sessions/:id      -> ChatSession (타이틀 수정 등)
```

### Step 3: 프론트엔드 상태 관리

**파일:**
1. `apps/dashboard/src/state/signals.ts` - sessions, activeSessionId 추가
2. `apps/dashboard/src/api/chat.ts` - 세션 API 함수

**Signal 확장:**
```typescript
// signals.ts
export const sessions = signal<SessionSummary[]>([]);
export const activeSessionId = signal<string | null>(null);
export const sessionsLoading = signal(false);
```

### Step 4: UI 컴포넌트

**파일:**
1. `apps/dashboard/src/components/SessionList.ts` - 생성
2. `apps/dashboard/src/components/SessionList.test.ts` - 테스트
3. `apps/dashboard/src/components/ChatPanel.ts` - 자동 저장 로직

**SessionList UI:**
- 세션 목록 (제목, 날짜)
- 세션 선택 버튼
- 세션 삭제 버튼
- 새 세션 생성 버튼

### Step 5: ChatPanel 통합

**변경 사항:**
1. 메시지 전송 후 자동 저장
2. 스트림 완료(`done`) 시 세션 업데이트
3. 세션 전환 시 메시지 교체

---

## 위험도 평가

| 항목 | 영향 | 대응 |
|------|------|------|
| 보안 영향 | ⚠️ 중간 | 로컬 저장만, 암호화는 Phase 2+ |
| 성능 영향 | ✅ 낮음 | SQLite 인덱싱, 메시지는 최대 100개 제한 |
| 하위 호환성 | ✅ 없음 | 새 기능 추가, 기존 API 유지 |
| 기존 기능 영향 | ✅ 없음 | ChatPanel은 기존 동작 유지 |

---

## 전문가 검토 결과

| 전문가 | 판단 | 비고 |
|--------|------|------|
| 🔒 보안 | **APPROVE** | Phase 1 범위 적절, 암호화는 추후 |
| 📋 기획 | N/A | 요구사항 명확 |
| 🎨 디자인 | N/A | 기존 UI 스타일 준용 |
| 🏗️ 아키텍트 | **APPROVE** | Bun SQLite 선택 적절 |

---

## 개발 시작 조건

- [x] 모든 전문가 APPROVE
- [x] TDD 계획 수립 완료
- [x] 변경 파일 목록 확정
- [x] 위험도 평가 완료

## 다음 단계

1. **Step 1**부터 순차적 TDD 개발 시작
2. 각 단계 완료 후 테스트 통과 확인
3. 모든 단계 완료 후 통합 테스트 실행
4. PR 생성 및 리뷰 요청

---

## 메모리 기록용

```markdown
### [Phase 1] 채팅 히스토리 관리 Pre-Dev Review 완료
- 전문가 검토: 보안 ✅ 아키텍트 ✅
- 저장 방식: Bun 내장 SQLite
- API: GET/POST/PATCH/DELETE /api/chat/sessions
- UI: SessionList 컴포넌트 추가
- TDD: 5단계 계획 수립
```
