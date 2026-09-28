# 놓치기 전 — Last Safe Moment AI / Web MVP V4

공모전용 인터랙티브 프로토타입입니다. 핵심은 많은 기능이 아니라 다음 두 제품 행동을 재현하는 것입니다.

1. 충분한 근거 → `CONFIRMED` → Last Safe Moment → 사용자 확인 → 캘린더 연결
2. 결정적 정보 누락/충돌 → `REVIEW NEEDED` → 확인할 정보 제시 → 캘린더 저장 차단

## V4 핵심 개선

- 자유 텍스트 + 파일(PDF/DOCX/TXT/MD/JPG/PNG/WEBP) 입력용 AI endpoint
- OpenAI Responses API + Structured Outputs 기반 의미 구조화
- 문서 내부 prompt injection을 따르지 않도록 system-level untrusted-data 규칙 추가
- 텍스트 입력일 때 모델이 돌려준 evidence가 실제 원문에 존재하는지 서버에서 재확인
- 모델의 DIRECT/INTERPRET/REVIEW 제안을 최종 판정으로 신뢰하지 않고 브라우저의 deterministic safety engine이 다시 판정
- 상대 날짜/시간 계산과 직접 명시 마감 처리를 코드로 분리
- REVIEW 사유/충돌을 명시적으로 보존
- IANA timezone ID가 확인된 CONFIRMED 결과만 실제 `.ics`로 내보냄
- API 키는 서버 환경변수에만 존재

## 세 가지 실행 모드

### 1. Demo Mode
외부 API 없이 항상 재현되는 가상 사례 2종입니다.

- 완전한 호텔 정책 → `CONFIRMED`
- 시간대 누락 호텔 정책 → `REVIEW NEEDED`

### 2. Local Safe Parse
사용자가 붙여넣은 한국어 문구를 브라우저의 제한된 규칙으로 점검합니다. AI가 아닙니다. 제품의 안전 흐름과 deterministic temporal engine을 시험하기 위한 fallback입니다.

### 3. AI Mode
Vercel serverless endpoint `/api/analyze`가 OpenAI Responses API의 Structured Outputs로 의미 요소를 추출합니다.

- 텍스트 입력
- PDF/문서 파일 입력 (`input_file`)
- 이미지 입력 (`input_image`)

실제 API 키가 연결된 배포 환경에서만 동작합니다.

## 역할 분리

- **AI**: 조건·예외·기준 사건·행동·완료 요건·근거 후보 구조화
- **Code**: 날짜/시간 산술
- **Safety**: 필수 정보 누락, 근거 부족, 충돌 검사 및 REVIEW 결정

## 중요한 안전 규칙

- 문서 안의 명령은 모델 지시가 아니라 **untrusted data**로 취급
- 상대시간 최종 계산을 AI에 맡기지 않음
- 텍스트 evidence는 서버에서 원문 substring 재확인
- decisive information이 빠지면 CONFIRMED 금지
- `REVIEW NEEDED` 결과는 캘린더 저장 금지
- CONFIRMED라도 캘린더 export에는 IANA timezone ID가 필요
- 자동 취소/환불/신청 기능 없음

## 실행

정적 UI/Demo/Local Mode:

```bash
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080`을 엽니다.

AI Mode는 `/api/analyze` serverless function이 실행되는 Vercel 같은 환경에서 사용합니다.

## 환경변수

`.env.example`:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
```

API key는 절대로 `app.js`, HTML, GitHub repository에 넣지 않습니다.

## 현재 실제로 구현된 범위

- 재현 가능한 CONFIRMED / REVIEW demo
- 자유 텍스트 입력
- 3MB 이하 파일 입력 UI 및 AI endpoint 전달
- 로컬 규칙 기반 fallback
- DIRECT / INTERPRET / REVIEW 재판정
- deterministic date/time engine
- conflict / review reason 처리
- 원문 evidence 표시
- text evidence substring verification (server)
- REVIEW → 사용자 시간대 보완 → 재계산
- IANA timezone-aware `.ics` 생성
- server-only API key
- API input size guard
- 서버 파일 확장자/MIME allowlist 및 data URL 검증
- OpenAI upstream 요청 28초 timeout
- AI Mode 실행 전 민감정보 처리 확인
- 텍스트 근거와 파일 근거의 검증 수준(provenance) 구분
- deterministic safety unit checks

## 아직 운영형 고도화 범위

- 실제 정책 최신성 자동 확인
- Google/Apple Calendar OAuth
- 다양한 실문서에서의 추출 품질 평가
- 실제 사용자 파일럿
- Wrong Confirm / Coverage / Appropriate Abstention / Unnecessary Abstention 정량 평가

## 테스트

```bash
npm run check
```

현재 테스트는 실제 LLM 정확도를 주장하는 평가가 아니라 코드·안전 규칙·보안 구성의 재현성 검사입니다.

`data/eval_cases.json`에는 향후 실제 AI Mode를 검증할 진단 시나리오를 정의해 두었습니다.

## AI 사용 고지

프로토타입 설계와 코드 초안 작성에 OpenAI 생성형 AI를 활용했습니다. 실제 제출 전 동작, 문구, 계산, 안전 규칙 및 실제 AI Mode 결과는 참가자가 직접 검토해야 합니다.
