# Advanced Energy Materials & Processing Lab (AdvEM Lab)

가천대학교 화공생명배터리공학부 **최정현 교수 연구실** 공식 홈페이지.

## 구조

```
├── index.html              홈
├── member.html             구성원
├── research.html           연구분야
├── publications.html       연구성과
├── board.html              소식
├── contact.html            연락처
├── css/style.css           전체 스타일 (CSS 변수로 컬러 한 곳에서 관리)
├── js/
│   ├── main.js             공통 (다국어, 네비, 데이터 로딩)
│   ├── home.js             홈 페이지 렌더링
│   ├── members.js          구성원 페이지 렌더링
│   ├── research.js         연구분야 페이지 렌더링
│   ├── publications.js     논문 페이지 (필터 포함)
│   └── board.js            소식 페이지 (탭 포함)
├── data/
│   ├── config.json         연구실 기본 정보 · 지표 · 연락처
│   ├── research_topics.json 연구 주제 (4개)
│   ├── publications.json   논문 리스트
│   ├── members.json        구성원
│   └── news.json           뉴스/공지/세미나
├── locales/
│   ├── ko.json             국문 UI 텍스트
│   └── en.json             영문 UI 텍스트
├── assets/
│   ├── images/             사진 (구성원, 연구, 로고)
│   ├── icons/              favicon 등
│   └── pdf/                CV, 논문 PDF
└── DESIGN.md               설계 문서
```

## 관리자 페이지 (폼 기반 편집)

JSON 파일을 직접 편집하지 않고 웹 UI 로 콘텐츠를 관리하고 싶으시면 `/admin.html` 사용.

**접속:** `http://localhost:8000/admin.html` (로컬) 또는 배포 URL `/admin.html`

**기본 비밀번호:** `advemlab2026` — 첫 로그인 후 **설정** 탭에서 반드시 변경하세요.

**워크플로우:**
1. 로그인
2. 편집 (논문 / 구성원 / 소식 / 연구주제 / 기본설정)
3. **💾 저장** 버튼 클릭 → JSON 파일이 자동 다운로드됨
4. 다운로드된 `xxx.json` 을 `data/xxx.json` 과 교체 (덮어쓰기)
5. 서버에 업로드 (또는 로컬이면 파일만 교체)
6. 공개 사이트 새로고침 → 반영

**소프트 게이트 보안 안내:**
- 이 관리자 페이지는 **실수 방지용** 게이트이며 진짜 인증이 아닙니다.
- 비밀번호 해시가 JS 소스에 노출됩니다.
- 실제 사이트 변경은 파일 교체가 필요하므로 "편집 UI" 자체만으로는 사이트가 바뀌지 않습니다.
- 진짜 인증 + 자동 배포가 필요하면 GitHub Pages + **Decap CMS** (GitHub OAuth) 로 업그레이드 권장.

## 콘텐츠 업데이트 방법 (학생/운영자용)

### 논문 1편 추가
`data/publications.json` 배열 맨 앞에 객체 하나 추가:

```json
{
  "id": "p2026-new-paper",
  "type": "journal",
  "top_pick": false,
  "year": 2026,
  "title": "논문 제목",
  "authors": "First Author, ..., J. Choi",
  "venue": "저널명",
  "volume": "권(호)",
  "citations": 0,
  "doi": "",
  "link": ""
}
```

`top_pick: true` 로 설정하면 홈 화면과 Top Picks 필터에 노출.

### 구성원 추가
`data/members.json` 에 객체 추가. `role` 은 `professor`/`postdoc`/`phd`/`ms`/`alumni` 중 하나.

### 뉴스/공지/세미나 추가
`data/news.json` 에 객체 추가. `category` 는 `news`/`notice`/`seminar` 중 하나.

### 연구실 기본 정보 변경
`data/config.json` — 이메일, 주소, 슬로건 등.

### UI 텍스트 번역 변경
`locales/ko.json`, `locales/en.json` — 메뉴명, 버튼 문구 등.

### 메인 컬러 변경
`css/style.css` 최상단 `:root { --color-primary: ... }` 한 줄만 수정.

## 로컬에서 확인 (개발/미리보기)

`fetch()` 로 JSON 을 로딩하므로 `file://` 열기는 동작하지 않습니다. 로컬 서버 필요.

**Python 3:**
```bash
cd "이 폴더 위치"
python -m http.server 8000
# → http://localhost:8000 에서 확인
```

**Node.js (npx):**
```bash
npx serve .
```

**VS Code:** Live Server 확장 설치 후 `index.html` 우클릭 → "Open with Live Server"

## 배포 (GitHub Pages 무료)

1. GitHub 에서 새 repo 생성 (예: `advemlab-website`)
2. 이 폴더 전체를 push
3. Repo Settings → Pages → Branch: `main` / `/ (root)` 선택
4. 몇 분 뒤 `https://<org>.github.io/<repo>/` 에서 접속 가능
5. 커스텀 도메인 원하면 `CNAME` 파일에 도메인 작성 후 push

## 기술 스택

- Vanilla HTML + CSS + JavaScript (프레임워크 없음)
- Google Fonts (Noto Sans KR, Inter)
- JSON 기반 데이터 관리

의존성 0. 빌드 과정 없음. 오래 유지보수 가능한 구조.

## 설계 원칙

자세한 내용은 `DESIGN.md` 참조.
