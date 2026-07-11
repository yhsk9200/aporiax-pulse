# pulse v2 — 플랫폼 토폴로지 시각화 스펙

> **확정본** (2026-07-11, Fable 스펙 확정). 실행 세션은 이 문서를 단일 기준으로 구현한다.
> 구현 전 필독: 레포 루트 `AGENTS.md` — 이 레포의 Next.js는 16.2.10로, 학습 데이터와 API가 다를 수 있으니 `node_modules/next/dist/docs/`의 해당 가이드를 먼저 읽을 것.

## 1. 배경과 목표

현재 pulse는 패널 3개가 전부 목록형(노드 숫자 3개, 앱 이름 14개, 도메인 3개)이라 "살아있는 시스템"이 아니라 "인벤토리 스냅샷"으로 읽힌다. v2는 세 가지를 추가한다:

1. **F1 토폴로지 그래프** — 서비스 간 연결의 시각화 (관계 축)
2. **F2 배포 이력 피드** — 최근 배포 → git 커밋 링크 (시간 축, "main 머지 = 배포" 불변식의 증명)
3. **F3 Active alerts 칩** — 알림 파이프라인 가동 증거

### 설계 원칙 (전 기능 공통)

- **"Topology is declared, health is live"** — 엣지(연결)는 소스에 선언, 노드 상태만 실데이터. 그래프가 아는 척하지 않는 정직한 구조.
- **신규 npm 의존성 0** (d3 등 그래프 라이브러리 금지 — 순수 SVG 서버 렌더), **신규 RBAC 0**.
- 기존 패턴 유지: 서버 컴포넌트 + `revalidate = 60`, `DataResult<T>`로 부분 실패 격리(한 소스 죽어도 페이지는 뜬다), `Panel` 래퍼와 `HEALTH_COLOR` 팔레트 재사용, Tailwind 다크모드 클래스(`dark:border-neutral-800` 등) 기존 톤 유지.
- 공개 페이지임을 전제로 정보 노출 최소화: 알림은 개수/severity만, 라벨·이름 비노출.

## 2. 실측 근거 (2026-07-11 클러스터 실측 — 구현 시 재검증 불필요)

| 사실 | 실측 결과 |
|---|---|
| Application CR `status.history` | 단일 소스 git 앱(product-pulse-web): `history[].revision` = 40자 SHA, `deployedAt` ISO 존재 |
| 멀티소스 앱(postgres, prometheus 등) | `history[].revision` **없음**, `history[].revisions[]`가 `spec.sources[]`와 인덱스 정렬. 실측 예: postgres = `["18.5.19", "85f5e15…"]` = [bitnami 차트버전, gitops-infra SHA] |
| Alertmanager 인클러스터 접근 | `http://platform-monitoring-promet-alertmanager.platform-monitoring.svc.cluster.local:9093`, API v2. NetworkPolicy는 argocd/platform-db/platform-iam에만 존재(platform-monitoring·product-pulse엔 없음) + pulse→Prometheus HTTP가 이미 가동 중 → 도달 가능 |
| RBAC | pulse SA의 기존 Role(argocd ns, applications get/list)로 `status.history`까지 같은 객체에서 나옴 — **추가 권한 불필요** |
| 배포 플로우 | main 머지 → CI가 `ghcr.io/yhsk9200/aporiax-pulse:sha-<12자>` push → **별도 PR**로 `deploy/manifests/web/app.yaml` 이미지 태그 범프 → ArgoCD sync |

## 3. F1 — 토폴로지 그래프

### 3.1 데이터 모델 — `src/lib/topology.ts` (신규, 선언 파일)

```ts
export type NodeKind = "cluster-service" | "control-plane" | "external" | "self";
export type EdgeKind = "ingress" | "oidc" | "db" | "query" | "read" | "alert" | "push" | "acme";

export interface TopologyNode {
  id: string;
  label: string;
  kind: NodeKind;
  argoApp?: string; // ArgoCD Application 이름 — 라이브 헬스 바인딩. external/control-plane은 없음
  col: number;      // 고정 레이아웃 열 (0..4)
  row: number;      // 열 내 세로 순서
}

export interface TopologyEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}
```

### 3.2 노드 선언 (열 배치 포함)

| id | label | kind | argoApp | col |
|---|---|---|---|---|
| `internet` | Internet | external | — | 0 |
| `traefik` | Traefik | cluster-service | `platform-system-traefik` | 1 |
| `pulse` | pulse *(you are here)* | **self** | `product-pulse-web` | 2 |
| `grafana` | Grafana | cluster-service | `platform-monitoring-prometheus` | 2 |
| `keycloak` | Keycloak | cluster-service | `platform-iam-keycloak` | 2 |
| `prometheus` | Prometheus | cluster-service | `platform-monitoring-prometheus` | 3 |
| `alertmanager` | Alertmanager | cluster-service | `platform-monitoring-prometheus` | 3 |
| `postgres` | PostgreSQL | cluster-service | `platform-db-postgres` | 3 |
| `k8s-api` | k8s API | control-plane | — | 3 |
| `cert-manager` | cert-manager | cluster-service | `platform-system-cert-manager` | 3 |
| `telegram` | Telegram | external | — | 4 |
| `letsencrypt` | Let's Encrypt | external | — | 4 |

- Grafana/Prometheus/Alertmanager 3노드가 같은 앱(`platform-monitoring-prometheus`)에 매핑되는 건 의도(kube-prometheus-stack 한 앱이 셋 다 관리) — 헬스 공유가 정직한 표현.
- `k8s-api`는 헬스 도트 없이 중립 스타일(컨트롤 플레인 — ArgoCD 앱이 아님).

### 3.3 엣지 선언 (전부 — 이 목록이 전체 집합)

```
internet → traefik        (ingress)
traefik  → pulse          (ingress)
traefik  → grafana        (ingress)
traefik  → keycloak       (ingress)
pulse    → prometheus     (query)
pulse    → k8s-api        (read)
grafana  → prometheus     (query)
grafana  → keycloak       (oidc)     ← col2 내 측면 엣지 (허용, 좌표 고정이라 문제 없음)
keycloak → postgres       (db)
prometheus → alertmanager (alert)
alertmanager → telegram   (push)
cert-manager → letsencrypt (acme)
```

GHCR(이미지 pull)은 모든 워크로드 공통이라 그래프 노이즈 → 제외 판단(기각 기록).

### 3.4 렌더링 — `src/components/TopologyGraph.tsx` (신규)

- **순수 SVG, 서버 컴포넌트.** 고정 `viewBox`(예: 900×420), 좌표는 `col`/`row` → x/y 변환(열 간격·행 간격 상수). 자동 레이아웃 알고리즘 금지.
- 노드: rounded rect + 라벨 + 헬스 도트(기존 `HEALTH_COLOR` 재사용). `external`은 점선 테두리, `self`는 강조 테두리 + "you are here". 앱 목록 fetch 실패 시 도트만 중립색 — **그래프 자체는 데이터 없이도 완전 렌더**(선언이므로).
- 엣지: 직선 또는 직각 폴리라인 + `<marker>` 화살촉 + kind 라벨(소문자, 10–11px, 낮은 대비 회색 — 다크모드 대비 확인).
- 모바일: 컨테이너 `overflow-x-auto`, SVG 최소 폭 유지(가로 스크롤 허용). 페이지 body 가로 스크롤 금지.
- 각주(패널 하단): *"Edges are declared in [`topology.ts`](GitHub blob 링크); node health is live from ArgoCD."*
- 배치: `MetricPanel` 바로 아래.

## 4. F2 — 배포 이력 피드

### 4.1 데이터 — `src/lib/k8s.ts` 확장

`fetchArgoApplications()`가 이미 받는 응답에서 `status.history[]`와 `spec.sources[]`/`spec.source`를 추가 파싱한다 (fetch 추가 없음, 파싱만 확장).

```ts
export interface DeployEvent {
  app: string;
  deployedAt: string;          // ISO
  revisions: RevisionRef[];    // 단일 소스면 길이 1
}
export interface RevisionRef {
  display: string;             // SHA면 7자 short, 아니면 "chart 18.5.19"
  href?: string;               // git SHA일 때만: `${repoURL(.git 제거)}/commit/${sha}`
}
```

- 단일 소스: `history[].revision` + `spec.source.repoURL`.
- 멀티소스: `history[].revisions[i]` ↔ `spec.sources[i].repoURL` 인덱스 대응. **SHA 판별은 `/^[0-9a-f]{40}$/`** — SHA만 링크, 차트 버전은 텍스트.
- 전 앱 history 평탄화 → `deployedAt` desc → **최근 8건**. history 없는 앱은 자연 제외(ArgoCD 기본 보관 10건이라 충분).

### 4.2 렌더 — `src/components/DeployFeed.tsx` (신규)

- `Panel` 래퍼, 제목 "Recent Deployments". 행: 상대 시간("3d ago" — 서버 렌더라 hydration 불일치 없음, revalidate 60s 오차 허용) · 앱 이름 · revision 뱃지(링크는 `underline`).
- 배치: `AppGrid` 아래, `CertPanel` 위.

## 5. F3 — Active alerts 칩

### 5.1 데이터 — `src/lib/alertmanager.ts` (신규)

- env `ALERTMANAGER_URL` (§5.3에서 주입). 미설정 시 `{ ok: false, reason: "ALERTMANAGER_URL not configured (running outside cluster)" }` — prometheus.ts와 동일 패턴.
- `GET ${ALERTMANAGER_URL}/api/v2/alerts?active=true&silenced=false&inhibited=false`, timeout 5s.
- 가공: **`alertname === "Watchdog"` 제외**(상시 firing 메타 알림 — 표시하면 영구 노이즈), `labels.severity`별 카운트만 반환. 알림 이름·기타 라벨은 반환 타입에 포함하지 않는다(공개 페이지 노출 최소화를 타입 수준에서 강제).

```ts
export interface AlertSummary { total: number; bySeverity: Record<string, number>; }
```

### 5.2 렌더 — `src/components/AlertChip.tsx` (신규)

- 헤더 우측에 배치(제목과 같은 줄, flex). `total === 0` → "0 active alerts" emerald · `critical > 0` → red · 그 외 → amber. 실패 시 "alerts: unavailable" 중립 회색 — 페이지 전체는 정상 렌더.
- `page.tsx`의 `Promise.all`에 4번째 소스로 추가.

### 5.3 매니페스트 — `deploy/manifests/web/app.yaml`

컨테이너 env에 추가 (이 레포 소관, gitops-infra 변경 없음):

```yaml
- name: ALERTMANAGER_URL
  value: http://platform-monitoring-promet-alertmanager.platform-monitoring.svc.cluster.local:9093
```

## 6. 비범위 / 기각 대안 (재论 금지)

| 대안 | 기각 사유 |
|---|---|
| 서비스 메시/Hubble 기반 엣지 자동 발견 | 시각화를 위한 상시 컴포넌트 추가 — 12GB 리핏·절제 원칙 위반 |
| d3(-force) 등 그래프 라이브러리 | 번들 추가 + 리로드마다 레이아웃 비결정 — 12노드 고정 그래프에 과잉 |
| 알림 상세(이름/라벨) 표시 | 공개 페이지 정보 노출 — 개수/severity까지만 |
| 메트릭 스파크라인 | 장식적 — v2 범위 밖(추후 재검토 가능) |
| blackbox 기반 SLO | 신규 상시 exporter 필요 — 기각 |

## 7. 페이지 최종 구성 (`page.tsx`)

헤더(+AlertChip) → MetricPanel → **TopologyGraph** → AppGrid → **DeployFeed** → CertPanel → 푸터

## 8. 검증 게이트 (acceptance)

1. **정적**: `npm run lint` · `npx tsc --noEmit` · `npm run build` 전부 통과 (CI required checks와 동일).
2. **로컬 렌더 실측** (`npm run dev`, 클러스터 밖): 페이지 정상 렌더 + 라이브 소스 4종 전부 graceful fallback + **그래프는 중립 도트로 완전 렌더**. 라이트/다크 모두 눈으로 확인. 모바일 폭(375px)에서 그래프 가로 스크롤 동작, body 가로 스크롤 없음.
3. **배포 후 실측**: 헬스 도트 전부 초록 / 피드에 실제 SHA 노출 + 커밋 링크 동작(멀티소스 앱은 "chart x.y.z" + SHA 병기) / 알림 칩 "0 active alerts"(현재 firing 0 — Watchdog 제외 로직의 실증).
4. 배포는 기존 2-PR 플로우: 코드 머지 → CI 이미지 push 확인 → `app.yaml` 태그 범프 PR.

## 9. 구현 순서 제안

1. `topology.ts` + `TopologyGraph` (데이터 독립 — 가장 큰 덩어리, 로컬에서 완결 검증 가능)
2. `k8s.ts` history 파싱 확장 + `DeployFeed`
3. `alertmanager.ts` + `AlertChip` + `app.yaml` env
4. `page.tsx` 조립 + 검증 게이트 §8
