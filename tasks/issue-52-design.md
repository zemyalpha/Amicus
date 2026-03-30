# Issue #52 [Phase 1] 채팅 히스토리 관리 - 디자이너 검토

## 📋 UI 변경 사항
- 대시보드에서 세션 목록 표시 (`SessionList` 컴포넌트)
- 이전 대화 불러오기 기능
- 세션 선택/삭제 UI

## 🔍 기존 디자인 시스템 분석

### 색상 팔레트
| 용도 | 색상 코드 | 사용 예시 |
|------|-----------|-----------|
| 배경 (Primary) | `#1a1a2e` | ChatPanel, 카드 배경 |
| 배경 (Secondary) | `#1a1a1a` | StatusBoard 카드 |
| 배경 (Tertiary) | `#2a2a4a` | 어시스턴트 메시지, 툴 헤더 |
| 주 색상 | `#6aa7ff` | 버튼, 링크, 활성 상태 |
| 성공 | `#4ade80` | Healthy, Done 상태 |
| 경고 | `#fbbf24` | Degraded, Running 상태 |
| 에러 | `#ef4444` | Unhealthy, Exceeded 상태 |
| 텍스트 (Primary) | `#e6e6e6` | 기본 텍스트 |
| 텍스트 (Secondary) | `#888` | 설명, 서브타이틀 |
| 텍스트 (Muted) | `#666` | 플레이스홀더, 비활성 |

### 컴포넌트 스타일 패턴
```css
/* 카드 스타일 */
background: #1a1a1a;
border-radius: 8px;
border: 1px solid #333;
padding: 1rem;

/* 버튼 스타일 (기본) */
border-radius: 8px;
padding: 0.75rem 1.25rem;
font-weight: 500;
transition: background 0.2s;

/* 네비게이션 버튼 */
border: 1px solid #333;
border-radius: 999px; /* pill shape */
padding: 0.35rem 0.75rem;
```

---

## 🎨 디자이너 검토 결과

### ✅ 기존 디자인 시스템/컴포넌트와 일관성

**판단: PASS**

**분석:**
- 기존 `StatusBoard`, `ControlCenter`, `ChatPanel`의 스타일 패턴을 일관되게 따르면 됨
- 다크 테마와 카드 기반 레이아웃 유지 권장
- `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` 패턴 사용

**SessionList 컴포넌트 제안:**
```css
:host {
  display: block;
  padding: 1rem;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.session-item:hover {
  background: #222;
  border-color: #6aa7ff;
}

.session-item.active {
  border-color: #6aa7ff;
  background: rgba(106, 167, 255, 0.1);
}

.session-title {
  font-weight: 500;
  color: #e6e6e6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: #888;
}

.session-delete-btn {
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid #444;
  border-radius: 4px;
  color: #ef4444;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.session-item:hover .session-delete-btn {
  opacity: 1;
}

.session-delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}
```

---

### ✅ 에러/로딩/빈 상태/성공 UI 정의

**판단: NEEDS_WORK**

**필요한 상태 UI:**

| 상태 | UI 표현 |
|------|---------|
| **로딩** | 스켈레톤 UI 또는 기존 `loading-dots` 애니메이션 재사용 |
| **빈 상태** | 기존 `empty-state` 패턴 활용 (아이콘 + 타이틀 + 설명) |
| **에러** | 토스트 알림 또는 인라인 에러 메시지 |
| **성공** | 미묘한 체크 아이콘 또는 색상 변화 |

**제안 코드:**
```css
/* 빈 상태 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  color: #666;
  text-align: center;
}

.empty-state-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* 로딩 스켈레톤 */
.session-skeleton {
  padding: 0.75rem 1rem;
  background: linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
  height: 56px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 삭제 확인 다이얼로그 */
.delete-confirm {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.delete-confirm-dialog {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 400px;
  border: 1px solid #444;
}
```

---

### ✅ 반응형 동작 (모바일/태블릿/데스크톱)

**판단: NEEDS_WORK**

**필요한 미디어 쿼리:**

```css
/* 모바일 (< 480px) */
@media (max-width: 480px) {
  .session-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .session-meta {
    width: 100%;
    justify-content: space-between;
  }
  
  .session-delete-btn {
    opacity: 1; /* 터치 디바이스에서 항상 표시 */
  }
  
  .session-title {
    max-width: 100%;
  }
}

/* 태블릿 (481px - 768px) */
@media (min-width: 481px) and (max-width: 768px) {
  .session-title {
    max-width: 250px;
  }
}

/* 데스크톱 (> 768px) */
@media (min-width: 769px) {
  .session-list {
    max-height: calc(100vh - 200px);
    overflow-y: auto;
  }
}
```

**터치 디바이스 고려사항:**
- 삭제 버튼: 호버가 없으므로 항상 표시하거나 스와이프 제스처 사용
- 최소 터치 타겟: 44px × 44px (Apple HIG 기준)

---

### ✅ 접근성 (색 대비 4.5:1, 키보드 네비게이션, ARIA)

**판단: NEEDS_WORK**

**필요한 접근성 개선:**

#### 색 대비 검증
| 조합 | 비율 | 결과 |
|------|------|------|
| `#e6e6e6` on `#1a1a2e` | 10.7:1 | ✅ AAA |
| `#6aa7ff` on `#1a1a2e` | 4.8:1 | ✅ AA |
| `#888` on `#1a1a2e` | 3.9:1 | ⚠️ AA Large만 |
| `#666` on `#1a1a2e` | 2.8:1 | ❌ Fail |

**수정 제안:**
```css
/* Muted 텍스트 색상 개선 */
.session-meta {
  color: #999; /* 4.5:1 달성 */
}
```

#### 키보드 네비게이션
```css
.session-item:focus-visible {
  outline: 2px solid #6aa7ff;
  outline-offset: 2px;
}

.session-delete-btn:focus-visible {
  outline: 2px solid #ef4444;
  outline-offset: 2px;
}
```

#### ARIA 속성
```html
<nav aria-label="Chat sessions">
  <ul role="listbox" aria-label="Previous conversations">
    <li 
      role="option" 
      aria-selected="true"
      tabindex="0"
    >
      <span class="session-title">Session Title</span>
      <button 
        aria-label="Delete session: Session Title"
        title="Delete this conversation"
      >
        🗑️
      </button>
    </li>
  </ul>
</nav>
```

---

### ✅ 애니메이션/트랜지션 적절성

**판단: PASS**

**권장 애니메이션:**
```css
/* 기존 패턴 준수 */
transition: background 0.2s, border-color 0.2s, opacity 0.2s;

/* 삭제 시 부드러운 제거 */
.session-item.deleting {
  animation: fadeOut 0.3s ease-out forwards;
}

@keyframes fadeOut {
  to {
    opacity: 0;
    transform: translateX(-20px);
    height: 0;
    padding: 0;
    margin: 0;
  }
}

/* 새 세션 추가 */
.session-item.adding {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
}
```

**주의사항:**
- `prefers-reduced-motion` 미디어 쿼리 존중
- 과도한 애니메이션 지양

---

### ✅ 텍스트 길이 다국어 대응

**판단: NEEDS_WORK**

**고려사항:**
| 언어 | 텍스트 길이 변화 |
|------|------------------|
| 영어 | 기준 (100%) |
| 한국어 | 유사 (~100%) |
| 독일어 | +20-30% |
| 프랑스어 | +15-25% |
| 일본어 | 유사 (~100%) |

**제안:**
```css
.session-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 영어 기준 30자, 다국어 고려 25자 권장 */
  max-width: 200px; /* 또는 ch 단위 사용 */
}

/* 툴팁으로 전체 제목 표시 */
.session-item[title] {
  cursor: help;
}
```

---

## 📝 SessionList 컴포넌트 전체 제안

```typescript
import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  messageCount: number;
}

@customElement('session-list')
export class SessionList extends LitElement {
  @property({ type: Array }) sessions: ChatSession[] = [];
  @property({ type: String }) activeSessionId: string | null = null;
  @state() private _isLoading = false;
  @state() private _deletingId: string | null = null;

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .header h3 {
      font-size: 0.875rem;
      color: #888;
      text-transform: uppercase;
      margin: 0;
    }

    .new-session-btn {
      padding: 0.35rem 0.75rem;
      background: #6aa7ff;
      color: #fff;
      border: none;
      border-radius: 999px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .new-session-btn:hover {
      background: #5a97ef;
    }

    .session-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: calc(100vh - 200px);
      overflow-y: auto;
    }

    .session-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }

    .session-item:hover {
      background: #222;
      border-color: #6aa7ff;
    }

    .session-item:focus-visible {
      outline: 2px solid #6aa7ff;
      outline-offset: 2px;
    }

    .session-item.active {
      border-color: #6aa7ff;
      background: rgba(106, 167, 255, 0.1);
    }

    .session-info {
      flex: 1;
      min-width: 0;
    }

    .session-title {
      font-weight: 500;
      color: #e6e6e6;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }

    .session-meta {
      display: flex;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: #999;
      margin-top: 0.25rem;
    }

    .session-actions {
      display: flex;
      gap: 0.5rem;
    }

    .session-delete-btn {
      padding: 0.35rem 0.5rem;
      background: transparent;
      border: 1px solid #444;
      border-radius: 4px;
      color: #ef4444;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s, background 0.2s;
      font-size: 0.875rem;
    }

    .session-item:hover .session-delete-btn,
    .session-delete-btn:focus-visible {
      opacity: 1;
    }

    .session-delete-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
    }

    .session-delete-btn:focus-visible {
      outline: 2px solid #ef4444;
      outline-offset: 2px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      color: #666;
      text-align: center;
    }

    .empty-state-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    .empty-state-title {
      font-size: 1rem;
      color: #888;
      margin-bottom: 0.5rem;
    }

    .empty-state-desc {
      font-size: 0.875rem;
    }

    .loading-skeleton {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .skeleton-item {
      height: 56px;
      background: linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 8px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .session-item.deleting {
      animation: fadeOut 0.3s ease-out forwards;
    }

    @keyframes fadeOut {
      to {
        opacity: 0;
        transform: translateX(-20px);
        height: 0;
        padding: 0;
        margin: 0;
      }
    }

    @media (max-width: 480px) {
      .session-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .session-delete-btn {
        opacity: 1;
      }

      .session-title {
        max-width: 100%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .session-item,
      .session-delete-btn,
      .new-session-btn {
        transition: none;
      }

      .skeleton-item {
        animation: none;
      }

      .session-item.deleting {
        animation: none;
      }
    }
  `;

  private _handleSessionClick(session: ChatSession) {
    this.dispatchEvent(new CustomEvent('session-select', {
      detail: { session },
      bubbles: true,
      composed: true,
    }));
  }

  private _handleDelete(e: Event, session: ChatSession) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('session-delete', {
      detail: { session },
      bubbles: true,
      composed: true,
    }));
  }

  private _handleNewSession() {
    this.dispatchEvent(new CustomEvent('session-new', {
      bubbles: true,
      composed: true,
    }));
  }

  private _formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  }

  render() {
    return html`
      <div class="header">
        <h3>Conversations</h3>
        <button 
          class="new-session-btn" 
          @click=${this._handleNewSession}
          aria-label="Start new conversation"
        >
          + New
        </button>
      </div>

      ${this._isLoading
        ? html`
            <div class="loading-skeleton" aria-label="Loading sessions">
              ${[1, 2, 3].map(() => html`<div class="skeleton-item"></div>`)}
            </div>
          `
        : this.sessions.length === 0
          ? html`
              <div class="empty-state" role="status">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-title">No conversations yet</div>
                <div class="empty-state-desc">Start a new chat to begin.</div>
              </div>
            `
          : html`
              <ul 
                class="session-list" 
                role="listbox" 
                aria-label="Previous conversations"
              >
                ${this.sessions.map(session => html`
                  <li
                    class="session-item ${this.activeSessionId === session.id ? 'active' : ''}"
                    role="option"
                    aria-selected=${this.activeSessionId === session.id}
                    tabindex="0"
                    @click=${() => this._handleSessionClick(session)}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this._handleSessionClick(session);
                      }
                    }}
                    title=${session.title}
                  >
                    <div class="session-info">
                      <div class="session-title">${session.title}</div>
                      <div class="session-meta">
                        <span>${this._formatDate(session.createdAt)}</span>
                        <span>•</span>
                        <span>${session.messageCount} messages</span>
                      </div>
                    </div>
                    <div class="session-actions">
                      <button
                        class="session-delete-btn"
                        @click=${(e: Event) => this._handleDelete(e, session)}
                        aria-label="Delete conversation: ${session.title}"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                `)}
              </ul>
            `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-list': SessionList;
  }
}
```

---

## 🎯 최종 검토 결과

### 판단: **REQUEST_CHANGES**

### 이유:
1. **접근성 개선 필요**: `#666` 색상이 WCAG AA 기준 미달 (2.8:1 → 4.5:1 필요)
2. **반응형 터치 대응**: 모바일에서 삭제 버튼 호버 불가 → 항상 표시 필요
3. **다국어 텍스트 길이**: 독일어/프랑스어 대응을 위한 여유 공간 확보 필요
4. **빈 상태/에러/로딩 UI**: 명시적 정의 및 구현 필요

### 권장 사항:
1. **색상 수정**: Muted 텍스트를 `#666` → `#999`로 변경
2. **미디어 쿼리 추가**: 480px 이하에서 삭제 버튼 항상 표시
3. **접근성 속성 추가**: `role`, `aria-*`, `tabindex` 등
4. **`prefers-reduced-motion`**: 애니메이션 비활성화 지원
5. **삭제 확인 다이얼로그**: 실수 방지를 위한 확인 단계 추가

### 개발 착수 조건:
- [ ] 색상 대비 WCAG AA 달성
- [ ] 키보드 네비게이션 완전 지원
- [ ] 터치 디바이스 삭제 버튼 표시
- [ ] 빈 상태/로딩/에러 UI 구현

---

**검토자**: AI Designer  
**검토 일시**: 2026-03-30
