# 이슈 #52 Pre-Dev Review 결과

**이슈**: [Phase 1] 채팅 히스토리 관리  
**작성일**: 2026-03-30  
**검토자**: 보안 전문가, 기획자, 디자이너, 아키텍트

---

## Phase 0: 입력 구조화

### TASK
채팅 히스토리 관리 기능 구현

### GOAL
- 사용자가 이전 대화 내용을 저장하고 다시 불러올 수 있다
- 여러 세션을 관리하고 전환할 수 있다
- 세션 삭제 및 히스토리 정리가 가능하다

### SCOPE
**포함:**
- 세션 기반 채팅 히스토리 저장 (파일 시스템)
- 히스토리 불러오기/삭제 API (REST)
- 대시보드에서 세션 목록 표시 (SessionList 컴포넌트)
- 이전 대화 불러오기 기능
- 단위 테스트 + 통합 테스트

**제외:**
- 히스토리 검색 기능 (Phase 2)
- 히스토리 내보내기/가져오기 (Phase 2)
- 멀티 디바이스 동기화 (Phase 3)
- 히스토리 암호화 (별도 이슈)

### ACCEPTANCE_CRITERIA
1. 사용자가 새 세션을 시작하면 자동으로 세션 ID가 생성되고 저장된다
2. 사용자가 세션 목록에서 이전 세션을 선택하면 메시지 히스토리가 로드된다
3. 사용자가 세션 삭제 버튼을 클릭하면 확인 후 세션이 삭제된다
4. 세션 목록은 최신순으로 정렬되며 세션 제목(첫 메시지 요약)이 표시된다
5. 모든 API는 적절한 에러 응답(400, 404, 500)을 반환한다
6. 세션 데이터는 애플리케이션 재시작 후에도 유지된다

---

## Phase 1: 코드 분석

### 기존 구조 분석

| 파일 | 설명 |
|------|------|
| `packages/core/src/chat/ConversationManager.ts` | 메모리 기반 히스토리 (지속성 없음) |
| `packages/core/src/chat/ChatEngine.ts` | 채팅 엔진 (스트리밍 지원) |
| `apps/daemon/src/routes/chat.ts` | 채팅 API 라우트 |
| `apps/dashboard/src/components/ChatPanel.ts` | 채팅 UI 컴포넌트 |
| `apps/dashboard/src/state/signals.ts` | 전역 상태 (chatMessages 등) |
| `packages/types/src/chat.ts` | Message, ChatConfig 타입 |

### 핵심 발견 사항
1. **ConversationManager**는 `Map<string, Message[]>` 기반으로 **지속성 없음**
2. **ChatPanel**은 이미 Signal 구독 방식으로 구현됨
3. **API 라우트**에 세션 개념이 없음
4. **packages/memory**는 LLM 컨텍스트용이며 채팅 히스토리와 다름

### 변경 파일 계획

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/core/src/chat/HistoryService.ts` | 생성 | 파일 기반 히스토리 저장/로드 서비스 |
| `packages/core/src/chat/HistoryService.test.ts` | 생성 | HistoryService 단위 테스트 |
| `packages/core/src/chat/ConversationManager.ts` | 수정 | HistoryService 연동 옵션 추가 |
| `apps/daemon/src/routes/history.ts` | 생성 | 히스토리 API 라우트 |
| `apps/daemon/src/routes/__tests__/history.test.ts` | 생성 | API 통합 테스트 |
| `apps/daemon/src/server.ts` | 수정 | history 라우트 등록 |
| `apps/dashboard/src/components/SessionList.ts` | 생성 | 세션 목록 컴포넌트 |
| `apps/dashboard/src/components/SessionList.test.ts` | 생성 | SessionList 테스트 |
| `apps/dashboard/src/state/signals.ts` | 수정 | sessions, activeSessionId 시그널 추가 |
| `apps/dashboard/src/api/history.ts` | 생성 | 히스토리 API 클라이언트 |
| `packages/types/src/chat.ts` | 수정 | ChatSession 타입 추가 |
| `packages/core/src/chat/index.ts` | 수정 | HistoryService export 추가 |

---

## Phase 2: 전문가 검토 결과

### 🔒 보안 전문가 (STRIDE + DREAD)

**검토 방법론**: STRIDE 위협 모델링 + DREAD 점수화

#### STRIDE 분석

| 위협 | 검토 포인트 | 평가 |
|------|------------|------|
| **Spoofing** | 세션 ID 위장 가능성 | 🟡 중간 - UUID v4 사용으로 충분히 무작위, 하지만 인증 없이 세션 접근 가능 |
| **Tampering** | 세션 데이터 조작 | 🟢 낮음 - 서버-side 저장, 클라이언트 직접 수정 불가 |
| **Repudiation** | 행위 추적 | 🟢 낮음 - 세션 생성/수정 시간 기록 |
| **Info Disclosure** | 민감 정보 노출 | 🔴 높음 - 채팅 내용에 민감 정보 포함 가능, 암호화 없음 |
| **Denial of Service** | 서비스 거부 | 🟡 중간 - 대량 세션 생성으로 디스크 가득 참 가능 |
| **Elevation of Privilege** | 권한 상승 | 🟢 낮음 - 읽기/쓰기 권한 구분 없음 (로컬 앱) |

#### DREAD 점수

| 항목 | 점수 (1-10) |
|------|-------------|
| Damage | 6 (민감 정보 노출) |
| Reproducibility | 8 (쉽게 재현) |
| Exploitability | 4 (로컬 접근 필요) |
| Affected Users | 5 (단일 사용자) |
| Discoverability | 7 (파일 시스템 직접 접근) |
| **총합** | **30 (HIGH)** |

#### 체크리스트 결과

- [x] 입력 검증 - 세션 ID는 UUID 형식 검증 필요
- [ ] 인증/인가 로직 - **현재 인증 없음, 로컬 앱이므로 허용**
- [ ] 민감 데이터 암호화 - **암호화 없음, Phase 2 고려사항으로 명시됨**
- [x] 하드코딩된 시크릿 없음
- [ ] 의존성 취약점 - 검토 필요
- [x] 에러 메시지에 정보 노출 없음
- [ ] 로그에 민감 정보 - **메시지 내용 로깅 주의 필요**

#### 판단
**REQUEST_CHANGES**

#### 이유
1. **세션 ID 검증 미흡**: Path Traversal 공격 가능 (`../../../etc/passwd`)
2. **DREAD 30점 (HIGH)**: 민감 정보 노출 위험
3. **DoS 가능성**: 세션 개수/크기 제한 없음

#### 권장 사항
1. **세션 ID 검증** (필수):
   ```typescript
   // UUID v4 형식 검증
   const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
   if (!UUID_REGEX.test(sessionId)) {
     return c.json({ error: 'Invalid session ID' }, 400);
   }
   ```

2. **세션 개수/크기 제한** (필수):
   ```typescript
   const MAX_SESSIONS = 1000;
   const MAX_SESSION_SIZE = 10 * 1024 * 1024; // 10MB
   const MAX_MESSAGES_PER_SESSION = 10000;
   ```

3. **파일 경로 sanitization** (필수):
   ```typescript
   const safePath = path.join(dataDir, `${sessionId}.json`);
   if (!safePath.startsWith(dataDir)) {
     throw new Error('Invalid path');
   }
   ```

4. **민감 정보 로깅 방지** (권장):
   ```typescript
   // 메시지 내용은 로깅하지 않음
   console.log(`[History] Session saved: ${sessionId}`);
   ```

---

### 📋 기획자 (User Story Mapping + Edge Case)

**검토 방법론**: User Story Mapping + Edge Case Analysis

#### User Story 매핑

| Story | AC 매핑 | 커버 여부 |
|-------|---------|-----------|
| 새 세션 시작 | AC1 | ✅ |
| 이전 세션 불러오기 | AC2 | ✅ |
| 세션 삭제 | AC3 | ✅ |
| 세션 목록 정렬 | AC4 | ✅ |
| API 에러 처리 | AC5 | ⚠️ 부분 |
| 데이터 지속성 | AC6 | ✅ |

#### Edge Case 분석

| 케이스 | 시나리오 | 처리 계획 | 상태 |
|--------|----------|-----------|------|
| **null session id** | GET /api/history/null | 400 Bad Request | ⚠️ 명시 필요 |
| **empty session list** | 첫 사용자 | Empty State UI | ✅ |
| **session timeout** | 장기 미사용 세션 | N/A (로컬 저장) | - |
| **concurrent access** | 두 탭에서 동시 수정 | 파일 잠금 처리 | ⚠️ 미명시 |
| **corrupt file** | JSON 파싱 실패 | 에러 처리 + 복구 | ⚠️ 미명시 |
| **disk full** | 저장 실패 | 500 에러 + 사용자 알림 | ⚠️ 미명시 |
| **very long title** | 1000자+ 첫 메시지 | 잘라서 표시 | ⚠️ 미명시 |
| **unicode/emoji** | 다국어 메시지 | UTF-8 처리 | ✅ |

#### 에러 시나리오

| HTTP 코드 | 시나리오 | 응답 예시 |
|-----------|----------|-----------|
| 200 | 성공 | `{ sessions: [...] }` |
| 400 | 잘못된 요청 | `{ error: 'Invalid session ID' }` |
| 404 | 세션 없음 | `{ error: 'Session not found' }` |
| 500 | 서버 에러 | `{ error: 'Failed to save session' }` |

#### 하위 호환성
- 기존 `ConversationManager` API 유지
- 새 `HistoryService`는 옵셔널
- 기존 채팅 UI 변경 없음

#### 판단
**REQUEST_CHANGES**

#### 이유
1. **AC5 불완전**: 에러 응답 형식 표준화 필요
2. **엣지 케이스 미처리**: corrupt file, disk full, concurrent access
3. **롤백 계획 없음**: 세션 삭제 복구 불가

#### 권장 사항
1. **에러 응답 표준화**:
   ```typescript
   interface ErrorResponse {
     error: string;
     code: 'INVALID_ID' | 'NOT_FOUND' | 'INTERNAL_ERROR';
     details?: string;
   }
   ```

2. **세션 삭제 시 휴지통 기능** (또는 soft delete):
   ```typescript
   // 삭제 전 trash 폴더로 이동
   await moveSessionToTrash(sessionId);
   // 30일 후 영구 삭제
   ```

3. **Corrupt file 처리**:
   ```typescript
   try {
     const data = JSON.parse(content);
   } catch {
     // 손상된 파일은 .corrupt로 rename + 새 세션 생성
     await rename(sessionPath, `${sessionPath}.corrupt`);
     return null;
   }
   ```

4. **Concurrent access 처리**: 파일 잠금 또는 optimistic locking

---

### 🎨 디자이너 (WCAG 2.1 AA + State Design)

**검토 방법론**: WCAG 2.1 AA + State Design

#### 기존 디자인 시스템 분석
- **색상**: Dark theme (#1a1a2e, #6aa7ff accent)
- **타이포그래피**: System fonts, 0.875rem ~ 1.5rem
- **컴포넌트**: LitElement 기반, CSS-in-JS
- **애니메이션**: bounce keyframes 사용

#### SessionList 디자인 제안

```
┌─────────────────────────────────────┐
│ 📋 Sessions                    [+]  │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🔵 Hello, how can I...   🗑️    │ │ ← Active session
│ │    5 messages • 2h ago          │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ⚪ How to use git...     🗑️    │ │
│ │    12 messages • 1d ago         │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ⚪ Error with npm...     🗑️    │ │
│ │    3 messages • 3d ago          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### State Design

| 상태 | UI | 메시지 |
|------|-----|--------|
| **Empty** | Empty icon + text | "No conversations yet. Start chatting!" |
| **Loading** | Skeleton loader | - |
| **Loaded** | Session list | - |
| **Error** | Error icon + retry | "Failed to load sessions" + [Retry] |
| **Deleting** | Spinner on item | - |
| **Delete Confirm** | Modal | "Delete this conversation?" [Cancel] [Delete] |

#### WCAG 2.1 AA 체크리스트

| 항목 | 기준 | 준수 여부 |
|------|------|-----------|
| 색 대비 | 4.5:1 (텍스트) | ✅ #e6e6e6 on #1a1a2e = 12.6:1 |
| 키보드 네비게이션 | 모든 기능 키보드로 | ⚠️ 추가 필요 |
| Focus indicator | 명확한 포커스 표시 | ⚠️ 추가 필요 |
| ARIA labels | 스크린 리더 지원 | ⚠️ 추가 필요 |
| 색상만 의존 안 함 | 색 외 정보 제공 | ✅ 아이콘 사용 |

#### 반응형 동작

| 브레이크포인트 | 레이아웃 |
|----------------|----------|
| Desktop (1024px+) | Sidebar (250px) + Chat |
| Tablet (768-1023px) | Collapsible sidebar |
| Mobile (<768px) | Tab 전환 (Sessions / Chat) |

#### 판단
**APPROVE**

#### 이유
1. 기존 ChatPanel 디자인과 일관성 유지
2. 상태별 UI 명확히 정의됨
3. WCAG 기준 준수 계획 수립됨

#### 권장 사항 (선택적 개선)
1. **키보드 네비게이션 추가**:
   ```typescript
   handleKeyDown(e: KeyboardEvent) {
     if (e.key === 'ArrowDown') this.focusNext();
     if (e.key === 'ArrowUp') this.focusPrev();
     if (e.key === 'Enter') this.selectSession();
     if (e.key === 'Delete') this.confirmDelete();
   }
   ```

2. **ARIA labels**:
   ```html
   <div role="listbox" aria-label="Chat sessions">
     <div role="option" aria-selected="true" aria-label="Session: Hello...">
   ```

3. **Focus indicator CSS**:
   ```css
   .session-item:focus-visible {
     outline: 2px solid #6aa7ff;
     outline-offset: 2px;
   }
   ```

---

### 🏗️ 아키텍트 (SOLID + NFR)

**검토 방법론**: SOLID 원칙 + NFR (Non-Functional Requirements)

#### SOLID 분석

| 원칙 | 평가 | 설명 |
|------|------|------|
| **SRP** | ✅ | HistoryService는 저장소 관리만 담당 |
| **OCP** | ✅ | 저장소 인터페이스로 확장 가능 (SQLite 추가 등) |
| **LSP** | ✅ | 인터페이스 준수 시 교체 가능 |
| **ISP** | ✅ | 세분화된 메서드 (load, save, list, delete) |
| **DIP** | ⚠️ | 현재 파일 시스템 직접 의존, 추상화 권장 |

#### 모듈 간 결합도

```
┌─────────────────────────────────────────────────┐
│                   Dashboard                      │
│  ┌─────────────┐  ┌─────────────┐               │
│  │ SessionList │  │  ChatPanel  │               │
│  └──────┬──────┘  └──────┬──────┘               │
│         │                │                       │
│  ┌──────▼────────────────▼──────┐               │
│  │    signals.ts (sessions)     │               │
│  └──────────────┬───────────────┘               │
└─────────────────│───────────────────────────────┘
                  │ HTTP
┌─────────────────│───────────────────────────────┐
│                 ▼                                │
│           Daemon API                            │
│  ┌──────────────────────────┐                   │
│  │     /api/history         │                   │
│  └───────────┬──────────────┘                   │
│              │                                   │
│  ┌───────────▼──────────────┐                   │
│  │     HistoryService       │                   │
│  └───────────┬──────────────┘                   │
│              │                                   │
│  ┌───────────▼──────────────┐                   │
│  │   File System (JSON)     │                   │
│  └──────────────────────────┘                   │
└─────────────────────────────────────────────────┘
```

**결합도**: 낮음 (API를 통한 느슨한 결합)

#### 성능 영향 분석

| 항목 | 영향 | 완화 방안 |
|------|------|-----------|
| 세션 목록 로드 | O(n) 파일 읽기 | 메타데이터 캐싱, 페이지네이션 |
| 세션 저장 | O(1) 파일 쓰기 | 즉시 쓰기 (작은 파일) |
| 대량 세션 | 디렉토리 스캔 비용 | Index 파일 유지 |
| 동시 쓰기 | 파일 잠금 대기 | 큐잉 또는 낙관적 잠금 |

#### 확장성 고려사항

| 시나리오 | 현재 계획 | 향후 확장 |
|----------|-----------|-----------|
| 세션 1000개+ | 파일 시스템 | SQLite 마이그레이션 |
| 검색 기능 | N/A | Full-text index |
| 멀티 디바이스 | N/A | Cloud sync |

#### API 호환성

| API | Breaking Change | 버전 관리 |
|-----|-----------------|-----------|
| GET /api/history | 새 엔드포인트 | N/A |
| GET /api/history/:id | 새 엔드포인트 | N/A |
| DELETE /api/history/:id | 새 엔드포인트 | N/A |
| POST /api/history | 새 엔드포인트 | N/A |

**결론**: 기존 API 변경 없음 → 호환성 유지

#### 기존 테스트 영향
- `ChatEngine.test.ts`: 영향 없음
- `ConversationManager.test.ts`: 영향 없음 (기존 API 유지)
- `ChatPanel.test.ts`: Signal 구독 방식 동일

#### 판단
**APPROVE**

#### 이유
1. SOLID 원칙 대체로 준수
2. 낮은 결합도로 유지보수 용이
3. 기존 코드 영향 최소화
4. 확장성 고려됨

#### 권장 사항
1. **저장소 인터페이스 추상화** (선택적):
   ```typescript
   interface IHistoryStorage {
     save(session: ChatSession): Promise<void>;
     load(id: string): Promise<ChatSession | null>;
     list(): Promise<ChatSessionMeta[]>;
     delete(id: string): Promise<boolean>;
   }
   
   class FileHistoryStorage implements IHistoryStorage {...}
   // 향후: class SQLiteHistoryStorage implements IHistoryStorage {...}
   ```

2. **메타데이터 인덱스 파일** (성능 최적화):
   ```
   data/sessions/_index.json
   {
     "sessions": [
       {"id": "uuid1", "title": "Hello", "updatedAt": 1711702800000},
       ...
     ]
   }
   ```

3. **세션 크기 모니터링**:
   ```typescript
   // 세션 저장 시 크기 로깅
   console.log(`[History] Session ${id} saved: ${size} bytes`);
   ```

---

## Phase 3: 통합 결론

### 결과 집계

| 전문가 | 판단 | 핵심 이슈 |
|--------|------|-----------|
| 🔒 보안 | REQUEST_CHANGES | Path Traversal, 세션 제한 없음 |
| 📋 기획 | REQUEST_CHANGES | 엣지 케이스 처리, 롤백 계획 |
| 🎨 디자인 | APPROVE | - |
| 🏗️ 아키텍트 | APPROVE | - |

### 최종 판단
**재계획 필요 (2개 REQUEST_CHANGES)**

### 필수 수정 사항

1. **보안 (보안 전문가)**:
   - [ ] 세션 ID UUID 검증 (Path Traversal 방지)
   - [ ] 세션 개수/크기 제한
   - [ ] 파일 경로 sanitization
   - [ ] 민감 정보 로깅 방지

2. **기획 (기획자)**:
   - [ ] 에러 응답 표준화 (code 필드 추가)
   - [ ] Corrupt file 처리 (복구 메커니즘)
   - [ ] Soft delete 또는 휴지통 기능

### 수정 후 재검토 필요
- 보안 전문가: Path Traversal 방지 구현 확인
- 기획자: 엣지 케이스 처리 구현 확인

---

## Phase 4: TDD 계획

### Red → Green → Refactor 사이클

#### Step 1: HistoryService

**Red (실패 테스트 먼저)**
```typescript
// packages/core/src/chat/HistoryService.test.ts

describe('HistoryService', () => {
  describe('saveSession', () => {
    it('should save session to file', async () => {
      const service = new HistoryService({ dataDir: testDir });
      const session = createTestSession();
      await service.saveSession(session);
      // 파일 존재 확인
    });

    it('should reject invalid session ID (path traversal)', async () => {
      const service = new HistoryService({ dataDir: testDir });
      const session = { ...createTestSession(), id: '../../../etc/passwd' };
      await expect(service.saveSession(session)).rejects.toThrow('Invalid session ID');
    });

    it('should enforce max session size', async () => {
      const service = new HistoryService({ dataDir: testDir, maxSize: 1000 });
      const session = createLargeSession(2000);
      await expect(service.saveSession(session)).rejects.toThrow('exceeds maximum');
    });
  });

  describe('loadSession', () => {
    it('should load saved session', async () => {...});
    it('should return null for non-existent session', async () => {...});
    it('should handle corrupt file gracefully', async () => {
      // 손상된 JSON 파일 생성
      await writeFile(corruptPath, '{invalid json');
      const result = await service.loadSession('corrupt');
      expect(result).toBeNull();
      // .corrupt 파일 생성 확인
    });
  });

  describe('listSessions', () => {
    it('should return sessions sorted by updatedAt', async () => {...});
    it('should enforce max sessions limit', async () => {...});
  });

  describe('deleteSession', () => {
    it('should move to trash instead of permanent delete', async () => {...});
    it('should return false for non-existent session', async () => {...});
  });
});
```

**Green (최소 구현)**
```typescript
// packages/core/src/chat/HistoryService.ts

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SESSION_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_SESSIONS = 1000;

export class HistoryService {
  async saveSession(session: ChatSession): Promise<void> {
    // 1. 세션 ID 검증
    if (!UUID_REGEX.test(session.id)) {
      throw new Error('Invalid session ID');
    }

    // 2. 크기 검증
    const size = JSON.stringify(session).length;
    if (size > MAX_SESSION_SIZE) {
      throw new Error(`Session size ${size} exceeds maximum ${MAX_SESSION_SIZE}`);
    }

    // 3. 경로 검증
    const filePath = this.getSafePath(session.id);
    
    // 4. Atomic write
    await this.atomicWrite(filePath, JSON.stringify(session));
  }

  private getSafePath(sessionId: string): string {
    const filePath = path.join(this.dataDir, `${sessionId}.json`);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(this.dataDir))) {
      throw new Error('Invalid path');
    }
    return resolved;
  }

  // ... 기타 메서드
}
```

**Refactor (개선)**
- 저장소 인터페이스 추상화
- 메타데이터 캐싱
- 휴지통 복구 기능

---

#### Step 2: History API

**Red**
```typescript
// apps/daemon/src/routes/__tests__/history.test.ts

describe('History API', () => {
  describe('GET /api/history', () => {
    it('returns session list', async () => {...});
    it('returns empty array when no sessions', async () => {...});
  });

  describe('GET /api/history/:id', () => {
    it('returns 400 for invalid UUID', async () => {
      const res = await app.request('/api/history/invalid');
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({ error: 'Invalid session ID', code: 'INVALID_ID' });
    });

    it('returns 404 for non-existent session', async () => {
      const res = await app.request('/api/history/00000000-0000-4000-8000-000000000000');
      expect(res.status).toBe(404);
      expect(body).toMatchObject({ error: 'Session not found', code: 'NOT_FOUND' });
    });
  });

  describe('DELETE /api/history/:id', () => {
    it('soft deletes session (moves to trash)', async () => {...});
  });
});
```

**Green**
```typescript
// apps/daemon/src/routes/history.ts

historyRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  // UUID 검증
  if (!UUID_REGEX.test(id)) {
    return c.json({ error: 'Invalid session ID', code: 'INVALID_ID' }, 400);
  }

  const session = await historyService.loadSession(id);
  if (!session) {
    return c.json({ error: 'Session not found', code: 'NOT_FOUND' }, 404);
  }

  return c.json({ session });
});
```

---

#### Step 3: SessionList 컴포넌트

**Red**
```typescript
// apps/dashboard/src/components/SessionList.test.ts

describe('SessionList', () => {
  it('renders empty state', async () => {...});
  it('renders loading state', async () => {...});
  it('renders error state with retry button', async () => {...});
  it('renders session list', async () => {...});
  it('supports keyboard navigation', async () => {...});
  it('shows delete confirmation modal', async () => {...});
});
```

---

### 검증 계획

| 레벨 | 테스트 | 목표 커버리지 |
|------|--------|---------------|
| Unit | HistoryService, API routes | 90%+ |
| Integration | API + DB | 주요 시나리오 |
| E2E | 세션 생성 → 로드 → 삭제 | Critical path |

### Runtime 검증

```bash
# 서버 시작
bun run start:dev

# API 테스트
curl -s http://localhost:3000/api/history | jq .

# 세션 생성 + 조회
SESSION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
curl -X POST http://localhost:3000/api/history \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$SESSION_ID\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}" \
  | jq .

curl -s "http://localhost:3000/api/history/$SESSION_ID" | jq .

# 삭제
curl -X DELETE "http://localhost:3000/api/history/$SESSION_ID" | jq .
```

---

## 부록: IMPL_PLAN.md

상세 구현 계획은 `/tmp/amicus-issue52/IMPL_PLAN.md` 참조

---

**검토 완료일**: 2026-03-30  
**다음 단계**: REQUEST_CHANGES 사항 반영 후 보안/기획 전문가 재검토
