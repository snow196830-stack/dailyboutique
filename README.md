# 데일리뷰티끄 — 한국어 공식 홈페이지

안양 범계역 **데일리뷰티끄**(눈썹·입술 반영구 / 속눈썹펌)의 한국어 전용 원페이지 사이트입니다.
참고 사이트인 `voi-creative-studio/studio-nunu/` 의 구조(정적 HTML + `data/content.json` + 관리자 페이지 + 검증 스크립트)를 그대로 따랐고, 다국어 전환기 없이 한국어 한 언어로만 동작합니다.

```
daily-boutique/
├── index.html              # 홈페이지 마크업(기본 문구 포함)
├── styles.css              # 디자인·반응형
├── app.js                  # content.json 반영 / 예약 링크 / 갤러리 필터 / 릴스 캐러셀
├── data/
│   └── content.json        # ★ 원장님이 /admin/ 에서 고치는 문구·메뉴·가격·사진·릴스
├── admin/
│   ├── index.html          # 관리자 페이지 (noindex)
│   ├── admin.css
│   └── admin.js            # 폼 → GitHub Contents API 커밋 → 라이브 반영 확인
├── assets/
│   ├── *.jpg               # 실제 시술 사진·원장 사진(인스타그램·네이버 플레이스)
│   ├── og-image.jpg        # 카톡·SNS 공유 썸네일(1200×630)
│   ├── reels/*.mp4|jpg     # 인스타그램 릴스 원본 5편(720×1280) + 썸네일
│   └── fonts/              # 셀프호스팅 서브셋 웹폰트(Noto Serif/Sans KR)
├── preview/                # 검증 스크린샷
├── notes/source-data.md    # 수집한 실제 정보 원본 기록(링크·가격·영업시간 등)
├── tools/
│   ├── build-fonts.py      # 문구 바꾼 뒤 폰트 서브셋 다시 만들기
│   ├── make-og-image.py    # og:image 다시 만들기
│   └── verify.py           # 로컬 서버 + 실제 크로미움 검증·스크린샷
├── robots.txt / sitemap.xml / .nojekyll
```

## 실행

```bash
cd voi-creative-studio/daily-boutique
python3 -m http.server 8000
# → http://localhost:8000/index.html   (관리자: /admin/)
```

정적 파일만으로 동작합니다(서버 사이드 없음). `file://` 로 열면 `content.json` 을 읽지 못하지만, 그때는 `index.html` 에 들어 있는 기본 문구로 그대로 보입니다.

## 배포 (완료 · 2026-11-19)

- 라이브: **https://snow196830-stack.github.io/dailyboutique/** (관리자: `/admin/`)
- 저장소: `snow196830-stack/dailyboutique` (public) · 브랜치 `main` · GitHub Pages `Deploy from a branch` / `/ (root)`
- 최초 배포 커밋: `4d24a30`

### 다시 올릴 때

원본은 이 폴더(`voi-creative-studio/daily-boutique/`)이고, 웹에 나가는 파일만 `voi-creative-studio/daily-boutique-deploy/`(저장소 클론)에 복사해 커밋합니다. `preview/`, `tools/`, `notes/` 는 저장소에 올리지 않습니다.

```bash
SRC=voi-creative-studio/daily-boutique; DST=voi-creative-studio/daily-boutique-deploy
cp "$SRC/index.html" "$SRC/styles.css" "$SRC/app.js" "$SRC/robots.txt" "$SRC/sitemap.xml" "$SRC/.nojekyll" "$SRC/README.md" "$DST"/
cp -r "$SRC/data/." "$DST/data/"; cp -r "$SRC/admin/." "$DST/admin/"; cp -r "$SRC/assets/." "$DST/assets/"
cd "$DST" && git add -A && git commit -m "..." && git push
```

문구·가격·사진만 고칠 때는 저장소를 건드릴 필요 없이 `/admin/` 에서 저장하면 30~60초 뒤 라이브에 반영됩니다.

### 주소가 바뀌면 확인할 곳

`index.html` 의 `og:url` · `og:image` · `canonical`, `admin/admin.js` 의 `REPO` 기본값, `robots.txt` · `sitemap.xml`.

## 관리자 페이지 (`/admin/`) — 원장님 전달용

원장님이 코드 없이 홈페이지 문구·가격·사진을 고치는 페이지입니다. 공개 코드에는 토큰도 비밀번호도 들어 있지 않고, 토큰은 원장님 브라우저에만 저장됩니다.

### 처음 한 번 — 토큰 발급 3단계

1. https://github.com/settings/personal-access-tokens/new (원장님 GitHub 로그인 상태)
2. 아래처럼 설정
   - **Token name**: `dailyboutique-admin`
   - **Expiration**: `1 year`
   - **Repository access**: `Only select repositories` → `snow196830-stack/dailyboutique`
   - **Permissions → Repository permissions → Contents**: `Read and write`
3. **Generate token** → 한 번만 보이는 `github_pat_…` 를 복사해 `/admin/` 에 붙여넣고 **연결하기**

이후에는 문구를 고치고 **[저장 및 홈페이지 반영]** 만 누르면 됩니다(보통 30~60초 뒤 라이브 반영).

### 고칠 수 있는 것

| 영역 | 내용 |
|---|---|
| 1. 기본 · 공지 | 상호, 한 줄 소개, 상단 공지바 |
| 2. 이벤트 배너 | 기간 한정 이벤트(수능 이벤트)의 사용/숨김, 문구·기간·가격표 문구·버튼 |
| 3. 첫 화면 | 영문 소제목, 큰 제목, 소개 문단, 버튼 아래 안내, 배지 |
| 4. 예약 링크 | 카카오톡 채널 / 네이버 예약(반영구·속눈썹펌) / 네이버 플레이스 / 인스타그램 / 전화 |
| 5. 오시는 길 | 주소, 영업시간, 주차, 도보·택시 안내 |
| 6. 시그니처 메뉴 | 카드 추가·삭제·순서, 이름·설명·시술 시간·가격·사진·버튼 |
| 7. 원장 소개 | 사진, 소개 문단, 인용 문구, 특징 4가지 |
| 8. 시술 영상 | 릴스 순서·제목·설명·주소(영상 파일은 `assets/reels/` 에) |
| 9. 사진 | 비포&애프터 12장의 분류·설명·사진·링크 |
| 10. 가격표 | 두 묶음의 항목·시간·금액 |
| 11. 예약 안내 | 3단계, 예약금·취소 안내 |

- 토큰 없이도 **content.json 내려받기·올리기**로 백업·복원할 수 있습니다.
- 기간 한정 이벤트는 **2. 이벤트 배너** 에서 ‘사용 안 함’으로 바꾸면 홈페이지 세 곳(상단 공지바·시그니처 이벤트 카드·가격표 한 줄)에서 동시에 사라집니다. 종료일을 지나면 자동으로 숨겨집니다.
- PIN 잠금(선택): 토큰을 PBKDF2 + AES-GCM 으로 암호화해 저장하고, 열 때 PIN을 묻습니다.
- 새로 넣은 글자가 셀프호스팅 폰트에 없으면 시스템 폰트로 표시됩니다(깨지지 않음). 폰트까지 맞추려면 `python3 tools/build-fonts.py` 를 다시 실행합니다.

## 예약 버튼이 연결되는 곳

| 버튼 | 주소 |
|---|---|
| 카카오톡 예약(헤더·히어로·예약·하단바·플로팅) | https://pf.kakao.com/_ikxhMK |
| 네이버 예약 · 반영구 | https://booking.naver.com/booking/13/bizes/1357067/items/7426344 |
| 네이버 예약 · 속눈썹펌 | https://booking.naver.com/booking/13/bizes/1357067/items/7426378 |
| 네이버 플레이스 | https://naver.me/54LPjPc4 (place 1774123259) |
| 인스타그램 | https://www.instagram.com/daily_boutique_/ |
| 전화 | tel:050713588172 (0507-1358-8172) |

링크를 바꿀 때는 `data/content.json` 의 `channels` 또는 `/admin/` 의 **3. 예약 링크** 한 곳만 고치면 사이트 전체에 반영됩니다.

## 릴스 캐러셀 (`#showcase`)

인스타그램 릴스 5편을 5.2초 간격 자동 슬라이드로 보여 주고, 카드를 누르면 해당 릴스 원문이 새 창으로 열립니다.

| 슬라이드 | 파일 | 원문 |
|---|---|---|
| REEL 01 콤보눈썹 결과 | `reels/DfNA-x4vOdj.*` | https://www.instagram.com/reel/DfNA-x4vOdj/ |
| REEL 02 시술 진행 순서 | `reels/DJEDdN0Tvyo.*` | https://www.instagram.com/reel/DJEDdN0Tvyo/ |
| REEL 03 입술 Q&A | `reels/DZU5_5_vWbV.*` | https://www.instagram.com/reel/DZU5_5_vWbV/ |
| REEL 04 잔혼제거 | `reels/DNAoCwGT_rd.*` | https://www.instagram.com/reel/DNAoCwGT_rd/ |
| REEL 05 공간·향 | `reels/DfWPsXtPrXs.*` | https://www.instagram.com/reel/DfWPsXtPrXs/ |

- 마우스 오버·포커스·스와이프 중 정지, 좌우 버튼·인디케이터·일시정지 버튼 제공, 모바일은 터치 스와이프(스냅).
- `<video muted loop playsinline poster preload="metadata">` 로 화면에 보이는 슬라이드만 재생합니다.
- 영상은 `python3 -m yt_dlp "https://www.instagram.com/reel/<shortcode>/" -f 3` 로 받았습니다(로그인 없이 되는 프로그레시브 mp4).

## 검증

```bash
python3 voi-creative-studio/daily-boutique/tools/verify.py
```

- 로컬 HTTP 서버 + 실제 크로미움(Playwright) 렌더
- 데스크톱 1440×900 / 모바일 390×844
- 콘솔·페이지 에러 0건, 가로 오버플로 0건, 이미지 19장 로드, 릴스 5편 메타 로드·자동 재생·자동 넘김
- 예약 링크(카카오톡·네이버 예약 2종·플레이스·인스타·전화) 실제 href 확인
- `data/content.json` 값이 화면에 반영되는지 확인
- 기간 한정 이벤트(수능): 상단 공지바·시그니처 이벤트 카드·가격표 줄 노출, 상시 프로모 유지, `enabled:false` 또는 종료일 경과 시 숨김
- 영업시간 표기("격주 일요일 휴무")— 오시는 길·푸터
- 갤러리 필터(눈썹 7 / 입술 1 / 속눈썹 1 / 공간 3 / 전체 12)
- `/admin/` 렌더·목록 추가/삭제·되돌리기
- `preview/01~12.png` 재생성

## 정보의 출처와 한계

- 상호·주소·영업시간·전화·주차·편의시설·리뷰 수·가격은 **네이버 플레이스(place 1774123259)** 와 **네이버 예약(biz 1357067)** 에 등록된 값입니다(2026-11-19 확인).
- 릴스·사진·소개 문구·경력·팔로워 수는 **인스타그램(@daily_boutique_)** 에서 확인한 값입니다.
- **확인되지 않아 비워 둔 항목**: 눈썹·입술 반영구의 실제 금액(플레이스에 "변동"으로만 표기), 사업자등록번호, 주차 지원 방식의 세부 조건.
  → 반영구 가격은 카드·가격표 모두 "상담 시 안내"로 표기했습니다. 금액이 정해지면 `/admin/` 에서 바로 채울 수 있습니다.
- 일요일 휴무: 플레이스 정보 탭은 "일 정기휴무(매주 일요일)", 예약 화면은 "격주 일요일 휴무"로 표기가 달랐는데, **원장님 확인으로 "격주 일요일 휴무"로 확정**(2026-11-19)되어 사이트·`/admin/` 안내 문구를 그에 맞추었습니다. 홈페이지에는 **"격주 일요일 휴무 · 공휴일 일정은 예약 전 확인"** 으로 표기했습니다.
- 기간 한정 이벤트: **수능 특별 이벤트(2026.11.9–12.31, 수험생 본인+동반 1인 반영구 30,000원 할인)** 를 인스타그램 릴스(`/reel/DfhbjsTPtrm/`, 2026-11-09)에서 확인해 반영했습니다. 상단 공지바·시그니처 이벤트 카드·가격표 한 줄에 나오고, `/admin/` 의 **2. 이벤트 배너** 에서 한 번에 끄거나 문구를 고칠 수 있습니다(종료일이 지나면 자동 숨김). 적용 세부 조건은 인스타그램에 별도 안내가 없어 **"예약 전 카카오톡 채널로 확인"** 으로만 적었습니다.
- 사진 12장은 모두 데일리뷰티끄가 직접 시술·촬영해 인스타그램과 네이버 플레이스에 올린 것입니다. 외부 스톡 이미지는 쓰지 않았습니다.
- 인스타그램은 비로그인 상태에서 게시물 원본(1080px)이 막혀, 갤러리용으로는 640px 썸네일을 사용했습니다. 원본을 주시면 같은 파일 이름으로 교체하면 됩니다.

### 사진 출처

| 파일 | 출처 |
|---|---|
| `hero-portrait.jpg` | 네이버 플레이스 업체 사진(원장 인물, 원본 2730×4095) |
| `hero-inset.jpg` · `menu-brow.jpg` | 네이버 플레이스 업체 사진(눈썹 결과) |
| `g-brow-before-after.jpg` | 네이버 플레이스 업체 사진(눈썹·아이라인 전후) |
| `about-procedure.jpg` · `g-procedure.jpg` | 인스타그램 /p/DP3SEa8EZ7r/ |
| `menu-lip.jpg` · `g-lip.jpg` | 인스타그램 /reel/DZU5_5_vWbV/ |
| `menu-lash.jpg` · `g-lash.jpg` | 인스타그램 /p/DKgd004T7w7/ |
| `menu-removal.jpg` | 인스타그램 /p/DNfZ0WRzC-c/ |
| `g-brow-combo.jpg` | 인스타그램 /p/DK1aVCHTF5u/ |
| `g-brow-sheet.jpg` | 인스타그램 /p/DQWM_PZkW44/ |
| `g-brow-natural.jpg` | 인스타그램 /p/DRbqS9lEfS3/ |
| `g-brow-soft.jpg` | 인스타그램 /p/DcM_GDuGUYO/ |
| `g-brow-eyes.jpg` | 인스타그램 /reel/DfNA-x4vOdj/ |
| `g-brow-choice.jpg` | 인스타그램 /p/DL9crw_TUHS/ |
| `g-studio.jpg` | 인스타그램 /p/DOYH_t3kcJt/ |
| `g-studio-detail.jpg` | 인스타그램 /reel/DfWPsXtPrXs/ |

## 라이선스

- 폰트: Noto Serif KR / Noto Sans KR (SIL Open Font License 1.1) — 글자 단위 서브셋으로 셀프호스팅.
- 사진·영상: 데일리뷰티끄 소유. 다른 곳에서 사용하려면 업체의 허락이 필요합니다.
