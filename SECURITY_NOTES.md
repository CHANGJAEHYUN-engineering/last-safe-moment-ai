# Security Notes — V4

- API key는 서버 환경변수에만 저장합니다.
- `/api/analyze`는 POST + JSON만 허용합니다.
- 파일은 3MB UI 제한과 서버 base64 크기 제한을 적용합니다.
- 허용 확장자/MIME allowlist를 서버에서 재검증합니다.
- data URL 형식을 서버에서 검증합니다.
- OpenAI upstream 요청은 28초 후 중단합니다.
- 문서 내부의 명령은 untrusted data로 취급하도록 system instruction을 분리합니다.
- 텍스트 evidence는 서버 substring 검사로 재확인합니다.
- 파일 evidence는 `model_extracted_user_review_required`로 표시해 사용자의 원문 확인을 요구합니다.
- AI Mode 실행 전 민감정보 처리 확인 UI를 둡니다.
- REVIEW 결과는 calendar export를 차단합니다.
- CONFIRMED라도 IANA timezone ID가 없으면 `.ics` 생성을 차단합니다.
