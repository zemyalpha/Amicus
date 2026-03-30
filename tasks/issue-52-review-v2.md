# 이슈 #52 Pre-Dev Review 재검토 결과 (v2)

**이슈**: [Phase 1] 채팅 히스토리 관리  
**작성일**: 2026-03-30  
**검토자**: 보안 전문가, 기획자  
**버전**: v2 (1차 피드백 반영 후 재검토)

---

## 재검토 배경

1차 검토에서 **REQUEST_CHANGES**를 요청한 두 전문가가 피드백 반영 여부를 재검토합니다.

| 전문가 | 1차 판단 | 핵심 이슈 |
|--------|----------|-----------|
| 🔒 보안 | REQUEST_CHANGES | Path Traversal, 크기/개수 제한 없음 |
| 📋 기획 | REQUEST_CHANGES | Corrupt file 처리, soft delete 미흡 |

---

## 🔒 보안 전문가 재검토

### 1차 요청 사항

| 항목 | 설명 | 상태 |
|------|------|------|
| 세션 ID UUID 검증 | Path Traversal 방지 | 재검토 |
| 세션 크기 제한 | 10MB 제한 | 재검토 |
| 세션 개수 제한 | 최대 1000개 | 재검토 |
| 파일 경로 sanitization | `path.resolve` 검증 | 재검토 |
| 민감 정보 로깅 방지 | 메시지 내용 로깅 금지 | 재검토 |

### v2 코드 검토

#### 1. UUID 검증 로직

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

private validateSessionId(sessionId: string): void {
  if (!UUID_REGEX.test(sessionId)) {
    throw new HistoryError('Invalid session ID', 'INVALID_ID');
  }
}
```

**평가**: ✅ **적절함**
- UUID v4 형식 엄격 검증
- Path Traversal 문자열(`../`, `..\\`) 자연스럽게 차단
- 검증 실패 시 `INVALID_ID` 에러 코드로 명확한 응답

#### 2. 크기/개수 제한

```typescript
const MAX_SESSION_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_SESSIONS = 1000;
const MAX_MESSAGES_PER_SESSION = 10000;

private validateSessionSize(session: ChatSession): void {
  const size = Buffer.byteLength(JSON.stringify(session), 'utf8');
  if (size > this.maxSize) {
    throw new HistoryError(
      `Session size ${size} exceeds maximum ${this.maxSize}`,
      'SIZE_LIMIT_EXCEEDED'
    );
  }
}

private async validateSessionCount(): Promise<void> {
  const sessions = await this.listSessions();
  if (sessions.length >= this.maxSessions) {
    throw new HistoryError(
      `Maximum session count ${this.maxSessions} reached`,
      'COUNT_LIMIT_EXCEEDED'
    );
  }
}
```

**평가**: ✅ **적절함**
- 세션 크기: 10MB 제한 (DoS 방지)
- 세션 개수: 1000개 제한 (디스크 가득 참 방지)
- 메시지 개수: 10000개 추가 제한 (세부 제어)
- UTF-8 바이트 단위 정확한 크기 계산 (`Buffer.byteLength`)

#### 3. 파일 경로 Sanitization

```typescript
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
```

**평가**: ✅ **적절함**
- `path.resolve`로 절대 경로 변환
- `startsWith`으로 dataDir 외부 접근 방지
- UUID 검증이 먼저 수행되어 이중 방어
- OS별 경로 구분자 처리 (`pathModule.sep`)

#### 4. 민감 정보 로깅

```typescript
// 로깅 (민감 정보 제외)
console.log(`[History] Session saved: ${session.id}`);
console.log(`[History] Session moved to trash: ${sessionId}`);
console.warn(`[History] Corrupt file moved: ${fileName}`);
```

**평가**: ✅ **적절함**
- 세션 ID만 로깅 (메시지 내용 제외)
- 민감 정보 노출 위험 없음
- 디버깅에 필요한 최소 정보만 포함

### 보안 체크리스트 결과

| 항목 | 기준 | 준수 여부 |
|------|------|-----------|
| 입력 검증 | UUID 형식 검증 | ✅ |
| Path Traversal 방지 | `path.resolve` + `startsWith` | ✅ |
| DoS 방지 | 크기/개수 제한 | ✅ |
| 민감 정보 보호 | 메시지 내용 로깅 금지 | ✅ |
| 에러 메시지 | 정보 노출 없음 | ✅ |

### 🔒 보안 전문가 최종 판단

**APPROVE**

**사유**:
1. UUID 검증으로 Path Traversal 공격 완전 차단
2. 크기/개수 제한으로 DoS 공격 방지
3. 이중 경로 검증으로 안전성 확보
4. 민감 정보 로깅 제거로 정보 유출 방지

---

## 📋 기획자 재검토

### 1차 요청 사항

| 항목 | 설명 | 상태 |
|------|------|------|
| 에러 응답 표준화 | `code` 필드 추가 | 재검토 |
| Corrupt file 처리 | `.corrupt` 파일로 이동 | 재검토 |
| Soft delete | 휴지통 기능 | 재검토 |

### v2 코드 검토

#### 1. 에러 응답 표준화

```typescript
export type HistoryErrorCode = 
  | 'INVALID_ID'
  | 'INVALID_PATH'
  | 'SIZE_LIMIT_EXCEEDED'
  | 'COUNT_LIMIT_EXCEEDED'
  | 'MESSAGE_LIMIT_EXCEEDED'
  | 'NOT_FOUND'
  | 'CORRUPT_FILE'
  | 'INTERNAL_ERROR';

export interface ErrorResponse {
  error: string;
  code: HistoryErrorCode;
  details?: string;
}

// API 라우트에서 사용 예시
return c.json(errorResponse('INVALID_ID', 'Invalid session ID'), 400);
return c.json(errorResponse('NOT_FOUND', 'Session not found'), 404);
```

**평가**: ✅ **적절함**
- `code` 필드로 에러 유형 명확화
- 클라이언트에서 프로그래밍 방식으로 에러 처리 가능
- `details` 선택 필드로 추가 정보 제공 가능
- HTTP 상태 코드와 일관성 유지

#### 2. Corrupt File 처리

```typescript
private async handleCorruptFile(filePath: string): Promise<void> {
  const fileName = pathModule.basename(filePath);
  const corruptPath = pathModule.join(this.corruptDir, `${Date.now()}_${fileName}`);
  
  await fs.ensureDir(this.corruptDir);
  await fs.move(filePath, corruptPath);
  
  console.warn(`[History] Corrupt file moved: ${fileName}`);
}

// loadSession에서 사용
async loadSession(sessionId: string): Promise<ChatSession | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as ChatSession;
  } catch (error) {
    await this.handleCorruptFile(filePath);
    return null;
  }
}
```

**평가**: ✅ **적절함**
- 손상된 파일을 `.corrupt` 디렉토리로 이동
- 타임스탬프로 원본 파일명 보존
- 사용자 경험 저해 없이 `null` 반환
- 로깅으로 문제 추적 가능

#### 3. Soft Delete (휴지통)

```typescript
async deleteSession(sessionId: string): Promise<boolean> {
  // 휴지통으로 이동
  await fs.ensureDir(this.trashDir);
  const trashPath = pathModule.join(this.trashDir, `${Date.now()}_${sessionId}.json`);
  await fs.move(filePath, trashPath);
  
  console.log(`[History] Session moved to trash: ${sessionId}`);
  return true;
}

async restoreFromTrash(sessionId: string): Promise<boolean> {
  const trashFiles = await fs.readdir(this.trashDir);
  const targetFile = trashFiles.find(f => f.endsWith(`_${sessionId}.json`));
  
  if (!targetFile) return false;
  
  const trashPath = pathModule.join(this.trashDir, targetFile);
  const restorePath = pathModule.join(this.dataDir, `${sessionId}.json`);
  
  await fs.move(trashPath, restorePath);
  return true;
}

async emptyTrash(): Promise<number> {
  // 휴지통 비우기
}

// API 엔드포인트
POST /api/history/trash/empty      // 휴지통 비우기
POST /api/history/trash/restore/:id // 복구
```

**평가**: ✅ **적절함**
- 완전 삭제 대신 휴지통 이동 (사용자 실수 방지)
- 복구 기능 제공 (`restoreFromTrash`)
- 휴지통 비우기 기능 (`emptyTrash`)
- API 엔드포인트로 명확한 기능 제공

### 엣지 케이스 검증

| 케이스 | v2 처리 방식 | 상태 |
|--------|-------------|------|
| null session id | UUID 검증 → 400 INVALID_ID | ✅ |
| corrupt file | .corrupt로 이동 → null 반환 | ✅ |
| disk full | 500 INTERNAL_ERROR | ✅ |
| concurrent access | 파일 잠금은 v3 권장 사항으로 유지 | ⚠️ 권장 |
| very long title | 프론트엔드에서 처리 | ✅ |

### 📋 기획자 최종 판단

**APPROVE**

**사유**:
1. 에러 응답에 `code` 필드로 클라이언트 처리 용이
2. Corrupt file 처리로 사용자 경험 보호
3. Soft delete + 복구 기능으로 실수 방지
4. 엣지 케이스 대부분 처리됨

---

## 최종 결과 집계

| 전문가 | 1차 판단 | 2차 판단 | 비고 |
|--------|----------|----------|------|
| 🔒 보안 | REQUEST_CHANGES | **APPROVE** | 모든 보안 이슈 해결 |
| 📋 기획 | REQUEST_CHANGES | **APPROVE** | 모든 기획 이슈 해결 |
| 🎨 디자인 | APPROVE | - | 1차 승인 유지 |
| 🏗️ 아키텍트 | APPROVE | - | 1차 승인 유지 |

---

## 최종 판단

# ✅ ALL APPROVE - 개발 시작 가능

---

## 개발 시작 체크리스트

### TDD Red → Green → Refactor

1. **HistoryService 테스트 작성** (Red)
   - [ ] UUID 검증 테스트 (Path Traversal 시도)
   - [ ] 크기 제한 테스트
   - [ ] 개수 제한 테스트
   - [ ] Corrupt file 처리 테스트
   - [ ] Soft delete 테스트
   - [ ] 복구 테스트

2. **HistoryService 구현** (Green)
   - [ ] `HistoryService.ts`
   - [ ] `errors.ts` (HistoryError, ErrorCode)

3. **API 테스트 작성** (Red)
   - [ ] 에러 응답 형식 테스트
   - [ ] CRUD 테스트
   - [ ] 휴지통 API 테스트

4. **API 구현** (Green)
   - [ ] `routes/history.ts`

5. **리팩토링** (Refactor)
   - [ ] 저장소 인터페이스 추상화 (선택적)

### 검증 명령어

```bash
# 테스트 실행
bun test packages/core/src/chat/HistoryService.test.ts
bun test apps/daemon/src/routes/__tests__/history.test.ts

# 커버리지 확인
bun test --coverage

# 수동 API 테스트
curl -s http://localhost:3000/api/history | jq .
```

---

**재검토 완료일**: 2026-03-30  
**결과**: ALL APPROVE  
**다음 단계**: TDD 개발 시작
