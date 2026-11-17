# PLANT MATTER 앱 — v0.1 (베타)

내가 키우는 식물과 야생에서 발견한 식물을 기록하고, 식물 행사·매장을 소개하는 **iPhone / Android 앱**입니다.
React Native + Expo로 만들고, 서버는 Supabase를 씁니다.

## v0.1에 들어 있는 것
- **하단 탭:** HOME · PLANT · MATTER · OPTION (글자만)
- **HOME:** 다가오는 행사 포스터를 화면 가득, 가까운 날짜부터 보여 줍니다.
  - 손으로 넘기고, 누르면 행사 상세로 갑니다.
  - 행사가 없으면 로고 화면이 나옵니다.
  - 인터넷이 없을 때는 마지막으로 받은 포스터를 보여 줍니다.
- **PLANT › My Plants**
  - 기본 분류 9개(계정마다 한 번 생성)와 하위 분류(2단계)
  - 분류마다 개수, 빈 분류는 연한 회색, 오른쪽 아래에 큰 All 숫자
  - 분류를 누르면 하위 목록이 열리고 `+ 식물 · + 하위 분류 · 이름 변경 · 삭제`를 할 수 있습니다.
  - **원산지:** 넓은 지역 10곳 → 나라 또는 섬(보르네오·수마트라·술라웨시·자바·뉴기니·소코트라·아마존·안데스). 지역까지만 골라도 됩니다.
  - **모본(♀) × 부본(♂):** 내 식물에서 고르거나 직접 입력합니다.
    - 둘 다 정하면 이름이 "A × B"로 자동으로 들어갑니다. 직접 고친 이름은 바뀌지 않습니다.
    - 부모 식물 상세 화면에 "이 식물의 자손" 목록이 나옵니다.
- **PLANT › Wild Finds:** 지역 → 나라 → 기록 순서의 목록입니다.
  - **나라까지만** 기록합니다. GPS·지도·장소 이름은 없습니다.
  - 사진은 휴대폰에서 다시 저장해 위치 정보(EXIF)를 지운 뒤 올립니다.
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
| `supabase/schema.sql` | 새 Supabase 프로젝트에 한 번 실행할 SQL |
| `supabase/functions/delete-account/` | 계정 삭제 서버 함수 |
| `assets/` | 아이콘, 시작 화면, 글꼴 |

---

## 1. Supabase 준비 (새 프로젝트)
1. 공식 이메일로 https://supabase.com 에 가입하고 **New project**를 만듭니다. Region은 **Northeast Asia (Seoul)**을 고르세요.
2. **SQL Editor**에 `supabase/schema.sql` 전체를 붙여 넣고 **Run**을 누릅니다. 여러 번 실행해도 안전합니다.
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
   - `supabase/functions/delete-account/index.ts` 내용을 붙여 넣고 **Deploy**합니다. "Verify JWT"는 켠 채로 두세요.
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
  - 위치·추적은 없음
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
- **v0.1 작업 중 확인한 것:**
  - 웹 테스트 빌드로 화면 흐름 102개 항목
    - 가입·코드 인증·약관 동의
    - 분류·하위 분류, 원산지, 모본×부본, 자손
    - 발견 기록(나라만), 행사·매장, 관리자 등록
    - 언어 3개, 계정 삭제
  - 로컬 PostgreSQL 16에서 데이터베이스 권한 규칙 56개 항목
  - 오프라인 보관 8개 항목, 계산 로직 7개 항목
  - TypeScript·Lint 오류 없음
  - iOS·Android 번들 생성 확인
- **아직 확인하지 못한 것:**
  - 실제 iPhone/Android 기기
  - 카메라, 네이티브 날짜 선택기
  - 휴대폰에서의 오프라인 보관
  - Apple 로그인
  - 실제 Supabase(이메일 코드, Edge Function)
  - EAS 빌드, 스토어 심사

> 개발 참고: `EXPO_PUBLIC_TEST_HOOKS`는 자동 테스트용 웹 빌드에서만 씁니다. 실제 앱 빌드에는 설정하지 마세요.
