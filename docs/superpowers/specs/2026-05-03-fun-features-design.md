# 게임 재미 강화 기능 설계

**날짜:** 2026-05-03  
**목표:** 캐주얼 플레이어의 재플레이 동기를 높이는 두 가지 기능 추가

---

## Feature A: 하이스코어 + 업적 시스템

### 목적
게임 종료 후 기록이 완전히 사라지는 현재 구조를 개선해 "딱 한 판 더" 심리를 유발하는 개인 기록 + 업적 달성 흐름을 만든다.

### 데이터 저장 (localStorage)

| 키 | 형식 | 예시 |
|----|------|------|
| `neon-tetris-highscore` | 숫자 | `42500` |
| `neon-tetris-achievements` | JSON 배열 of string IDs | `["first_tetris","combo_3"]` |

앱 초기화 시 읽고, 갱신 시 즉시 저장.

### UI 변경

**인게임 Stats 패널 (`App.tsx:708–736` 수정)**
- 기존 SCORE / LEVEL / LINES 아래에 `BEST` 항목 추가
- 현재 점수 ≥ 저장된 최고 기록이면 SCORE 텍스트를 핑크(`#ec4899`) → 시안(`#0abdc6`) 색상 전환

**게임 오버 오버레이 (`App.tsx:925–936` 수정)**
- 최고 기록 갱신 시 `★ NEW RECORD ★` 텍스트 추가
- 기존 `FloatingText` 클래스 재사용 → 캔버스에 파티클 이펙트 발동 (현재 handleScore와 동일한 방식)

**업적 토스트 배너 (신규 React state)**
- 업적 달성 시 DOM overlay 상단에 배너 슬라이드인
- 2초 후 자동 소멸
- Tailwind `translate-y` transition 사용

### 업적 정의 (6개)

| ID | 달성 조건 | 표시 이름 |
|----|----------|----------|
| `first_tetris` | 4줄 동시 클리어 | 🔷 테트리스 달성 |
| `first_tspin` | T-Spin 성공 (isTSpin=true) | 🌀 트위스터 |
| `reach_level_5` | level ≥ 5 도달 | ⚡ 속도광 |
| `score_10k` | score ≥ 10,000 | 💎 만점 돌파 |
| `combo_3` | combo ≥ 3 연속 | 🔥 연속기 |
| `b2b` | b2b 보너스 달성 | ⚔️ 백투백 |

달성 시점: `handleScore()` 함수(`App.tsx:500`) 내에서 체크.  
이미 달성된 업적은 재표시하지 않음 (`achievements.includes(id)` 체크).

---

## Feature C: 레벨 시각 진행감

### 목적
레벨이 높아질수록 배경과 색조가 점점 강렬해져, 플레이어가 "더 깊이 들어가고 있다"는 감각을 시각적으로 느끼게 한다.

### 레벨 테마 (4단계)

| 레벨 | 배경 글로우 중앙색 | 분위기 |
|------|-----------------|------|
| 1–3 | `#0a1a3a` (현재 유지) | 입문 — 시안 |
| 4–6 | `#1a0a3a` | 심화 — 퍼플 |
| 7–9 | `#3a1a0a` | 위기 — 오렌지 |
| 10+ | `#1a1a1a` | 마스터 — 화이트 글리치 |

구현: `App.tsx`의 배경 `radial-gradient` 색상을 React state `bgColor`로 관리.  
레벨업 시 state 업데이트 → Tailwind `transition-colors duration-1000` CSS 전환.

### 콤보 HUD 강화

현재: FloatingText로만 표시 (순간적)  
변경: 우측 패널 상단에 `COMBO × N` 상시 표시 DOM 요소 추가
- combo === 0 이면 `opacity-0` (숨김), combo ≥ 1 이면 `opacity-100` 표시
- 색상: combo 1–2 흰색, 3–4 시안, 5+ 핑크

### 게임 오버 하이라이트

기존 오버레이에 "이번 판 기록" 섹션 추가:

| 항목 | 출처 |
|------|------|
| 최고 콤보 | 엔진 내 `maxCombo` 추적 신규 필드 |
| T-Spin 횟수 | 엔진 내 `tspinCount` 추적 신규 필드 |
| Tetris 횟수 | 엔진 내 `tetrisCount` 추적 신규 필드 |
| 플레이 시간 | `Date.now()` 시작~종료 차이 (mm:ss) |

---

## 수정 대상 파일

- `src/App.tsx` — 유일한 수정 파일 (전체 게임 로직 포함)
  - `AudioController` 클래스: 변경 없음
  - 엔진 객체 (`App.tsx:289–743`): `maxCombo`, `tspinCount`, `tetrisCount`, `startTime` 필드 추가
  - `handleScore()` (`App.tsx:500`): 업적 체크 로직 삽입
  - React state: `highscore`, `unlockedAchievements`, `bgColor`, `comboDisplay`, `sessionStats` 추가
  - JSX 오버레이: 업적 토스트, BEST 표시, 게임 오버 하이라이트 추가

---

## 검증 체크리스트

1. `npm run lint` — 타입 오류 없음
2. `npm run dev` 후 플레이:
   - 점수가 하이스코어 초과 시 SCORE 색상 변경 확인
   - 게임 오버 → `localStorage`에 `neon-tetris-highscore` 저장 확인 (DevTools → Application → Local Storage)
   - 새로고침 후 BEST 값 유지 확인
   - 4줄 클리어 시 업적 토스트 출현 확인
   - 레벨 4, 7, 10 도달 시 배경 색상 전환 확인
   - 콤보 3+ 시 HUD 카운터 색상 변화 확인
3. `npm run build` — 빌드 오류 없음
