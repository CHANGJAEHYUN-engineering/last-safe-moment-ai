export function normalizeText(s=''){
  return String(s).replace(/\s+/g,' ').trim();
}

export function parseClock(s){
  const m=String(s||'').match(/\b(\d{1,2}):(\d{2})\b/);
  if(!m)return null;
  const h=Number(m[1]), min=Number(m[2]);
  if(h>23||min>59)return null;
  return {h,min};
}

export function parseDirectDeadline(s){
  const m=String(s||'').match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if(!m || !parseClock(m[2]))return null;
  return {iso:m[1],clock:m[2]};
}

export function addMinutesLocal(dateIso,time,deltaMinutes){
  const p=parseClock(time);
  if(!dateIso||!p||!Number.isFinite(deltaMinutes))return null;
  const [y,m,d]=dateIso.split('-').map(Number);
  if(!y||!m||!d)return null;
  const dt=new Date(Date.UTC(y,m-1,d,p.h,p.min));
  dt.setUTCMinutes(dt.getUTCMinutes()+deltaMinutes);
  const mm=String(dt.getUTCMonth()+1).padStart(2,'0');
  const dd=String(dt.getUTCDate()).padStart(2,'0');
  const hh=String(dt.getUTCHours()).padStart(2,'0');
  const mi=String(dt.getUTCMinutes()).padStart(2,'0');
  return {iso:`${dt.getUTCFullYear()}-${mm}-${dd}`,clock:`${hh}:${mi}`};
}

export function computeRelativeDeadline({reference_date,reference_time='',relative={}}){
  const days=relative?.days_before;
  const hours=relative?.hours_before;
  const clock=relative?.clock_time;

  if(days!=null && clock){
    return addMinutesLocal(reference_date,clock,-Number(days)*24*60);
  }
  if(hours!=null && reference_time){
    return addMinutesLocal(reference_date,reference_time,-Number(hours)*60);
  }
  return null;
}

export function evidenceMatchesSource(source,evidence=[]){
  const norm=normalizeText(source);
  if(!norm)return [];
  return evidence.filter(q=>{
    const nq=normalizeText(q);
    return nq && norm.includes(nq);
  });
}

export function validateAndCompute(parsed,overrides={}){
  const out=structuredClone(parsed||{});
  if(overrides.timezoneLabel) out.timezone=overrides.timezoneLabel;
  if(overrides.timezoneId) out.timezone_id=overrides.timezoneId;
  if(overrides.referenceTime) out.reference_time=overrides.referenceTime;

  const missing=[];
  const conflicts=[...(out.conflicts||[])];
  const reviewReasons=[...(out.review_reasons||[])];

  const direct=parseDirectDeadline(out.direct_deadline);
  const relativeDeadline=direct?null:computeRelativeDeadline(out);
  const lsm=direct||relativeDeadline;

  if(!out.choice_right) missing.push('지키려는 선택권');
  if(!out.required_action) missing.push('필요한 행동');
  if(!out.completion_requirement) missing.push('완료 요건');
  if(!out.timezone) missing.push('적용 시간대');
  if(!(out.evidence||[]).length) missing.push('원문 근거');

  if(!direct){
    if(!out.reference_event) missing.push('기준 사건');
    if(!out.reference_date) missing.push('기준 사건 날짜');
    const hasRule=(out.relative?.days_before!=null&&!!out.relative?.clock_time)||(out.relative?.hours_before!=null&&!!out.reference_time);
    if(!hasRule) missing.push('계산 가능한 시간 규칙');
  }

  if(conflicts.length || reviewReasons.length || missing.length || !lsm){
    return {...out,mode:'REVIEW',status:'REVIEW',missing:[...new Set(missing)],lsm:null};
  }

  return {
    ...out,
    mode:direct?'DIRECT':'INTERPRET',
    status:'CONFIRMED',
    missing:[],
    lsm
  };
}

export function localParse(text,meta={}){
  const norm=normalizeText(text);
  const daysMap={하루:1,'1일':1,이틀:2,'2일':2,사흘:3,'3일':3,'4일':4,'5일':5,'7일':7};
  let days=null;
  for(const [k,v] of Object.entries(daysMap)){
    if(norm.includes(`${k} 전`)){days=v;break;}
  }
  if(days==null){const m=norm.match(/(\d+)\s*일\s*전/);if(m)days=Number(m[1]);}

  let hours=null;
  const hm=norm.match(/(\d+)\s*시간\s*전/);
  if(hm)hours=Number(hm[1]);

  let clock='';
  const timeM=norm.match(/(오전|오후)?\s*(\d{1,2})\s*(?:시|:)(?:\s*(\d{2})\s*분?)?/);
  if(timeM){
    let h=Number(timeM[2]), min=timeM[3]?Number(timeM[3]):0;
    if(timeM[1]==='오후'&&h<12)h+=12;
    if(timeM[1]==='오전'&&h===12)h=0;
    if(h<=23&&min<=59) clock=`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }

  const directKorean=norm.match(/(20\d{2})[년.\/-]\s*(\d{1,2})[월.\/-]\s*(\d{1,2})일?\s*(?:까지|,)?\s*(\d{1,2})(?::|시)\s*(\d{2})?/);
  let direct_deadline='';
  if(directKorean){
    const [,y,m,d,h,mi='00']=directKorean;
    direct_deadline=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')} ${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;
  }

  let timezone='';
  let timezone_id='';
  if(norm.includes('호텔 현지시간')) timezone='호텔 현지시간';
  if(norm.includes('한국시간')||norm.includes('한국 표준시')||norm.includes('KST')){timezone='한국 표준시(KST)';timezone_id='Asia/Seoul';}
  if(norm.includes('예약자 시간대')) timezone='예약자 시간대';
  if(meta.manualTimezone) timezone=meta.manualTimezone;
  if(meta.manualTimezoneId) timezone_id=meta.manualTimezoneId;

  const completion=norm.includes('취소 완료')?'취소 완료':norm.includes('반품 발송')?'반품 발송 완료':norm.includes('제출 완료')?'제출 완료':norm.includes('신청 완료')?'신청 완료':norm.includes('해지 완료')?'해지 완료':'';
  const action=norm.includes('취소')?'예약 취소':norm.includes('반품')?'반품':norm.includes('해지')?'구독 해지':norm.includes('신청')||norm.includes('제출')?'신청 제출':'';
  const choice=norm.includes('무료')&&norm.includes('취소')?'무료 취소':norm.includes('반품')?'반품 가능':norm.includes('해지')?'자동 갱신 전 해지':norm.includes('신청')||norm.includes('제출')?'신청 자격':'';
  const consequence=norm.includes('1박 요금')?'1박 요금 부과':norm.includes('수수료')?'수수료 발생':norm.includes('환불 불가')?'환불 불가':'';
  const ex=[];
  if(norm.includes('프로모션'))ex.push('프로모션 조건');
  if(norm.includes('환불 불가'))ex.push('환불 불가 조건');

  const evidence=[];
  norm.split(/[.!?]/).map(s=>s.trim()).filter(Boolean).forEach(s=>{
    if(/취소|반품|해지|신청|제출|시간|현지|전|까지/.test(s))evidence.push(s);
  });

  return {
    source:text,
    source_kind:'text',
    semantic_mode:'LOCAL',
    choice_right:choice,
    conditions:[meta.rateType].filter(Boolean),
    exceptions:ex,
    reference_event:meta.referenceEvent||'',
    reference_date:meta.referenceDate||'',
    reference_time:meta.referenceTime||'',
    timezone,
    timezone_id,
    required_action:action,
    completion_requirement:completion,
    consequence,
    relative:{days_before:days,hours_before:hours,clock_time:clock||null},
    direct_deadline,
    conflicts:[],
    review_reasons:[],
    evidence:evidence.slice(0,5)
  };
}

export function escapeIcsText(s=''){
  return String(s)
    .replace(/\\/g,'\\\\')
    .replace(/\r?\n/g,'\\n')
    .replace(/,/g,'\\,')
    .replace(/;/g,'\\;');
}

function nowUtcStamp(){
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function buildIcs(result){
  if(!result||result.status!=='CONFIRMED'||!result.lsm) throw new Error('CONFIRMED 결과만 캘린더로 저장할 수 있습니다.');
  if(!result.timezone_id) throw new Error('캘린더 저장에는 IANA 시간대가 필요합니다. 시간대를 확인해 주세요.');

  const date=result.lsm.iso.replaceAll('-','');
  const clock=result.lsm.clock.replace(':','')+'00';
  const summary=`${result.choice_right||'선택권'} Last Safe Moment`;
  const desc=[
    `${result.choice_right||'선택권'}을 유지하려면 ${result.completion_requirement||result.required_action} 필요.`,
    result.reference_date?`기준: ${result.reference_date} ${result.reference_event||''}`:'',
    `시간대: ${result.timezone||result.timezone_id}`,
    result.consequence?`마감 이후: ${result.consequence}`:'',
    '근거: 프로토타입에서 사용자가 확인한 원문 근거'
  ].filter(Boolean).join('\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Last Safe Moment AI//Prototype//KO',
    'CALSCALE:GREGORIAN',
    `X-WR-TIMEZONE:${escapeIcsText(result.timezone_id)}`,
    'BEGIN:VEVENT',
    `UID:lsm-${date}-${clock}-${Math.random().toString(36).slice(2,9)}@last-safe-moment.local`,
    `DTSTAMP:${nowUtcStamp()}`,
    `DTSTART;TZID=${result.timezone_id}:${date}T${clock}`,
    'DURATION:PT15M',
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(desc)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}
