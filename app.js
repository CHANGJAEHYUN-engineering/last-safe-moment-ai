import {localParse,validateAndCompute,buildIcs,evidenceMatchesSource} from './core.js';

function $(s){return document.querySelector(s)}
function $$(s){return [...document.querySelectorAll(s)]}

const views={
  start:$('#startView'),lab:$('#labView'),analysis:$('#analysisView'),
  confirmed:$('#confirmedView'),calendar:$('#calendarView'),review:$('#reviewView')
};

let analysisTimer=null;
let currentResult=null;
let lastSourceText='';
let selectedFile=null;

const demoConfirmed={
  source:'일반 요금은 호텔 현지시간 기준 체크인일 이틀 전 18:00까지 예약 취소가 완료된 경우 무료로 취소할 수 있습니다. 프로모션 요금과 환불 불가 요금은 제외됩니다. 마감 이후에는 1박 요금이 부과됩니다. 예약 정보: 서울 소재 호텔 · 일반 요금 · 체크인 2026-09-25',
  source_kind:'text',semantic_mode:'INTERPRET',choice_right:'무료 취소',conditions:['일반 요금'],exceptions:['프로모션 요금','환불 불가 요금'],reference_event:'호텔 체크인',reference_date:'2026-09-25',reference_time:'',timezone:'호텔 현지시간',timezone_id:'Asia/Seoul',required_action:'예약 취소',completion_requirement:'취소 요청이 아닌 취소 완료',consequence:'1박 요금 부과',relative:{days_before:2,hours_before:null,clock_time:'18:00'},direct_deadline:'',conflicts:[],review_reasons:[],
  evidence:['호텔 현지시간 기준 체크인일 이틀 전 18:00까지 예약 취소가 완료된 경우 무료로 취소할 수 있습니다','프로모션 요금과 환불 불가 요금은 제외됩니다','마감 이후에는 1박 요금이 부과됩니다']
};

const demoReview={
  source:'일반 요금은 체크인일 이틀 전 18:00까지 취소 완료 시 무료입니다. 예약 정보: 일반 요금 · 체크인 2026-09-25',
  source_kind:'text',semantic_mode:'REVIEW',choice_right:'무료 취소',conditions:['일반 요금'],exceptions:[],reference_event:'호텔 체크인',reference_date:'2026-09-25',reference_time:'',timezone:'',timezone_id:'',required_action:'예약 취소',completion_requirement:'취소 완료',consequence:'',relative:{days_before:2,hours_before:null,clock_time:'18:00'},direct_deadline:'',conflicts:[],review_reasons:[],evidence:['일반 요금은 체크인일 이틀 전 18:00까지 취소 완료 시 무료입니다']
};

function showView(name){
  Object.entries(views).forEach(([k,el])=>el?.classList.toggle('active',k===name));
  window.scrollTo({top:0,behavior:'smooth'});
}
function fmtDateISO(iso){if(!iso)return'';const [y,m,d]=iso.split('-').map(Number);return `${m}월 ${d}일`}
function fmtShort(iso){if(!iso)return'';const [,m,d]=iso.split('-').map(Number);return `${m}/${d}`}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fileKind(file){if(!file)return'';if(file.type.startsWith('image/'))return'image';if(file.type==='application/pdf'||/\.pdf$/i.test(file.name))return'pdf';return'file'}
function getManualOverrides(){return {timezoneLabel:$('#manualTimezone')?.value||'',timezoneId:$('#manualTimezoneId')?.value||'',referenceTime:$('#referenceTime')?.value||''}}

function buildFields(result){
  let timeRule='명시 없음';
  if(result.direct_deadline)timeRule=`직접 명시 · ${result.direct_deadline}`;
  else if(result.relative?.days_before!=null)timeRule=`${result.relative.days_before}일 전 ${result.relative.clock_time||''}`.trim();
  else if(result.relative?.hours_before!=null)timeRule=`${result.relative.hours_before}시간 전`;
  return [
    ['선택권',result.choice_right||'확인 불가'],
    ['적용 조건',(result.conditions||[]).join(' · ')||'확인 불가'],
    ['예외',(result.exceptions||[]).join(' · ')||'없음/확인 불가'],
    ['기준 사건',result.reference_event||'확인 불가'],
    ['기준 일시',[fmtDateISO(result.reference_date),result.reference_time].filter(Boolean).join(' ')||'확인 불가'],
    ['시간대',[result.timezone,result.timezone_id].filter(Boolean).join(' · ')||'확인 불가 ⚠'],
    ['필요한 행동',result.required_action||'확인 불가'],
    ['완료 요건',result.completion_requirement||'확인 불가'],
    ['시간 규칙',timeRule]
  ];
}

function renderAnalysis(result,label='직접 입력 분석'){
  currentResult=result;
  lastSourceText=result.source||'';
  if(analysisTimer)clearInterval(analysisTimer);
  showView('analysis');

  $('#caseLabel').textContent=label;
  $('#modeChip').textContent=result.semantic_mode||result.mode||'CHECKING';
  $('#modeChip').classList.toggle('review-chip',(result.semantic_mode||result.mode)==='REVIEW');
  $('#documentTitle').textContent=result.source_kind==='file'?(result.file_name||'업로드 문서'):(label.includes('CASE')?'시연용 가상 예약 정책':'사용자 입력 문구');

  if(result.source_kind==='file'&&!result.source){
    $('#documentText').innerHTML=`<p class="file-placeholder"><strong>${escapeHtml(result.file_name||'업로드 문서')}</strong><br>파일 자체는 AI 서버에서 처리되며, 이 화면에는 모델이 반환한 근거 구간을 표시합니다.</p>`;
  } else {
    $('#documentText').innerHTML=`<p>${escapeHtml(result.source||'')}</p>`;
  }

  const fields=buildFields(result);
  $('#analysisFields').innerHTML='';
  $('#progressCount').textContent=`0 / ${fields.length}`;
  $('#analysisStatus').textContent='판단 항목을 확인하는 중입니다…';
  fields.forEach(([l,v])=>{
    const row=document.createElement('div');
    row.className='field';
    row.innerHTML=`<div class="label">${escapeHtml(l)}</div><div class="value">${escapeHtml(v)}</div>`;
    $('#analysisFields').appendChild(row);
  });

  const rows=$$('#analysisFields .field');
  let i=0;
  analysisTimer=setInterval(()=>{
    if(i<rows.length){
      rows[i].classList.add('visible');
      $('#progressCount').textContent=`${i+1} / ${fields.length}`;
      i++;
      return;
    }
    clearInterval(analysisTimer);
    const final=validateAndCompute(result,label.startsWith('CASE')?{}:getManualOverrides());
    currentResult=final;
    $('#modeChip').textContent=final.mode;
    $('#modeChip').classList.toggle('review-chip',final.mode==='REVIEW');
    $('#analysisStatus').textContent=final.status==='CONFIRMED'?'필수 정보와 근거를 확인했습니다. 최종 시각은 코드가 계산했습니다.':'확정에 필요한 정보가 부족하거나 충돌합니다. 날짜를 만들지 않습니다.';
    setTimeout(()=>final.status==='CONFIRMED'?showConfirmed(final):showReview(final),550);
  },135);
}

function showConfirmed(r){
  currentResult=r;
  const l=r.lsm;
  $('#resultTime').textContent=`${fmtDateISO(l.iso)} ${l.clock}`;
  $('#resultTimezone').textContent=[r.timezone,r.timezone_id].filter(Boolean).join(' · ')||'시간대 확인됨';
  $('#resultActionCopy').innerHTML=`${escapeHtml(r.choice_right||'선택권')}을 유지하려면 이 시각까지 <strong>${escapeHtml(r.completion_requirement||r.required_action||'필요 행동')}</strong>이 완료되어야 합니다.`;
  $('#resultReference').textContent=r.reference_date?`${fmtDateISO(r.reference_date)} ${r.reference_time||''} ${r.reference_event||''}`.replace(/\s+/g,' ').trim():(r.reference_event||'직접 명시된 마감');
  $('#resultCompletion').textContent=r.completion_requirement||r.required_action;
  $('#resultConsequence').textContent=r.consequence||'문서에서 별도 결과 미확인';
  $('#timelineLSM').textContent=`${fmtShort(l.iso)} ${l.clock}`;
  $('#timelineAction').textContent=r.completion_requirement||r.required_action;
  $('#timelineEventDate').textContent=r.reference_date?fmtShort(r.reference_date):'—';
  $('#timelineEventName').textContent=r.reference_event||'직접 명시된 마감';
  $('#evidenceList').innerHTML=(r.evidence||[]).length?(r.evidence||[]).map(x=>`<p>“${escapeHtml(x)}”</p>`).join(''):'<p>원문 근거 문장을 추가 확인하세요.</p>';
  if(r.ai_extraction){
    const label=r.evidence_verification==='server_substring_verified'?'텍스트 입력 근거는 서버에서 원문 포함 여부를 재확인했습니다.':'파일 입력 근거는 AI가 추출한 인용 후보이며 사용자가 원문에서 최종 확인해야 합니다.';
    $('#evidenceList').insertAdjacentHTML('beforeend',`<div class="provenance-note">${escapeHtml(label)}</div>`);
  }
  $('#evidenceDrawer').hidden=true;
  showView('confirmed');
}

function showReview(r){
  currentResult=r;
  const missing=r.missing||[];
  const conflicts=r.conflicts||[];
  const reasons=r.review_reasons||[];
  let reason='확정에 필요한 정보가 부족합니다.';
  if(missing.includes('적용 시간대'))reason='문서에서 적용 시간대를 확인할 수 없습니다.';
  else if(conflicts.length)reason=`서로 충돌하는 조건이 있습니다: ${conflicts.join(' · ')}`;
  else if(reasons.length)reason=reasons.join(' · ');
  $('#reviewReason').textContent=reason;

  const rule=r.direct_deadline?`직접 마감 ${r.direct_deadline}`:r.relative?.days_before!=null?`${r.relative.days_before}일 전 ${r.relative.clock_time||''}`:r.relative?.hours_before!=null?`${r.relative.hours_before}시간 전`:'';
  const known=[r.reference_event,fmtDateISO(r.reference_date),rule,r.completion_requirement].filter(Boolean).join(' · ');
  $('#reviewKnown').textContent=known||'일부 판단 항목';
  $('#reviewMissing').textContent=[...missing,...conflicts,...reasons].filter(Boolean).join(' · ')||'추가 확인 필요';
  $('#reviewNext').textContent=missing.includes('적용 시간대')?'발행처 기준 시간대가 무엇인지 확인하세요.':'누락·충돌 항목을 원문 발행처에서 확인하세요.';
  $('#reviewSourceText').textContent=r.source?`“${r.source}”`:(r.file_name?`업로드 파일: ${r.file_name}`:'업로드 문서');

  const hasRule=!!r.direct_deadline||(r.relative?.days_before!=null&&!!r.relative?.clock_time)||(r.relative?.hours_before!=null&&!!r.reference_time);
  const checks=[
    ['기준 사건',!!r.reference_event||!!r.direct_deadline],
    ['기준 일시',!!r.reference_date||!!r.direct_deadline],
    ['완료 요건',!!r.completion_requirement],
    ['시간 규칙',hasRule],
    ['시간대',!!r.timezone],
    ['원문 근거',(r.evidence||[]).length>0]
  ];
  $('#reviewChecklist').innerHTML=checks.map(([n,ok])=>`<div class="${ok?'':'missing'}"><span>${ok?'✓':'!'}</span>${escapeHtml(n)}: ${ok?'확인됨':'확인 필요'}</div>`).join('');
  $('#reviewFix').hidden=true;
  showView('review');
}

function toggleEvidence(){
  if(currentResult?.source_kind==='file'&&!lastSourceText){
    $('#documentText').innerHTML=`<p><strong>모델이 반환한 원문 근거 구간</strong></p>${(currentResult?.evidence||[]).map(e=>`<p><mark>${escapeHtml(e)}</mark></p>`).join('')||'<p>근거 구간 없음</p>'}`;
    return;
  }
  let html=escapeHtml(lastSourceText);
  (currentResult?.evidence||[]).forEach(e=>{
    const safe=escapeHtml(e);
    if(safe)html=html.replace(safe,`<mark>${safe}</mark>`);
  });
  $('#documentText').innerHTML=`<p>${html}</p>`;
}

function updateCalendar(r){
  const l=r.lsm;
  const [,lm,ld]=l.iso.split('-').map(Number);
  $('#calendarMonth').textContent=`${lm}월`;
  $('#calendarLSMDay').textContent=ld;
  $('#calendarLSMClock').textContent=l.clock;
  $('#calendarLSMTitle').textContent=`${r.choice_right||'선택권'} Last Safe Moment`;
  const eventDay=r.reference_date?Number(r.reference_date.split('-')[2]):'—';
  $('#calendarEventDay').textContent=eventDay;
  $('#calendarEventLabel').textContent=r.reference_event||'EVENT';
  $('#calendarDetailTitle').textContent=`${r.choice_right||'선택권'} Last Safe Moment`;
  $('#calendarDetailTime').textContent=`${fmtDateISO(l.iso)} ${l.clock}`;
  $('#calendarAction').textContent=r.completion_requirement||r.required_action;
  $('#calendarTimezone').textContent=[r.timezone,r.timezone_id].filter(Boolean).join(' · ')||'확인 필요';
  $('#calendarReference').textContent=r.reference_date?`${fmtDateISO(r.reference_date)} ${r.reference_event||''}`:'문서 직접 명시';
  $('#calendarConsequence').textContent=r.consequence||'문서에서 별도 결과 미확인';
  const canExport=!!r.timezone_id;
  $('#downloadIcs').disabled=!canExport;
  $('#downloadIcs').classList.toggle('disabled',!canExport);
  $('#calendarSaveNote').textContent=canExport?'동일 EVENT가 이미 있다고 가정해 중복 생성하지 않습니다. IANA 시간대가 확인되어 실제 .ics 저장이 가능합니다.':'판단은 CONFIRMED지만 캘린더 저장에는 IANA 시간대가 추가로 필요합니다.';
}

function downloadIcs(){
  try{
    const ics=buildIcs(currentResult);
    const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='last-safe-moment.ics';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch(e){alert(e.message)}
}

async function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

async function handleFileSelection(){
  const file=$('#policyFile').files?.[0]||null;
  selectedFile=file;
  if(!file){$('#fileStatus').textContent='선택된 파일 없음';return;}
  if(file.size>3*1024*1024){
    selectedFile=null;$('#policyFile').value='';
    $('#fileStatus').textContent='3MB를 초과해 선택이 해제되었습니다.';
    alert('공모전 프로토타입은 요청 안정성을 위해 파일을 3MB 이하로 제한합니다.');
    return;
  }
  $('#fileStatus').textContent=`${file.name} · ${(file.size/1024).toFixed(0)}KB`;
  if(file.type.startsWith('text/')||/\.(txt|md)$/i.test(file.name)){
    const txt=await file.text();
    $('#policyText').value=txt.slice(0,12000);
    $('#fileStatus').textContent+= ' · 텍스트를 입력창에도 불러옴';
  }
}

async function runAI(){
  const text=$('#policyText').value.trim();
  if(!text&&!selectedFile){alert('분석할 정책 문구를 입력하거나 파일을 선택해 주세요.');return;}
  if(!$('#privacyConfirm')?.checked){alert('AI Mode를 사용하기 전에 민감정보 처리 확인란을 체크해 주세요.');return;}
  const btn=$('#aiAnalyze');
  btn.disabled=true;btn.textContent='AI 분석 중…';
  try{
    let fileData='',fileName='',mimeType='';
    if(selectedFile){
      fileData=await fileToDataUrl(selectedFile);
      fileName=selectedFile.name;
      mimeType=selectedFile.type||'application/octet-stream';
    }
    const payload={
      text:text.slice(0,12000),
      referenceDate:$('#referenceDate').value,
      referenceTime:$('#referenceTime').value,
      referenceEvent:$('#referenceEvent').value,
      rateType:$('#rateType').value,
      manualTimezone:$('#manualTimezone').value,
      manualTimezoneId:$('#manualTimezoneId').value,
      fileData,fileName,mimeType
    };
    const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'AI 분석에 실패했습니다.');
    const parsed={
      ...data,
      source:data.source_kind==='file'?'':text,
      file_name:fileName||data.file_name||'',
      semantic_mode:data.semantic_mode||'INTERPRET'
    };
    renderAnalysis(parsed,`AI MODE · ${data.model||'STRUCTURED EXTRACTION'}`);
  }catch(e){
    alert(`${e.message}\n\nAPI가 연결되지 않은 경우 '로컬 안전검사'로 같은 안전 흐름을 체험할 수 있습니다.`);
  }finally{
    btn.disabled=false;btn.textContent='AI 구조화 분석';
  }
}

function runLocal(){
  const text=$('#policyText').value.trim();
  if(!text){alert('로컬 안전검사는 텍스트 입력이 필요합니다. PDF/이미지는 AI Mode에서 분석해 주세요.');return;}
  const parsed=localParse(text,{
    referenceDate:$('#referenceDate').value,
    referenceTime:$('#referenceTime').value,
    referenceEvent:$('#referenceEvent').value,
    rateType:$('#rateType').value,
    manualTimezone:$('#manualTimezone').value,
    manualTimezoneId:$('#manualTimezoneId').value
  });
  parsed.evidence=evidenceMatchesSource(text,parsed.evidence);
  renderAnalysis(parsed,'LOCAL SAFE PARSE · RULE-BASED');
}

$('#startConfirmed').addEventListener('click',()=>renderAnalysis(demoConfirmed,'CASE A · CONFIRMED SAMPLE'));
$('#startReview').addEventListener('click',()=>renderAnalysis(demoReview,'CASE B · REVIEW SAMPLE'));
$('#openLab').addEventListener('click',()=>showView('lab'));
$('#localAnalyze').addEventListener('click',runLocal);
$('#aiAnalyze').addEventListener('click',runAI);
$('#policyFile').addEventListener('change',handleFileSelection);
$('#evidenceButton').addEventListener('click',toggleEvidence);
$('#showEvidence').addEventListener('click',()=>$('#evidenceDrawer').hidden=!$('#evidenceDrawer').hidden);
$('#openCalendar').addEventListener('click',()=>{updateCalendar(currentResult);showView('calendar')});
$('#downloadIcs').addEventListener('click',downloadIcs);
$('#tryReview').addEventListener('click',()=>renderAnalysis(demoReview,'CASE B · REVIEW SAMPLE'));
$('#backToConfirmed').addEventListener('click',()=>renderAnalysis(demoConfirmed,'CASE A · CONFIRMED SAMPLE'));
$('#editReview').addEventListener('click',()=>$('#reviewFix').hidden=false);
$('#applyReviewFix').addEventListener('click',()=>{
  if(!currentResult)return;
  const [timezoneLabel,timezoneId]=$('#reviewTimezoneSelect').value.split('|');
  const fixed=validateAndCompute(currentResult,{timezoneLabel,timezoneId});
  fixed.evidence=currentResult.evidence||[];
  if(fixed.status==='CONFIRMED')showConfirmed(fixed);else showReview(fixed);
});
$$('[data-action="home"]').forEach(btn=>btn.addEventListener('click',()=>showView('start')));
$('#openAbout').addEventListener('click',()=>$('#aboutDialog').showModal());
