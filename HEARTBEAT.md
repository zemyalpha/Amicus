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
