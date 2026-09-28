# Deployment Guide — V4

## 권장 구조

GitHub repository → Vercel import → Environment Variables 설정 → Deploy

권장 repository 이름: `last-safe-moment-ai`

## 1. GitHub

새 빈 repository를 만든 뒤 이 폴더의 내용을 repository root에 올립니다.

중요:
- `.env` 업로드 금지
- `.env.example`만 commit
- API key를 README/issue/commit message에 넣지 않기

## 2. Vercel

GitHub repository를 Import합니다. 정적 파일과 `/api/analyze.js` serverless function을 함께 배포합니다.

Environment Variables:

```text
OPENAI_API_KEY=<secret>
OPENAI_MODEL=gpt-5.6-terra
```

Production/Preview 환경 범위를 확인한 뒤 저장합니다.

## 3. 배포 후 Smoke Test

1. 홈 화면 로드
2. 샘플 예약서 → 2026-09-23 18:00 CONFIRMED
3. `.ics` 버튼 활성화 및 다운로드
4. 불완전 문서 → REVIEW NEEDED
5. REVIEW에서 캘린더 저장 불가
6. 직접 텍스트 입력 → AI 구조화 분석
7. 작은 PDF 또는 이미지 업로드 → AI 분석
8. API key가 브라우저 DevTools/JS source에 나타나지 않는지 확인

## 4. AI Mode 진단

최종 제출 전 최소 다음 유형을 직접 점검합니다.

- 명확한 직접 마감
- 상대시간 + 명확한 시간대
- 시간대 누락
- 완료요건 누락
- 충돌 조항
- PDF
- 이미지 캡처

결과를 성능 수치로 주장하려면 별도의 사람 검증 라벨과 충분한 샘플이 필요합니다. 단순 시연 성공을 정확도라고 표현하지 않습니다.

## 5. 문제 발생 시

API Mode가 실패해도 Demo Mode는 외부 API 없이 동작하도록 유지합니다. 공모전 녹화는 재현 가능한 Demo Mode를 기본 시나리오로 사용하고, 실제 AI Mode는 추가 증거로 보여주는 것이 안전합니다.


## 6. 공개 데모 운영 주의

- Demo/Local Mode는 API 비용 없이 항상 동작합니다.
- AI Mode는 공개 URL에 API 비용을 발생시킬 수 있으므로 제출 기간에는 Vercel 사용량/로그를 확인합니다.
- API key는 환경변수에만 저장하고 클라이언트 코드/README/커밋에 넣지 않습니다.
- 실제 예약서 업로드 전 이름·연락처·예약번호·결제정보 등 불필요한 개인정보 제거를 권장합니다.
