# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

- [ ] **00:30 일일 회고 작성** — 매일 00:30에 전날 일지 작성
  - `diary/YYYY-MM-DD.md` 파일 생성
  - 형식: 오늘 한 일 / 잘한 것 / 실수 / 개선 방안 / 통계
  - memory/YYYY-MM-DD.md 기반으로 블로그 글처럼 작성
- [ ] pending 작업 상태 확인 (task-tracker) — timeout/누락된 서브에이전트 감지
- [ ] 진행 중인 PR 리뷰 사이클 상태 확인 (task-tracker + pending.json 기반)
  - `workspace/tasks/pending.json`에 type="pr-review"로 등록된 PR이 있으면:
    1. CI 상태 확인 (`gh pr checks`)
    2. 새 리뷰 코멘트 확인 (마지막 체크 이후 시간 기준)
    3. 새 코멘트 있으면 즉시 수정 루프 시작 (pr-review-cycle 스킬)
    4. CI 실패면 원인 확인 후 수정
    5. 마지막 체크 시간을 `lastCheckAt`에 기록
  - ⚠️ **병합은 사용자가 직접** — "병합 가능" 상태라고 말하지 않음
- [ ] 이슈 파이프라인 진행 상태 확인 (issue-pipeline) — 큐에 이슈 있지만 처리 안 됨 감지
  - ⚠️ **이슈 시작 전 pre-dev-review 필수** — 건너뛰지 말 것
- [ ] **서브에이전트 상태 모니터링** (3분마다)
  - 놀고 있는 에이전트 없는지 확인
  - 작업 중인 에이전트가 진행 중인지 확인
  - 완료된 에이전트가 보고 누락 없는지 확인
  - **문제 발생시 해결까지 책임지고 처리**
  - 완료된 작업은 즉시 보고
  - ⚠️ **서브에이전트 완료 보고 시 → 즉시 브라우저 테스트 → 통과 시에만 완료 확정**
  - ⚠️ **서브에이전트 실행 30분마다 → 저장 지시 (아직 커밋/푸시 하지 말고 저장만)**

- [ ] **15분마다 현재 상황 종합 보고** (heartbeat-state.json으로 추적)
  - `memory/heartbeat-state.json`의 `lastReportAt` 확인
  - 현재 시간 - lastReportAt >= 15분이면 보고
  - 보고 후 `lastReportAt` 업데이트
  - 진행 중인 작업 요약
  - 완료된 작업 요약
  - 문제 및 해결 사항
  - 다음 작업 계획
  - ⚠️ **게임 개발 서브에이전트가 완료되면 즉시 새 작업으로 재시작**
- [ ] **게임 플랫폼 정기 업그레이드** (1시간마다)
  - 새 고품질 게임 추가 (RPG, 전략, 서바이벌, 타워디펜스 등)
  - 기존 게임 그래픽/UI 개선
  - Poki.com 스타일 유지 (세련된 다크 테마)
  - 경로: `/Users/zemyblue-mac-mini-m1/.openclaw/workspace-nyand/games/puzzle-platform-deploy/`
  - ⚠️ **필수: 브라우저 테스트 후 배포**
    1. `browser` 툴로 게임 플레이 테스트
    2. 액션 게임: 점프/충돌/아이템 수집 확인
    3. 퍼즐 게임: 입력/로직/승리 조건 확인
    4. 버그 발견 시 수정 후 재테스트
    5. 테스트 통과 시에만 `git push`
  - 커밋 후 Netlify 자동 배포
