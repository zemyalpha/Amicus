# 이슈 #52 Pre-Dev Review 재검토 결과 (v3)

**이슈**: [Phase 1] 채팅 히스토리 관리  
**작성일**: 2026-03-30  
**검토자**: 보안 전문가, 기획자, 디자이너, 아키텍트  
**버전**: v3 (4개 전문가 전체 재검토)

---

## 1차 검토 결과 요약

| 전문가 | 판단 | 이슈 |
|--------|------|------|
| 🔒 보안 | REQUEST_CHANGES | Path Traversal, 크기/개수 제한 |
| 📋 기획 | REQUEST_CHANGES | Corrupt file, Soft delete |
| 🎨 디자인 | APPROVE | — |
| 🏗️ 아키텍트 | APPROVE | — |

---

## v2 계획에서 반영된 사항

### 보안 피드백 반영
- UUID v4 정규식 검증 (`UUID_REGEX`)
- `path.resolve` + `startsWith` 이중 경로 검증
- 세션 크기 10MB 제한 (`MAX_SESSION_SIZE`)
- 세션 개수 1000개 제한 (`MAX_SESSIONS`)
- 메시지 10000개 제한 (`MAX_MESSAGES_PER_SESSION`)
- 민감 정보(메시지 내용) 로깅 제거

### 기획 피드백 반영
- `ErrorResponse` 표준화 (`error`, `code`, `details?`)
- Corrupt file → `.corrupt` 디렉토리로 이동
- Soft delete → `.trash` 디렉토리로 이동
- 복구 기능 (`restoreFromTrash`) 추가
- 휴지통 비우기 (`emptyTrash`) 추가

---

## 재검토 결과

### 🔒 보안 전문가

**판단**: ✅ APPROVE

**검토 방법론**: STRIDE + DREAD

#### 1. UUID 검증 로직 확인

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

private validateSessionId(sessionId: string): void {
  if (!UUID_REGEX.test(sessionId)) {
    throw new HistoryError('Invalid session ID', 'INVALID_ID');
  }
}
```

**평가**:
- ✅ UUID v4 형식 엄격 검증
- ✅ Path Traversal 문자열(`../`, `..\\`) 자연스럽게 차단
- ✅ 검증 실패 시 명확한 에러 코드(`INVALID_ID`) 반환

#### 2. Path Sanitization 확인

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

**평가**:
- ✅ `path.resolve`로 절대 경로 변환
- ✅ `startsWith`으로 dataDir 외부 접근 방지
- ✅ UUID 검증이 먼저 수행되어 이중 방어
- ✅ OS별 경로 구분자 처리 (`pathModule.sep`)

#### 3. 크기/개수 제한 확인

```typescript
const MAX_SESSION_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_SESSIONS = 1000;
const MAX_MESSAGES_PER_SESSION = 10000;

private validateSessionSize(session: ChatSession): void {
  const size = Buffer.byteLength(JSON.stringify(session), 'utf8');
  if (size > this.maxSize) {
    throw new HistoryError(`Session size ${size} exceeds maximum ${this.maxSize}`, 'SIZE_LIMIT_EXCEEDED');
  }
}
```

**평가**:
- ✅ 세션 크기: 10MB 제한 (DoS 방지)
- ✅ 세션 개수: 1000개 제한 (디스크 가득 참 방지)
- ✅ 메시지 개수: 10000개 추가 제한
- ✅ UTF-8 바이트 단위 정확한 크기 계산 (`Buffer.byteLength`)

#### 4. 민감 정보 로깅 확인

```typescript
// 로깅 (민감 정보 제외)
console.log(`[History] Session saved: ${session.id}`);
console.log(`[History] Session moved to trash: ${sessionId}`);
```

**평가**:
- ✅ 세션 ID만 로깅 (메시지 내용 제외)
- ✅ 민감 정보 노출 위험 없음

#### STRIDE 분석

| 위협 | 검토 결과 | 상태 |
|------|----------|------|
| Spoofing | 세션 ID UUID 검증으로 위장 방지 | ✅ |
| Tampering | Path Traversal 방지로 데이터 무결성 보호 | ✅ |
| Repudiation | 로깅으로 추적 가능 (단, 메시지 내용 제외) | ✅ |
| Info Disclosure | 민감 정보 로깅 금지 | ✅ |
| Denial of Service | 크기/개수 제한으로 방지 | ✅ |
| Elevation of Privilege | 해당 없음 (인증 없음) | N/A |

#### DREAD 점수 (v2 적용 후)

| 항목 | 점수 |
|------|------|
| Damage | 3 (제한된 데이터) |
| Reproducibility | 2 (UUID 검증) |
| Exploitability | 2 (Path Traversal 차단) |
| Affected Users | 3 (단일 사용자) |
| Discoverability | 2 (명확한 에러 응답) |
| **총점** | **12 (MEDIUM → LOW)** |

**최종 판단**: APPROVE

**사유**: 
1. UUID 검증으로 Path Traversal 공격 완전 차단
2. 이중 경로 검증으로 안전성 확보
3. 크기/개수 제한으로 DoS 공격 방지
4. 민감 정보 로깅 제거로 정보 유출 방지

---

### 📋 기획자

**판단**: ✅ APPROVE

**검토 방법론**: User Story Mapping + Edge Case Analysis

#### 1. 에러 응답 표준화 확인

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
```

**평가**:
- ✅ `code` 필드로 에러 유형 명확화
- ✅ 클라이언트에서 프로그래밍 방식으로 에러 처리 가능
- ✅ `details` 선택 필드로 추가 정보 제공 가능
- ✅ HTTP 상태 코드와 일관성 유지 (400/404/500)

#### 2. Corrupt File 처리 확인

```typescript
private async handleCorruptFile(filePath: string): Promise<void> {
  const fileName = pathModule.basename(filePath);
  const corruptPath = pathModule.join(this.corruptDir, `${Date.now()}_${fileName}`);
  
  await fs.ensureDir(this.corruptDir);
  await fs.move(filePath, corruptPath);
  
  console.warn(`[History] Corrupt file moved: ${fileName}`);
}
```

**평가**:
- ✅ 손상된 파일을 `.corrupt` 디렉토리로 이동
- ✅ 타임스탬프로 원본 파일명 보존
- ✅ 사용자 경험 저해 없이 `null` 반환
- ✅ 로깅으로 문제 추적 가능

#### 3. Soft Delete 확인

```typescript
async deleteSession(sessionId: string): Promise<boolean> {
  // 휴지통으로 이동
  await fs.ensureDir(this.trashDir);
  const trashPath = pathModule.join(this.trashDir, `${Date.now()}_${sessionId}.json`);
  await fs.move(filePath, trashPath);
  return true;
}

async restoreFromTrash(sessionId: string): Promise<boolean> { ... }
async emptyTrash(): Promise<number> { ... }
```

**평가**:
- ✅ 완전 삭제 대신 휴지통 이동 (사용자 실수 방지)
- ✅ 복구 기능 제공 (`restoreFromTrash`)
- ✅ 휴지통 비우기 기능 (`emptyTrash`)
- ✅ API 엔드포인트로 명확한 기능 제공

#### 엣지 케이스 검증

| 케이스 | v2 처리 방식 | 상태 |
|--------|-------------|------|
| null session id | UUID 검증 → 400 INVALID_ID | ✅ |
| corrupt file | .corrupt로 이동 → null 반환 | ✅ |
| disk full | 500 INTERNAL_ERROR | ✅ |
| concurrent access | 파일 잠금은 v3 권장 사항 | ⚠️ |
| very long title | 프론트엔드에서 처리 | ✅ |
| 세션 크기 초과 | 400 SIZE_LIMIT_EXCEEDED | ✅ |
| 세션 개수 초과 | 400 COUNT_LIMIT_EXCEEDED | ✅ |

#### 사용자 시나리오 검증

| 시나리오 | API | 응답 | 상태 |
|----------|-----|------|------|
| 세션 생성 | POST /api/history | { session } | ✅ |
| 세션 조회 | GET /api/history/:id | { session } / 404 | ✅ |
| 세션 삭제 | DELETE /api/history/:id | { success, message } | ✅ |
| 휴지통 복구 | POST /api/history/trash/restore/:id | { success, message } | ✅ |
| 휴지통 비우기 | POST /api/history/trash/empty | { success, deletedCount } | ✅ |

**최종 판단**: APPROVE

**사유**:
1. 에러 응답에 `code` 필드로 클라이언트 처리 용이
2. Corrupt file 처리로 사용자 경험 보호
3. Soft delete + 복구 기능으로 실수 방지
4. 엣지 케이스 대부분 처리됨

---

### 🎨 디자이너

**판단**: N/A

**이유**: 1차 검토에서 APPROVE, v2 계획에 UI 변경사항 없음

**상세 설명**:
- 본 작업은 백엔드 HistoryService 및 API 구현에 해당
- 프론트엔드 UI 변경사항 없음
- 에러 응답 형식 변경은 기획적 관점에서 이미 승인됨
- 디자인 시스템, 컴포넌트, 접근성 검토 대상 없음

---

### 🏗️ 아키텍트

**판단**: N/A

**이유**: 1차 검토에서 APPROVE, v2 계획에 아키텍처 변경사항 없음

**상세 설명**:
- v2 계획은 기존 아키텍처 내에서 구현 세부사항 보완
- 새로운 의존성 추가 없음 (fs-extra, path 등 기존 것 사용)
- 모듈 간 결합도 변경 없음
- 기존 패턴(HistoryService, Hono routes) 유지
- 성능 영향: 파일 I/O 기반으로 기존과 동일

---

## 최종 결론

# ✅ ALL APPROVE - 개발 시작 가능

| 전문가 | 1차 판단 | 2차 판단 | 최종 |
|--------|----------|----------|------|
| 🔒 보안 | REQUEST_CHANGES | APPROVE | ✅ APPROVE |
| 📋 기획 | REQUEST_CHANGES | APPROVE | ✅ APPROVE |
| 🎨 디자인 | APPROVE | N/A | ✅ APPROVE (1차 승인 유지) |
| 🏗️ 아키텍트 | APPROVE | N/A | ✅ APPROVE (1차 승인 유지) |

---

## 개발 시작 체크리스트

### TDD Red → Green → Refactor

1. **HistoryService 테스트 작성** (Red)
   - [ ] UUID 검증 테스트 (Path Traversal 시도 포함)
   - [ ] 크기 제한 테스트 (10MB 초과)
   - [ ] 개수 제한 테스트 (1000개 초과)
   - [ ] Corrupt file 처리 테스트
   - [ ] Soft delete 테스트
   - [ ] 복구 테스트

2. **HistoryService 구현** (Green)
   - [ ] `packages/core/src/chat/HistoryService.ts`
   - [ ] `packages/core/src/chat/errors.ts`

3. **API 테스트 작성** (Red)
   - [ ] 에러 응답 형식 테스트
   - [ ] CRUD 테스트
   - [ ] 휴지통 API 테스트

4. **API 구현** (Green)
   - [ ] `apps/daemon/src/routes/history.ts`

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
curl -s http://localhost:3000/api/history/invalid-uuid | jq .
```

---

**재검토 완료일**: 2026-03-30  
**결과**: ALL APPROVE  
**다음 단계**: TDD 개발 시작
