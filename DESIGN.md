# Design: 최정현 교수님 연구실 홈페이지 (연구홍보용)

**Generated:** 2026-04-14 (v1.1 — 실제 데이터 반영)
**Mode:** Builder (공식 홍보물)
**Status:** APPROVED (설계 단계, 구현 전)
**Approach:** A — 정적 HTML/CSS/JS + JSON 데이터 분리

---

## 0. 연구실 핵심 정보 (확정)

| 항목 | 값 |
|---|---|
| **연구실명 (영문)** | Advanced Energy Materials & Processing Lab |
| **연구실명 (국문)** | 차세대 에너지 소재 및 공정 연구실 |
| **약칭** | AdvEM Lab |
| **PI** | Junghyun Choi (최정현), Assistant Professor |
| **소속** | School of Chemical, Biological and Battery Engineering, Gachon University (가천대학교 화공생명배터리공학부) |
| **이메일** | junghchoi@gachon.ac.kr |
| **기존 홈페이지** | https://sites.google.com/view/advemlab |
| **Google Scholar** | https://scholar.google.com/citations?user=kSp8NsEAAAAJ |
| **Citations (전체 / 최근 5년)** | 2,043 / 1,382 |
| **h-index** | 23 |
| **i10-index** | 44 |

### 핵심 연구 키워드
Battery · Battery Electrode · Electrochemistry · Photoelectrode

### 세부 연구 주제 (Research Topics 초안)
1. **Dry Electrode Process** — 건식 전극 공정, Roll-to-Roll, Thick Electrode
2. **Next-Gen Lithium Batteries** — Li-S, Li-metal, LiFePO4 고에너지밀도 셀
3. **Battery Materials & Separators** — 분리막, 복합 소재, 인터페이스
4. **Photoelectrodes** — BiVO4, TiO2 광촉매/광전극 (초기 연구 트랙)

### 최근 성과 (v1 Board/News 시드 콘텐츠)
- **RSC *Journal of Materials Chemistry A* 2026 Emerging Investigator** 선정 ⭐
- **과학기술정보통신부 중견연구자지원사업** 선정
- 기타 정부 지원 사업 5건 선정
- 대표 논문: *Adv. Energy Mater.* 2024 (Roll-to-Roll 100 mAh cm⁻² Cathode), *Small Science* 2024 (Low-Resistance LiFePO4 Dry Electrode)

---

## 1. Problem Statement

최정현 교수님 연구실의 공식 홍보용 웹사이트를 제작한다. 주된 목적은 **대학원 입실 고민 학생**이 3분 내에 "이 연구실에 지원하고 싶다"는 판단을 내릴 수 있도록, 연구 성과 · 연구 테마 · 구성원 정보를 **균형 있게** 전달하는 것.

## 2. What Makes This Cool

- **한 스크롤 안의 연구실 요약:** 메인 랜딩 화면에서 "무엇을 연구하는 사람들인지 / 얼마나 잘하는지 / 누가 있는지"를 한 번에 전달.
- **정적 사이트지만 살아 있는 느낌:** Board(공지) 최상단이 논문 accept · 학생 수상 · 세미나 개최로 자주 업데이트 → 방문자에게 "활발한 연구실" 이미지.
- **10년 유지보수 가능:** JSON 파일만 수정하면 누구나 publications/member 추가 가능. 특정 프레임워크 종속성 0.

## 3. Constraints

- 기술 스택: 정적 HTML/CSS/JS only (프레임워크·빌드 툴 없음)
- 콘텐츠 원본: 교수님 CV + 논문 리스트 확보 상태
- 배포: GitHub Pages 또는 Netlify (무료, 커스텀 도메인 가능)
- 다국어: 국문(ko) / 영문(en) v1 필수
- 반응형: 데스크톱 / 모바일 대응

## 4. Premises (agreed)

1. 입실 고민 학생이 3분 내 "지원하고 싶다" 판단하도록 한다.
2. Publications 는 '자랑'이 아닌 '연구력의 증거' — Top Picks / 주요 저널 / 인용수 우선.
3. Board 는 뉴스성 업데이트로 '살아있는 연구실' 신호를 준다.
4. 데이터는 JSON 으로 분리해서 HTML 수정 없이 콘텐츠 갱신 가능하게 한다.
5. 다국어(국/영) 는 v1 필수.

## 5. Sitemap (메인 배너 + 세부 배너)

```
Home (/)
│
├── Member (/member)
│   ├── Professor           — 교수님 프로필, CV, 경력, 수상
│   ├── Postdoc             — 박사후연구원
│   ├── Ph.D. Students      — 박사과정
│   ├── M.S. Students       — 석사과정
│   └── Alumni              — 졸업생 (현 소속 포함)
│
├── Research (/research)
│   ├── Overview            — 연구 비전, 전체 테마 소개
│   ├── Topic 1             — 주제별 상세 (교수님과 정할 것)
│   ├── Topic 2
│   ├── Topic 3
│   └── Facilities          — 보유 장비·시설
│
├── Publications (/publications)
│   ├── Top Picks / Selected — 교수님 선정 대표 논문 5~10편
│   ├── Journal             — 저널 논문 (연도별 역순)
│   ├── Conference          — 학회 논문
│   └── Books / Patents     — 저서, 특허
│
├── Board (/board)
│   ├── News                — 논문 accept, 수상, 학생 소식
│   ├── Notice              — 입실 공지, 장학금 공지
│   └── Seminar             — 세미나 · 콜로키움
│
└── Contact (/contact)
    ├── Location            — 약도, 주소, 교내 위치
    ├── Inquiry             — 문의 이메일, 교수님 연락처
    └── Join Us             — 대학원 지원 가이드 (핵심 CTA)
```

## 6. Page Structure (주요 페이지)

### 6.1 Home (/)
**목적:** 3분 판단 지원. 세 축 균형 노출.
- Hero: 연구실명 + 한 줄 슬로건 + 배경 이미지 (연구실 내부 or 연구 시각화)
- Section 1: "What we do" — 연구 테마 3개를 카드로 (→ Research)
- Section 2: "Recent highlights" — 최근 논문 3편 + 최근 뉴스 3건
- Section 3: "People" — 교수님 + 현 구성원 수 + 대표 사진 (→ Member)
- Section 4: "Join us" — 입실 고민 학생용 CTA (→ Contact/Join Us)
- Footer: Contact 요약

### 6.2 Member
- Professor 는 상세 프로필 (사진, 약력, 수상, 외부 링크)
- Students 는 그리드 카드 (사진, 이름, 학위과정, 관심분야, 이메일)
- Alumni 는 간소 리스트 (졸업년도, 이름, 현 소속)

### 6.3 Research
- Overview: 연구실 비전 1-2문단 + 테마 간 관계도(옵션)
- 각 Topic: 문제 정의 → 접근 방법 → 대표 성과(Publications 링크) → 관련 이미지/그림
- Facilities: 장비 사진 + 스펙 (산업체/과제 담당자에게 효과적)

### 6.4 Publications
- 기본 뷰: "Top Picks" 상단 고정 → 이후 Journal 연도별 역순
- 각 항목: 저자 (우리 연구실 구성원 bold), 제목, 저널, 연도, DOI/PDF 링크
- 필터: 연도 버튼 (2024 / 2023 / 2022 ...) 및 카테고리 탭 (Journal / Conference / Books)

### 6.5 Board
- News/Notice/Seminar 3개 탭
- 리스트: 날짜 + 제목, 클릭 시 상세 (같은 페이지 내 아코디언 또는 개별 HTML)
- Home 섹션 2 가 Board 의 최신 3건을 자동으로 (JS fetch) 가져옴

### 6.6 Contact
- 지도: Google Maps iframe 또는 정적 지도 이미지
- 문의 이메일 + 연구실 위치/호수
- "Join Us" 섹션: 대학원 지원 프로세스, 모집분야, 권장 배경, 지원 마감 안내

## 7. Data 구조 (JSON)

```
/data/
├── members.json           — [{id, name_ko, name_en, role, photo, interests, email, cv_link}]
├── publications.json      — [{id, type: "journal"|"conference"|"book", title, authors, venue, year, doi, top_pick: bool}]
├── research_topics.json   — [{id, title_ko, title_en, summary, detail_md, image}]
├── news.json              — [{id, date, category: "news"|"notice"|"seminar", title_ko, title_en, body_ko, body_en}]
└── config.json            — 연구실명, 슬로건, 연락처, 주소, 소셜 링크
```

**업데이트 방법:** 예) 논문 추가 = `publications.json` 에 객체 하나 append. HTML 건드리지 않음.

## 8. 디렉터리 구조

```
연구실 홈페이지/
├── index.html
├── member.html
├── research.html
├── publications.html
├── board.html
├── contact.html
├── /assets/
│   ├── /images/              — 구성원 사진, 연구 이미지, 로고
│   ├── /icons/               — favicon, 소셜 아이콘
│   └── /pdf/                 — CV, 선정 논문 PDF
├── /css/
│   └── style.css             — 단일 CSS 파일
├── /js/
│   ├── main.js               — 공통 (네비게이션, 다국어 토글)
│   ├── publications.js       — publications 렌더링 + 필터
│   ├── members.js            — members 렌더링
│   └── board.js              — board 렌더링 + 탭
├── /data/                    — (위 7번 JSON 파일들)
├── /locales/
│   ├── ko.json               — UI 텍스트 국문
│   └── en.json               — UI 텍스트 영문
├── DESIGN.md                 — (본 문서)
├── README.md                 — 유지보수 가이드 (콘텐츠 업데이트 방법)
└── CNAME                     — (커스텀 도메인 사용 시)
```

## 9. 다국어 처리 방식

- HTML 요소에 `data-i18n="publications.title"` 속성
- `main.js` 가 `localStorage` 에서 현재 언어 읽고 `locales/{lang}.json` 으로 치환
- 헤더 우측 "KO | EN" 토글 버튼
- JSON 데이터 자체도 `title_ko` / `title_en` 필드로 이중화
- URL 파라미터 `?lang=en` 도 지원 (공유 가능)

## 10. 디자인 방향 (v1)

- **톤:** 깔끔한 학술적 인상. 과도한 애니메이션/그라디언트 배제.
- **색상:** 메인 1색 (교수님 선호 or 학교 심볼 컬러) + 중립 그레이 + 흰 배경
- **타이포:** 본문 국문(Noto Sans KR) + 영문(Inter), 제목은 조금 굵게
- **레이아웃:** 최대 너비 1200px 중앙 정렬, 모바일 단일 컬럼
- **이미지:** 구성원 사진 정사각형 통일, 연구 이미지 16:9 통일

## 11. Recommended Approach: A (정적 + JSON)

**선택 이유:**
- 연구실 홈페이지 실제 수명(5~10년)에 가장 부합
- 유지보수자(학생)가 JSON 만 편집하면 됨 — 빌드·배포 지식 불필요
- 프레임워크 deprecation 리스크 0
- GitHub Pages 무료 + 커스텀 도메인 가능

## 12. Open Questions (교수님/사용자 확인 필요)

**해소된 항목:**
- ✅ 연구실명 / 영문명 / 소속 / 이메일 — Google Sites + Scholar 확인 완료
- ✅ PI 기본 정보 및 연구 키워드 — 확인 완료
- ✅ 대표 논문 Top Picks 후보 — Google Scholar 기반 10편 초안 확보
- ✅ 최근 수상/선정 이력 — RSC Emerging Investigator, 중견연구 등 확인

**여전히 확인 필요한 항목:**
1. **Research Topics 세부 항목 확정:** 초안(4개)에 대해 교수님 승인 또는 재조정
2. **로고/메인 컬러:** 가천대 상징색(브릭레드 #8B2332 계열)을 기본으로 가되, 교수님 선호 확인
3. **구성원 명단:** 현재 학생/박사후연구원 명단, 각자 사진·연구주제·이메일
4. **구성원 사진:** 프로필 사진 확보 여부 (없으면 이니셜 아바타 플레이스홀더)
5. **연구실 전경 사진:** Hero 이미지용 연구실 내부/장비 사진
6. **Publications 전체 리스트:** Google Scholar 외 미등재 논문 포함 여부 (교수님 CV 대조)
7. **보유 장비:** Research > Facilities 섹션 채울 장비 리스트
8. **도메인:** 가천대 서브도메인? 독자 도메인(예: advemlab.com)? 기존 Google Sites URL 유지?
9. **영문 콘텐츠:** 연구 테마 영문 설명 누가 작성? (PI 직접 / 학생 번역)
10. **교수님 CV 상세:** 학력, 경력, 수상 이력 전문 텍스트 (PI 페이지용)

## 13. Success Criteria (v1 완료 기준)

- [ ] 5개 메인 배너 + 세부 배너 모두 접근 가능
- [ ] 모바일/데스크톱 반응형 동작
- [ ] KO/EN 토글 정상 동작
- [ ] Publications JSON 에 논문 1편 추가 시 HTML 수정 없이 화면 반영
- [ ] Home 에서 최신 News/Publications 자동 표시
- [ ] Lighthouse 성능 점수 ≥ 90 (정적이라 쉽게 달성)
- [ ] 입실 고민 학생 1명에게 테스트 → "여기 지원하고 싶다/아니다" 피드백 수집

## 13.5 기존 Google Sites 대비 차별화 포인트

기존 사이트(`sites.google.com/view/advemlab`)는 Home / PI / Members / Publication / Contact 5개 구조이며, 다음이 약합니다:

| 약한 부분 | 새 사이트의 보강 방향 |
|---|---|
| **Research 섹션 부재** | 4개 Research Topics 를 독립 섹션으로 신설 — 산업체·학생 유인력 ↑ |
| **Board/News 없음** | Emerging Investigator 수상, 과제 선정, 논문 Accept 뉴스를 상단 노출 → "살아있는 연구실" 신호 |
| **시각 디자인 제약** | Google Sites 템플릿 탈피, 연구실 아이덴티티 반영한 커스텀 디자인 |
| **성과 지표 미노출** | Citations 2,043 / h-index 23 / 대표 저널 이름을 Hero 에 시각화 |
| **모바일 최적화 부족** | 반응형 레이아웃, 빠른 로딩 |
| **다국어 불완전** | KO/EN 완전 대응 |

## 14. Next Steps (구현 순서 제안)

**Step 1 — 스켈레톤 (0.5일)**
- 디렉터리 구조 생성
- 6개 HTML 뼈대 + 공통 헤더/푸터/네비게이션
- `config.json` 으로 연구실명/연락처 세팅

**Step 2 — 데이터 스키마 확정 + 더미 채움 (0.5일)**
- `data/*.json` 초안 작성 (교수님 CV 기반)
- 구성원 사진 플레이스홀더

**Step 3 — CSS 디자인 시스템 (0.5~1일)**
- 색상/타이포/간격 변수 정의
- 공통 컴포넌트(카드, 리스트, 네비) 스타일

**Step 4 — 페이지별 렌더링 JS (1~2일)**
- publications.js 필터/연도 그룹핑
- members.js 역할별 그룹핑
- board.js 탭

**Step 5 — 다국어 (0.5일)**
- locales/ko.json, locales/en.json
- 토글 버튼 + localStorage 연동

**Step 6 — 실 콘텐츠 입력 + QA (1일)**
- 교수님으로부터 받은 실데이터 JSON 입력
- 모바일 테스트
- 입실 고민 학생 1명 UX 테스트

**Step 7 — 배포 (0.5일)**
- GitHub Pages 또는 Netlify 연결
- 커스텀 도메인 설정 (필요 시)

**총 예상: 4~6일 (실 콘텐츠 확보 시점이 임계 경로)**

---

## 15. What I noticed

- "성과 · 테마 · 사람 세 축 모두 균형" 을 택하신 것은 실제 연구실 운영 경험이 있는 분의 감각입니다. 한 축에 치우친 연구실 홈페이지는 방문자 해석이 고정되기 쉽습니다.
- "정적 HTML 추천안을 바로 수용" 하신 것도 본질적으로 합리적 — 연구실 홈페이지의 숨겨진 요구사항은 **"5년 후 박사과정 학생이 손쉽게 publications 를 추가할 수 있는가"** 입니다.
- 세부 배너 질문에 "지금 써놓은 거 다 좋아" 라고 답하신 건 세부 구조에 큰 이견이 없다는 신호 — 이후 구현 단계에서 교수님 요청에 따라 유연하게 조정 가능한 설계를 짜두었습니다.

---

**STATUS: APPROVED (설계 단계)**
