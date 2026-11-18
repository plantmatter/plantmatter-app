# PLANT MATTER 앱 — v0.1.4 (베타)

내가 키우는 식물과 야생에서 관찰한 식물을 기록하고, 식물 행사·매장을 소개하는 **iPhone / Android 앱**입니다.
React Native + Expo로 만들고, 서버는 Supabase를 씁니다.

## v0.1.4에서 바뀐 것
1. **앱과 웹 계정 통합:** plantmatter.kr(웹 저장소 `plantmatter-web`)은 이미 이 앱과 **같은 Supabase 프로젝트·같은 계정**으로 로그인합니다. 웹 쪽 `supabase/web01_shop_customers.sql`이 실제 DB에 적용된 것을 확인했고, 앱 DB 규칙 87개가 웹 SQL과 함께 있어도 그대로 통과합니다(앱 가입은 웹 회원 정보를 만들지 않고, 웹 가입은 만들고, 계정 삭제 시 함께 지워짐).
   - 앱의 Account 화면과 개인정보 안내에 "같은 계정으로 plantmatter.kr에도 로그인" 안내와, 계정 삭제 시 웹 회원 정보도 지워진다는 문구를 넣었습니다.
2. **상세 화면 사진:** 회색 여백 없이 가득. 사진마다 비율에 맞춰 칸 높이가 정해지고(가로 최대 4:3, 세로 최대 9:16, 그보다 길거나 넓으면 살짝 잘라 채움), 넘길 때 손가락을 따라 높이가 부드럽게 바뀝니다. (식물·관찰 기록 상세)
3. **편집 버튼 → 연필 아이콘** (라임색·글자 없음, 화면 읽기에서는 "편집")
4. **과(Family):** 식물·관찰 기록 모두 학명 맨 위에 입력. 이름은 속부터 그대로이고, 상세 요약 표에 "과" 줄이 생깁니다. 같은 속에 전에 적은 과가 있으면 자동으로 채워지고, 전에 쓴 과는 버튼으로 고릅니다.
5. **관찰 기록 한정어 sp.:** [없음 / sp. / cf. / aff.]. sp.를 고르면 종소명·명명자는 잠기고 **추가 식별명**을 쓸 수 있습니다. 예) *Selaginella* sp. 'Blue'. (참고: Sigovini, Keppel & Tagliapietra 2016, *Open Nomenclature in the biodiversity era*)

### v0.1.4 적용 방법
1. Supabase **SQL Editor**에서 **`supabase/v0.1.4.sql`**을 실행합니다(v0.1.1~v0.1.4 포함, 다시 실행해도 안전).
2. 새 휴대폰 기능이 없어서 다시 빌드하지 않고 EAS Update로 보냅니다.
   ```bash
   npx eas-cli@latest update --channel production --environment production --message "v0.1.4"
   ```

## v0.1.3에서 바뀐 것
**화면 다듬기 (참고 디자인 반영)**
1. **My Plants 분류 목록:** 분류 사이에 얇은 연회색 선, 개수는 제목 오른쪽 아래(글자 바닥선)에 작게.
2. **분류 페이지의 식물 목록:** 앞의 사진은 그대로 두고, 이름은 굵게(기울이지 않음), 줄 높이 넉넉히, 오른쪽 › 크게, 위아래 얇은 선.
3. **식물 상세:** 사진을 화면 가득 → 학명 · 동정 상태 · 구입처 표 → 메모(위아래 선) → 관수 줄과 라임색 **주기 리셋**. ∨를 누르면 속·별칭·원산지·모본·부본·마지막 관수·자손·공개 설정·삭제가 펼쳐집니다. 편집은 위쪽 라임색 **Edit**.
4. **관찰 기록 상세:** 사진 → 학명 · 동정 상태 · 관찰 위치 · 관찰 일자 → ∨를 누르면 **Found Wild**
   - ○ 항목 줄(발견 날짜·시각, 세부 위치, 좌표, 위치 공개, 해발고도, 생육 형태, 서식지 유형, 기질, 생육 상태)과 현장 관찰 기록
   - **ENVIRONMENTAL MEASUREMENTS**(2열 표)와 **COLLECTION & RESEARCH**. 값이 하나도 없는 묶음은 숨기고, 일부만 있으면 빈 칸에 "미기록"
   - 공개 설정, 고유 기록 번호(누르면 복사), 삭제

**새 항목**

5. **My Plants 구입처(Shop):** 직접 입력하거나 MATTER 매장·전에 쓴 구입처를 버튼으로 고릅니다.
6. **관수:** "마지막 관수 후 N일이 지났습니다" + **주기 리셋**(오늘 물 준 것으로 기록). 휴대폰 알림은 아직 없습니다.
7. **관찰 기록:** 발견 시각, 생육 형태(착생·지생·암생·덩굴·수생 또는 직접 입력), 서식지 유형(예전 "서식 환경"), 기질, 생육 상태(영양 생장·꽃봉오리·개화·결실·휴면)
   - **환경 측정(선택, 접어 둠):** 조도(lux), PPFD(µmol/m²/s), 기온(°C), 상대습도(%), 측정 날짜·시각, 측정 근거(실측·기상 자료·추정), 측정 장비
   - **채집·연구(선택, 접어 둠):** 필드 번호, 관찰자(이 묶음으로 옮김), 개체군(1·2–10·11–100·100 이상), 동반 식생, 표본·바우처

**그 밖에:** About에 v0.1.3이 표시됩니다. 앱 설정의 iOS/Android 빌드 번호는 EAS가 관리하므로 지웠습니다.

### v0.1.3 적용 방법 (TestFlight 앱)
1. Supabase **SQL Editor**에서 **`supabase/v0.1.3.sql`**을 실행합니다. v0.1.1~v0.1.3이 모두 들어 있고, 여러 번 실행해도 안전합니다.
2. 새 휴대폰 기능은 없어서 **다시 빌드할 필요가 없습니다.** EAS Update로 production 채널에 보내면, TestFlight 앱을 완전히 껐다 켤 때 내려받고 **한 번 더 껐다 켜면** 적용됩니다.
   ```bash
   npx eas-cli@latest update --channel production --environment production --message "v0.1.3"
   ```
   - app.json의 `version`(0.1.2)은 설치된 앱과 맞춰야 업데이트가 적용되므로 그대로 둡니다. 화면에 보이는 버전은 `src/lib/release.ts`에 있습니다.

## v0.1.2에서 바뀐 것
**My Plants**
1. **첫 화면은 "All" 한 줄부터:** 처음에는 All (0)만 보이고, 식물을 등록하면 속 분류가 All 아래에 생깁니다. 식물이 없는 분류는 보이지 않습니다. 아래의 큰 All 숫자는 그대로입니다.
2. **분류를 누르면 새 페이지:** All·속·미분류를 누르면 그 식물만 모인 페이지로 넘어갑니다.
   - 속 페이지에는 "이름 변경"이 있습니다. 이미 있는 속 이름으로 바꾸면 합쳐지고, 합쳐진 속 페이지로 넘어갑니다.
   - 화면 안의 동그란 ＋는 없앴습니다. **오른쪽 위 ＋ 하나**로 추가하고, 속 페이지에서 누르면 그 속이 미리 채워집니다.
3. **식물 이름 검색:** All·속 페이지 맨 위. 학명(속·종소명·추가 식별명)과 별칭에서 찾고, 대소문자·따옴표는 무시합니다.
   - 돋보기는 plantmatter.kr과 같은 그림이고, 검색칸도 웹처럼 밑줄 한 줄입니다.
4. **"품종·교배명" → "추가 식별명"** (저장 형식은 그대로: *Dischidia* sp. 'Dwarf')

**사진 (식물·관찰·행사·매장 공통)**

5. "앨범·촬영" 버튼 대신 사진 칸의 **＋**. 누르면 앨범에서 선택 / 사진 촬영 / 취소 중에서 고릅니다.
6. **사진을 길게 눌러 끌면 순서가 바뀝니다.** 맨 앞 사진에 "대표" 표시가 붙습니다.

**이름 미리보기**

7. "저장될 이름"은 입력칸이 아니라 **글자로만** 보입니다(식물·관찰 기록).

**관찰 기록 (My Observations만)**

8. **명명자**와 **cf. / aff.** 를 기록합니다. 이름은 식물학 관례대로 속·종소명만 기울이고 sp.·cf.·aff.·명명자는 바로 세웁니다. 예) *Bulbophyllum* cf. *echinolabium* J.J.Sm.
9. **기록 항목:** 관찰자 · 관찰 일자 · 관찰 위치(나라·지역, 세부 위치, 좌표) · 해발고도 · 서식 환경 · 관찰 사진 · 현장 관찰 기록 · 고유 기록 번호
   - **좌표:** 직접 입력하거나 지도 앱의 좌표를 붙여 넣습니다(6.0753, 116.5583 / 6°04'31"N 116°33'30"E). "현재 위치" 버튼은 휴대폰 GPS로 좌표와 고도를 채웁니다. 위치 권한은 이 버튼을 처음 누를 때만 묻습니다.
   - **위치 공개 설정:** 기본은 **비공개**입니다. 공유 기능이 생긴 뒤에도 다른 사람에게는 나라·지역까지만 보입니다.
   - **고유 기록 번호:** `PM-2026-7K3QX9` 형식. 처음 저장할 때 만들어지고(인터넷이 없어도) 바꿀 수 없습니다. 상세 화면에서 누르면 복사됩니다.
   - 이에 맞춰 약관·개인정보 처리방침의 위치 정보 부분을 고쳤습니다.

**그 밖에**

10. `@expo/ngrok`를 프로젝트에 넣어서, `npx expo start --tunnel ngrok`이 설치 질문 없이 바로 됩니다.

### v0.1.2 적용 방법
1. Supabase **SQL Editor**에서 **`supabase/v0.1.2.sql`**을 한 번 실행합니다.
   - v0.1.1 변경도 들어 있어서, v0.1.1.sql을 실행했든 안 했든 이 파일 하나면 됩니다. 여러 번 실행해도 안전하고 지우는 데이터는 없습니다.
   - 실행 전에 앱으로 저장하면 "데이터베이스 업데이트가 필요합니다" 안내가 나옵니다.
   - 지금 있는 관찰 기록에도 고유 기록 번호가 붙습니다.
2. PC의 앱 폴더를 새 코드로 바꾸고 `npm install`을 한 번 실행합니다(새 패키지: 위치, 그림(SVG), 복사, ngrok).
3. 실행합니다.
   ```bash
   npx expo start --tunnel ngrok
   ```

## v0.1.1에서 바뀐 것 (요약)
- PLANT 탭 이름: My Plants(나의 식물 살펴보기) · My Observations(나의 관찰 식물 모아보기)
- 구분선을 얇은 연회색(1px, #D0D0D0)으로. Event 목록의 검은 선은 그대로
- 관찰 기록은 나라 또는 "동남아시아 전체"처럼 지역만 골라도 됨(검색 가능)
- My Plants 분류 = 속. 등록할 때 입력한 속이 분류가 되고, 전에 쓴 속은 버튼으로 고름
- 식물 등록: 사진 → 학명(속*, 종소명, 추가 식별명) → 원산지 → 모본·부본(선택) → 메모 → 공개/비공개 → 별칭·동정 상태
- v0.1에서 쓰던 식물은 "미분류"에 있고, 수정 화면을 열면 이름이 나뉘어 들어갑니다.

## v0.1 기능
- **하단 탭:** HOME · PLANT · MATTER · OPTION (글자만)
- **HOME:** 다가오는 행사 포스터를 화면 가득, 가까운 날짜부터 보여 줍니다.
  - 손으로 넘기고, 누르면 행사 상세로 갑니다.
  - 행사가 없으면 로고 화면이 나옵니다.
  - 인터넷이 없을 때는 마지막으로 받은 포스터를 보여 줍니다.
- **PLANT › My Plants:** All과 속별 페이지(위 v0.1.2 참고). 원산지는 넓은 지역 → 나라 또는 섬, 지역까지만도 가능. 모본(♀) × 부본(♂)과 "이 식물의 자손" 목록.
- **PLANT › My Observations:** 지역 → 나라 → 기록 순서의 목록입니다.
  - 목록은 나라·지역으로 묶습니다. 세부 위치·좌표(v0.1.2)는 기본으로 비공개입니다.
  - 사진은 휴대폰에서 다시 저장해 사진 속 위치 정보(EXIF)를 지운 뒤 올립니다.
  - **인터넷이 없어도 저장됩니다.** 휴대폰에 보관했다가 연결되면 자동으로 올라갑니다.
- **MATTER:** EVENT(라임색 목록, 지난 행사는 아래에 흐리게)와 SHOP LIST(주소 → 네이버/구글 지도 앱).
  - 누구나 볼 수 있고, 등록·수정·삭제는 관리자만 앱에서 할 수 있습니다.
  - 포스터는 자르지 않고 저장합니다(긴 변 2000px).
- **OPTION:** Profile · Language(한국어/English/日本語) · Account(로그아웃, **계정 삭제**) · About(약관, 개인정보)
- **로그인:** 이메일 + 6자리 코드(링크 없음), iPhone에서는 Apple 로그인
- **베타:** 초대한 이메일만 사용할 수 있습니다. 처음 들어오면 이름과 약관 동의를 받습니다.
- **글꼴:** 영문·숫자는 Figtree(300/700, 큰 숫자 800), 한글은 Noto Sans KR(300/700)
  - 앱 크기를 줄이려고 한글·영문만 남겨 넣었습니다.
  - 일본어는 휴대폰의 일본어 글꼴로 보입니다.

**v0.2 예정:** 친구, 좋아요·댓글, 동정 의견, 도감, 그리고 신고·차단. 다른 사람 글이 보이게 되면 Apple 심사에서 신고·차단 기능을 요구하므로, 공유 기능과 함께 넣습니다.
**v0.1에서는 모든 기록이 본인에게만 보입니다.**

## 폴더 구조
| 위치 | 내용 |
| --- | --- |
| `src/app/` | 화면(Expo Router). `(tabs)/` 안이 하단 탭 4개 |
| `src/components/` | 공통 화면 부품(상단 바, 탭 바, 목록 줄, 사진, 지역 선택 등) |
| `src/lib/` | 서버 연결, 로그인, 데이터, 사진 업로드, 오프라인 보관, 날짜·지역 계산 |
| `src/data/geo.ts` | 나라 250개(한/영/일 이름)와 지역·섬 목록 |
| `src/content/legal.ts` | 이용약관·개인정보 처리방침 **초안** |
| `supabase/schema.sql` | 새 Supabase 프로젝트에 한 번 실행할 SQL (v0.1.4까지 포함). 웹 회원 테이블은 웹 저장소의 `web01_shop_customers.sql` |
| `supabase/v0.1.4.sql` | 이전 버전을 쓰던 프로젝트에 실행할 업데이트 SQL (v0.1.1~v0.1.4 포함) |
| `supabase/v0.1.1.sql` ~ `v0.1.3.sql` | 이전 업데이트 SQL (v0.1.4.sql에 들어 있으므로 따로 실행할 필요 없음) |
| `supabase/functions/delete-account/` | 계정 삭제 서버 함수 |
| `assets/` | 아이콘, 시작 화면, 글꼴 |

---

## 1. Supabase 준비 (새 프로젝트)
1. 공식 이메일로 https://supabase.com 에 가입하고 **New project**를 만듭니다. Region은 **Northeast Asia (Seoul)**을 고르세요.
2. **SQL Editor**에 `supabase/schema.sql` 전체를 붙여 넣고 **Run**을 누릅니다. 여러 번 실행해도 안전합니다. (v0.1.4 변경까지 들어 있어서 업데이트 SQL은 따로 실행하지 않아도 됩니다.)
3. **테스터 초대** (이메일마다 한 줄, 소문자로):
   ```sql
   insert into public.beta_invites (email) values ('tester@example.com') on conflict do nothing;
   ```
4. **관리자 지정** (그 사람이 앱에서 가입한 다음):
   ```sql
   insert into public.app_admins (user_id) select id from auth.users where lower(email) = lower('OFFICIAL_EMAIL') on conflict do nothing;
   ```
5. **이메일 코드 설정:** Authentication → Emails → Templates에서 아래 두 템플릿을 고칩니다. 앱은 링크가 아니라 6자리 코드를 씁니다.
   - **Confirm signup**
     ```html
     <h2>PLANT MATTER 가입 확인</h2>
     <p>아래 코드를 앱에 입력해 주세요.</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
     <p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
     ```
   - **Reset Password**
     ```html
     <h2>PLANT MATTER 비밀번호 재설정</h2>
     <p>아래 코드를 앱에 입력하고 새 비밀번호를 정해 주세요.</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
     ```
6. **메일 발송 서버(SMTP):** Supabase 기본 메일은 **프로젝트 팀원 주소로만** 보내고, 시간당 발송 수도 아주 적습니다.
   - 테스터에게 코드가 가려면 Authentication → Emails → **SMTP Settings**에 메일 서비스를 연결하세요. 예: 공식 메일 계정의 SMTP, Resend 등
   - 연결 전 임시로 테스트하려면 Authentication → Sign In / Providers → Email에서 **Confirm email**을 끄면 가입할 때 코드 없이 바로 들어갑니다. 비밀번호 찾기는 SMTP가 있어야 합니다.
7. **비밀번호 최소 길이:** 같은 화면에서 Minimum password length를 **8**로 맞춰 주세요. 앱도 8자 이상을 요구합니다.
8. **계정 삭제 함수 배포:** Edge Functions → **Deploy a new function → Via editor**
   - 이름은 `delete-account`
   - `supabase/functions/delete-account/index.ts` 내용을 붙여 넣고 **Deploy**합니다. 비밀 키 같은 값은 넣을 필요 없습니다(Supabase가 함수에 자동으로 줍니다).
   - 함수 설정의 **"Verify JWT"는 끄세요.** 함수 코드가 로그인한 사용자를 직접 확인합니다.
   - 이 함수가 없으면 앱의 "계정 삭제"가 실패합니다. Apple·Google 모두 계정 삭제 기능이 필수입니다.
9. **앱에 넣을 값:** Project Settings → **API Keys**에서 두 가지를 복사합니다.
   - **Project URL**
   - **Publishable key** (`sb_publishable_…`)
   - 이 두 값은 원래 앱에 공개되는 값입니다. **secret / service_role 키는 절대 앱에 넣지 마세요.**

## 2. 내 컴퓨터에서 실행해 보기 (Windows도 가능)
1. https://nodejs.org 에서 **Node.js LTS**를 설치합니다.
2. 이 폴더에서 명령 프롬프트(또는 PowerShell)를 열고 실행합니다.
   ```bash
   npm install
   ```
3. `.env.example`을 복사해 `.env`를 만들고, 1-9의 두 값과 문의 이메일을 넣습니다.
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_xxxx
   EXPO_PUBLIC_CONTACT_EMAIL=공식 문의 이메일
   ```
4. 개발 서버를 켭니다.
   ```bash
   npx expo start
   ```
5. 휴대폰에 **Expo Go** 앱을 설치하고 화면의 QR을 찍으면 앱이 열립니다.
   - Expo Go에서는 Apple 로그인을 시험할 수 없습니다. 아래 3번의 테스트 빌드에서 확인하세요.

## 3. 테스트 앱 만들기 (EAS — 클라우드 빌드, Mac 필요 없음)
1. https://expo.dev 에 공식 이메일로 가입합니다.
2. 처음 한 번만 실행합니다. `app.json`에 프로젝트 ID가 들어갑니다.
   ```bash
   npx eas-cli@latest login
   ```
   ```bash
   npx eas-cli@latest init
   ```
3. expo.dev → 프로젝트 → **Environment variables**에서 `.env`의 세 값을 **preview, production** 환경에 추가합니다.
4. **Android 테스트용 APK** (링크로 바로 설치):
   ```bash
   npx eas-cli@latest build -p android --profile preview
   ```
5. **iPhone TestFlight** (Apple Developer 가입 후):
   ```bash
   npx eas-cli@latest build -p ios --profile production
   ```
   ```bash
   npx eas-cli@latest submit -p ios
   ```
6. **Apple 로그인 켜기:** Supabase → Authentication → Providers → **Apple**을 켜고, Client IDs에 `com.plantmatter.app`을 넣습니다.

## 4. 스토어 출시 전 체크리스트
- [ ] **약관·개인정보 처리방침 웹페이지:** `src/content/legal.ts` 초안을 검토해 회사 홈페이지나 노션에 올리고, 그 주소를 스토어에 등록합니다.
- [ ] **운영자 연락처:** `EXPO_PUBLIC_CONTACT_EMAIL`
- [ ] **정식 앱 아이콘 (1024×1024):** 지금은 PLANT MATTER 워드마크로 만든 임시 아이콘입니다.
- [ ] **심사용 데모 계정:** `beta_invites`에 넣고, 계정 정보를 심사 메모에 적습니다.
- [ ] **App Store 개인정보 라벨 / Google Play 데이터 보안:**
  - 수집: 이메일, 사진, 사용자 콘텐츠
  - **정확한 위치(선택):** 관찰 기록의 좌표. "현재 위치" 버튼을 누를 때만 읽고, 앱 기능에만 씀(광고·추적 없음, 계정과 연결됨)
  - 추적은 없음
- [ ] **Google Play 계정 삭제 안내 웹 주소:** 앱 안의 계정 삭제 방법과 문의 이메일을 적은 페이지
- [ ] **Google Play 개인 개발자 계정이라면:** 12명 이상이 14일 동안 비공개 테스트
- [ ] **v0.2(공유 기능)와 함께:** 신고·차단 기능

## 5. 확인 방법과 검증 범위
- 코드 검사:
  ```bash
  npm run typecheck
  ```
  ```bash
  npm run lint
  ```
- **v0.1.4 작업 중 확인한 것:**
  - 웹 테스트 빌드 화면 흐름 184개 항목 (연필 아이콘, 사진 칸: 가로 4:3 → 넘기는 중간 정확히 중간 높이 → 세로 9:16, 사진이 칸을 가득 채움, 과 저장·자동 채움, sp. 선택 시 종소명·명명자 잠금과 추가 식별명 포함)
  - 데이터베이스 규칙 93개 항목 (새 DB, v0.1에서 올린 DB, 지금 운영 상태와 같은 v0.1.3 + 웹 회원 SQL에서 올린 DB 모두), 웹 회원 SQL과의 호환 4개 항목
  - 영어·일본어 화면 검사, 오프라인 보관 8개, 계산 로직 26개 묶음, TypeScript·Lint 오류 없음, iOS·Android 번들 생성 확인
- **v0.1.3 작업 중 확인한 것:**
  - 웹 테스트 빌드로 화면 흐름 169개 항목 (분류 목록 선·개수 위치, 사진이 있는 굵은 식물 줄, 식물 상세 표·관수 리셋·∨ 펼치기, 구입처, 관찰 기록 새 항목 저장·Found Wild 순서·측정/채집 묶음, 잘못된 습도 거부 포함)
  - 로컬 PostgreSQL 16에서 데이터베이스 규칙 87개 항목 (새로 설치한 DB, v0.1에서 올린 DB, 지금 운영 중인 v0.1.2 상태에서 올린 DB 모두)
  - 영어·일본어 화면에 한국어가 남지 않았는지 검사(새 접이식 묶음 포함), 오프라인 보관 8개, 계산 로직 23개 묶음
  - TypeScript·Lint 오류 없음, iOS·Android 번들 생성 확인
- **v0.1.2 작업 중 확인한 것:** 화면 흐름 151개, 데이터베이스 76개, 계산 로직 19개 묶음
- **아직 확인하지 못한 것:**
  - 실제 iPhone/Android 기기에서의 v0.1.3 화면(시각 선택기 포함), 사진 끌기의 손 느낌, GPS "현재 위치"와 위치 권한 창
  - 카메라, 네이티브 날짜 선택기
  - 휴대폰에서의 오프라인 보관
  - Apple 로그인
  - 실제 Supabase에서 v0.1.3 SQL 실행, 실제 계정으로 계정 삭제
  - EAS 빌드, 스토어 심사

> 개발 참고: `EXPO_PUBLIC_TEST_HOOKS`는 자동 테스트용 웹 빌드에서만 씁니다. 실제 앱 빌드에는 설정하지 마세요.
