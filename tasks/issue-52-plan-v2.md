# 이슈 #52 수정 계획 v2

**이슈**: [Phase 1] 채팅 히스토리 관리  
**작성일**: 2026-03-30  
**버전**: v2 (1차 검토 피드백 반영)

---

## 1차 검토 피드백 요약

### 🔒 보안 전문가 요청 사항
| 항목 | 설명 | 우선순위 |
|------|------|----------|
| UUID 검증 | Path Traversal 방지 | 필수 |
| 크기 제한 | 세션당 10MB | 필수 |
| 개수 제한 | 최대 1000개 세션 | 필수 |
| 경로 검증 | `path.resolve`로 검증 | 필수 |
| 로깅 보안 | 메시지 내용 로깅 금지 | 권장 |

### 📋 기획자 요청 사항
| 항목 | 설명 | 우선순위 |
|------|------|----------|
| 에러 표준화 | `code` 필드 추가 | 필수 |
| Corrupt 처리 | `.corrupt` 파일로 이동 | 필수 |
| Soft delete | 휴지통 기능 | 필수 |
| Concurrent access | 파일 잠금 | 권장 |

---

## v2 수정 계획

### 1. 보안: HistoryService 강화

```typescript
// packages/core/src/chat/HistoryService.ts

import { randomUUID } from 'crypto';
import { path as pathModule } from 'fs';

// 상수 정의
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SESSION_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_SESSIONS = 1000;
const MAX_MESSAGES_PER_SESSION = 10000;

export interface HistoryServiceConfig {
  dataDir: string;
  maxSize?: number;
  maxSessions?: number;
  maxMessages?: number;
}

export class HistoryService {
  private readonly dataDir: string;
  private readonly trashDir: string;
  private readonly corruptDir: string;
  private readonly maxSize: number;
  private readonly maxSessions: number;
  private readonly maxMessages: number;

  constructor(config: HistoryServiceConfig) {
    this.dataDir = config.dataDir;
    this.trashDir = pathModule.join(config.dataDir, '.trash');
    this.corruptDir = pathModule.join(config.dataDir, '.corrupt');
    this.maxSize = config.maxSize ?? MAX_SESSION_SIZE;
    this.maxSessions = config.maxSessions ?? MAX_SESSIONS;
    this.maxMessages = config.maxMessages ?? MAX_MESSAGES_PER_SESSION;
  }

  // ============================================
  // 보안: UUID 검증 + Path Traversal 방지
  // ============================================

  /**
   * 세션 ID가 유효한 UUID v4 형식인지 검증
   */
  private validateSessionId(sessionId: string): void {
    if (!UUID_REGEX.test(sessionId)) {
      throw new HistoryError('Invalid session ID', 'INVALID_ID');
    }
  }

  /**
   * 경로 검증: dataDir 외부 접근 방지 (Path Traversal)
   */
  private getSafePath(sessionId: string): string {
    this.validateSessionId(sessionId);
    
    const filePath = pathModule.join(this.dataDir, `${sessionId}.json`);
    const resolved = pathModule.resolve(filePath);
    const resolvedDataDir = pathModule.resolve(this.dataDir);
    
    if (!resolved.startsWith(resolvedDataDir + pathModule.sep) && resolved !== resolvedDataDir) {
      throw new HistoryError('Invalid path', 'INVALID_PATH');
    }
    
    return resolved;
  }

  // ============================================
  // 보안: 크기/개수 제한
  // ============================================

  /**
   * 세션 크기 검증
   */
  private validateSessionSize(session: ChatSession): void {
    const size = Buffer.byteLength(JSON.stringify(session), 'utf8');
    if (size > this.maxSize) {
      throw new HistoryError(
        `Session size ${size} exceeds maximum ${this.maxSize}`,
        'SIZE_LIMIT_EXCEEDED'
      );
    }
  }

  /**
   * 세션 개수 검증
   */
  private async validateSessionCount(): Promise<void> {
    const sessions = await this.listSessions();
    if (sessions.length >= this.maxSessions) {
      throw new HistoryError(
        `Maximum session count ${this.maxSessions} reached`,
        'COUNT_LIMIT_EXCEEDED'
      );
    }
  }

  /**
   * 메시지 개수 검증
   */
  private validateMessageCount(session: ChatSession): void {
    if (session.messages.length > this.maxMessages) {
      throw new HistoryError(
        `Message count ${session.messages.length} exceeds maximum ${this.maxMessages}`,
        'MESSAGE_LIMIT_EXCEEDED'
      );
    }
  }

  // ============================================
  // 기획: 에러 표준화
  // ============================================

  // HistoryError 클래스 사용 (아래 정의)

  // ============================================
  // 기획: Corrupt file 처리
  // ============================================

  /**
   * 손상된 파일 처리: .corrupt 디렉토리로 이동
   */
  private async handleCorruptFile(filePath: string): Promise<void> {
    const fileName = pathModule.basename(filePath);
    const corruptPath = pathModule.join(this.corruptDir, `${Date.now()}_${fileName}`);
    
    await fs.ensureDir(this.corruptDir);
    await fs.move(filePath, corruptPath);
    
    // 로깅 (민감 정보 제외)
    console.warn(`[History] Corrupt file moved: ${fileName}`);
  }

  // ============================================
  // 기획: Soft delete (휴지통)
  // ============================================

  /**
   * 세션 삭제: 휴지통으로 이동
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const filePath = this.getSafePath(sessionId);
    
    if (!await fs.pathExists(filePath)) {
      return false;
    }
    
    // 휴지통으로 이동
    await fs.ensureDir(this.trashDir);
    const trashPath = pathModule.join(this.trashDir, `${Date.now()}_${sessionId}.json`);
    await fs.move(filePath, trashPath);
    
    // 로깅 (민감 정보 제외)
    console.log(`[History] Session moved to trash: ${sessionId}`);
    
    return true;
  }

  /**
   * 휴지통 비우기
   */
  async emptyTrash(): Promise<number> {
    if (!await fs.pathExists(this.trashDir)) {
      return 0;
    }
    
    const files = await fs.readdir(this.trashDir);
    let count = 0;
    
    for (const file of files) {
      await fs.remove(pathModule.join(this.trashDir, file));
      count++;
    }
    
    console.log(`[History] Trash emptied: ${count} sessions`);
    return count;
  }

  /**
   * 휴지통에서 복구
   */
  async restoreFromTrash(sessionId: string): Promise<boolean> {
    const trashFiles = await fs.readdir(this.trashDir);
    const targetFile = trashFiles.find(f => f.endsWith(`_${sessionId}.json`));
    
    if (!targetFile) {
      return false;
    }
    
    const trashPath = pathModule.join(this.trashDir, targetFile);
    const restorePath = pathModule.join(this.dataDir, `${sessionId}.json`);
    
    await fs.move(trashPath, restorePath);
    console.log(`[History] Session restored: ${sessionId}`);
    
    return true;
  }

  // ============================================
  // Core 메서드
  // ============================================

  async saveSession(session: ChatSession): Promise<void> {
    // 1. 검증
    this.validateSessionId(session.id);
    this.validateMessageCount(session);
    this.validateSessionSize(session);
    
    // 2. 세션 개수 확인 (새 세션인 경우만)
    const isNew = !await this.sessionExists(session.id);
    if (isNew) {
      await this.validateSessionCount();
    }
    
    // 3. 안전한 경로 생성
    const filePath = this.getSafePath(session.id);
    
    // 4. Atomic write
    const tempPath = `${filePath}.tmp`;
    await fs.writeJson(tempPath, session, { spaces: 2 });
    await fs.rename(tempPath, filePath);
    
    // 5. 로깅 (민감 정보 제외)
    console.log(`[History] Session saved: ${session.id}`);
  }

  async loadSession(sessionId: string): Promise<ChatSession | null> {
    const filePath = this.getSafePath(sessionId);
    
    if (!await fs.pathExists(filePath)) {
      return null;
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as ChatSession;
    } catch (error) {
      // Corrupt file 처리
      await this.handleCorruptFile(filePath);
      return null;
    }
  }

  async listSessions(): Promise<ChatSessionMeta[]> {
    // ... 기존 구현
  }

  private async sessionExists(sessionId: string): Promise<boolean> {
    const filePath = this.getSafePath(sessionId);
    return fs.pathExists(filePath);
  }
}

// ============================================
// 기획: 표준화된 에러 클래스
// ============================================

export class HistoryError extends Error {
  constructor(
    message: string,
    public readonly code: HistoryErrorCode
  ) {
    super(message);
    this.name = 'HistoryError';
  }
}

export type HistoryErrorCode = 
  | 'INVALID_ID'
  | 'INVALID_PATH'
  | 'SIZE_LIMIT_EXCEEDED'
  | 'COUNT_LIMIT_EXCEEDED'
  | 'MESSAGE_LIMIT_EXCEEDED'
  | 'NOT_FOUND'
  | 'CORRUPT_FILE'
  | 'INTERNAL_ERROR';

// ============================================
// 기획: 표준화된 API 응답
// ============================================

export interface ErrorResponse {
  error: string;
  code: HistoryErrorCode;
  details?: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}
```

---

### 2. API 라우트: 에러 표준화

```typescript
// apps/daemon/src/routes/history.ts

import { Hono } from 'hono';
import { HistoryService, HistoryError, HistoryErrorCode } from '@amicus/core';

const historyRoutes = new Hono();

// 에러 응답 헬퍼
function errorResponse(code: HistoryErrorCode, message: string, details?: string) {
  return {
    error: message,
    code,
    ...(details && { details })
  };
}

// GET /api/history - 세션 목록
historyRoutes.get('/', async (c) => {
  try {
    const sessions = await historyService.listSessions();
    return c.json({ sessions });
  } catch (error) {
    console.error('[History API] List error:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to list sessions'), 500);
  }
});

// GET /api/history/:id - 세션 조회
historyRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    const session = await historyService.loadSession(id);
    
    if (!session) {
      return c.json(errorResponse('NOT_FOUND', 'Session not found'), 404);
    }
    
    return c.json({ session });
  } catch (error) {
    if (error instanceof HistoryError) {
      const status = error.code === 'INVALID_ID' ? 400 : 500;
      return c.json(errorResponse(error.code, error.message), status);
    }
    
    console.error('[History API] Load error:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to load session'), 500);
  }
});

// DELETE /api/history/:id - 세션 삭제 (soft delete)
historyRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    const deleted = await historyService.deleteSession(id);
    
    if (!deleted) {
      return c.json(errorResponse('NOT_FOUND', 'Session not found'), 404);
    }
    
    return c.json({ success: true, message: 'Session moved to trash' });
  } catch (error) {
    if (error instanceof HistoryError) {
      const status = error.code === 'INVALID_ID' ? 400 : 500;
      return c.json(errorResponse(error.code, error.message), status);
    }
    
    console.error('[History API] Delete error:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to delete session'), 500);
  }
});

// POST /api/history/trash/empty - 휴지통 비우기
historyRoutes.post('/trash/empty', async (c) => {
  try {
    const count = await historyService.emptyTrash();
    return c.json({ success: true, deletedCount: count });
  } catch (error) {
    console.error('[History API] Empty trash error:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to empty trash'), 500);
  }
});

// POST /api/history/trash/restore/:id - 휴지통에서 복구
historyRoutes.post('/trash/restore/:id', async (c) => {
  const id = c.req.param('id');
  
  try {
    const restored = await historyService.restoreFromTrash(id);
    
    if (!restored) {
      return c.json(errorResponse('NOT_FOUND', 'Session not found in trash'), 404);
    }
    
    return c.json({ success: true, message: 'Session restored' });
  } catch (error) {
    console.error('[History API] Restore error:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to restore session'), 500);
  }
});
```

---

### 3. 변경 파일 요약

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/core/src/chat/HistoryService.ts` | 생성 | 보안 강화 + soft delete |
| `packages/core/src/chat/HistoryService.test.ts` | 생성 | TDD 테스트 |
| `packages/core/src/chat/errors.ts` | 생성 | HistoryError 타입 |
| `apps/daemon/src/routes/history.ts` | 생성 | 표준화된 API |
| `apps/daemon/src/routes/__tests__/history.test.ts` | 생성 | API 테스트 |

---

## v2 검증 체크리스트

### 🔒 보안 체크리스트

- [x] **UUID 검증**: `UUID_REGEX`로 엄격한 검증
- [x] **Path Traversal 방지**: `path.resolve` + `startsWith` 검증
- [x] **크기 제한**: `MAX_SESSION_SIZE` (10MB)
- [x] **개수 제한**: `MAX_SESSIONS` (1000개)
- [x] **메시지 제한**: `MAX_MESSAGES_PER_SESSION` (10000개)
- [x] **로깅 보안**: 메시지 내용 로깅 금지

### 📋 기획 체크리스트

- [x] **에러 표준화**: `ErrorResponse { error, code, details? }`
- [x] **Corrupt 처리**: `.corrupt` 디렉토리로 이동
- [x] **Soft delete**: `.trash` 디렉토리로 이동
- [x] **복구 기능**: `restoreFromTrash()` 메서드
- [x] **휴지통 비우기**: `emptyTrash()` 메서드

---

**작성일**: 2026-03-30  
**다음 단계**: 보안 + 기획 전문가 재검토
