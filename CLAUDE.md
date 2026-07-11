@AGENTS.md

## 상태 — pulse v2 배포 완료 (2026-07-11)

`docs/pulse-v2-topology-spec.md`의 3기능(토폴로지 그래프·배포 이력 피드·active alerts 칩) 구현·배포·라이브 검증 완료 (PR #6 구현 → #8 메타 알림 수정 → #7/#9 이미지 범프). 검증 게이트 §8 전 항목 통과 — 칩 "0 active alerts", 헬스 도트 8/8, 피드 커밋 링크 동작.

운영 주의: 알림 칩은 메타 알림 2종(`Watchdog`, `InfoInhibitor`)을 제외하고 센다(`src/lib/alertmanager.ts`의 `META_ALERTS`). 새 메타성 알림이 생기면 그 셋에 추가. 토폴로지에 서비스가 늘면 `src/lib/topology.ts`의 선언(노드 col/row + 엣지)만 수정하면 된다.
