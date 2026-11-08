import{PROFILES,DEMO_FORMULA,parseCSV,splitIngredients,evaluate,initialSnapshots,summarizeSnapshots}from"./engine.js";

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let savedProfile;try{savedProfile=JSON.parse(localStorage.getItem('fuzhi-personal'))}catch{}
if(savedProfile && typeof savedProfile.skinType==='string' && Array.isArray(savedProfile.conditions) && Array.isArray(savedProfile.blacklist)){PROFILES.personal={...savedProfile,name:'我的档案'}}
let ingredients=[],rules=[],profileKey=localStorage.getItem("fuzhi-profile")||"sensitive";
if(!PROFILES[profileKey])profileKey='sensitive';
let snapshots=loadSnapshots(profileKey);

async function boot(){
  try{const read=async url=>{const r=await fetch(url);if(!r.ok)throw new Error('资料加载失败');return r.text()};const [a,b]=await Promise.all([read('./data/ingredients.csv'),read('./data/combination_rules.csv')]);ingredients=parseCSV(a);rules=parseCSV(b)}catch(e){console.error(e);toast("资料载入失败，请刷新页面重试")}
  bind();showTab("profile");selectProfile(profileKey,false);updateInputCount();renderBaseline();
}

function bind(){
  $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>{showTab(b.dataset.go);$('#experience').scrollIntoView({behavior:'smooth'})}));
  $$('[data-profile]').forEach(b=>b.addEventListener('click',()=>selectProfile(b.dataset.profile,true)));
  $('#ingredients').addEventListener('input',()=>{updateInputCount();clearResult()});$('#loadDemo').addEventListener('click',()=>{$('#ingredients').value='';clearResult();$('#ingredients').focus();updateInputCount();toast('请粘贴你的产品完整成分表')});
  $('#reviewButton').addEventListener('click',runReview);$('#skinScore').addEventListener('input',e=>$('#scoreOutput').value=`${e.target.value} / 5`);
  $('#personalForm').addEventListener('submit',savePersonal);
  $('#checkinForm').addEventListener('submit',saveSnapshot);$('#resetSnapshots').addEventListener('click',()=>resetSnapshotData(true));$('#resetAll').addEventListener('click',resetAll);
  $$('[role="tab"]').forEach(tab=>tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const tabs=$$('[role="tab"]'),i=tabs.indexOf(tab),n=e.key==='ArrowRight'?(i+1)%tabs.length:(i-1+tabs.length)%tabs.length;tabs[n].click();tabs[n].focus()}));
}

function showTab(key){$$('[data-tab]').forEach(b=>{const active=b.dataset.tab===key;b.classList.toggle('active',active);b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1});$$('.tab-panel').forEach(p=>{const active=p.id===`panel-${key}`;p.classList.toggle('active',active);p.hidden=!active})}

function selectProfile(key,announce){profileKey=key;localStorage.setItem('fuzhi-profile',key);$$('[data-profile]').forEach(b=>b.classList.toggle('active',b.dataset.profile===key));const p=PROFILES[key];$('#resetSnapshots').textContent=key==='personal'?'清空我的肤况记录':'恢复示例记录';$('#usePersonal').hidden=!PROFILES.personal;$('#reviewProfileName').textContent=p.name;$('#chartDataSource').textContent=key==='personal'?'我的真实记录（不含示例）':'示例档案 · 演示记录';if(key==='personal'){$('#personalSkin').value=p.skinType;$('#personalStage').value=p.conditions[0]||'日常稳定期';$('#personalAllergy').value=p.blacklist.map(x=>nameCN(x)||x).join('，');$('#profileSaveState').textContent='我的档案已保存，可随时修改。'}$('#profileFacts').innerHTML=`<div class="fact"><span>基础肤质</span><strong>${escapeHTML(p.skinType)}</strong></div><div class="fact"><span>当前阶段</span><strong>${p.conditions.find(x=>x==='医美术后恢复期')||'日常稳定期'}</strong></div><div class="fact"><span>已知过敏成分</span><strong class="${p.blacklist.length?'danger-text':''}">${p.blacklist.length?escapeHTML(p.blacklist.map(x=>nameCN(x)||x).join(' · ')):'无'}</strong></div>`;snapshots=loadSnapshots(key);renderBaseline();if($('#resultWrap .result-hero'))runReview();if(announce)toast(`已切换为“${p.name}”档案`)}

function savePersonal(e){
 e.preventDefault();const blacklist=splitIngredients($('#personalAllergy').value).map(t=>{const key=t.toLowerCase();return ingredients.find(x=>[x.inci_name,x.cn_name,...(x.aliases||'').split(';')].some(n=>n.toLowerCase()===key))?.inci_name||t});
 PROFILES.personal={name:'我的档案',skinType:$('#personalSkin').value,conditions:$('#personalStage').value==='日常稳定期'?[]:[$('#personalStage').value],blacklist,concern:'待观察'};
 localStorage.setItem('fuzhi-personal',JSON.stringify(PROFILES.personal));selectProfile('personal',false);showTab('review');toast('我的档案已保存，请输入产品成分');$('#experience').scrollIntoView({behavior:'smooth'});
}
function nameCN(inci){return ingredients.find(x=>x.inci_name===inci)?.cn_name}

function updateInputCount(){if(!ingredients.length){$('#inputCount').textContent=`输入 ${splitIngredients($('#ingredients').value).length} 项`;return}const index=new Set(ingredients.flatMap(x=>[x.inci_name,x.cn_name,...(x.aliases||'').split(';')]).filter(Boolean).map(x=>x.toLowerCase()));const tokens=splitIngredients($('#ingredients').value),count=tokens.filter(t=>index.has(t.toLowerCase())).length;$('#inputCount').textContent=`已识别 ${count} / ${tokens.length} 项`}

function clearResult(){$('#resultWrap').innerHTML='<div class="empty-result"><div class="empty-orb">AI</div><h3>你的专属结论会显示在这里</h3><p>输入产品成分后，我们会结合当前档案逐项核对。</p></div>'}
function runReview(){if(!ingredients.length){toast('证据库仍在载入，请稍候');return}const input=$('#ingredients').value.trim();if(!input){toast('请先粘贴产品成分表');return}const out=evaluate({input,profile:PROFILES[profileKey],ingredients,rules});if(!out.matched.length){clearResult();toast('当前资料库未识别这些成分，暂时无法给出建议');return}const meta={block:{label:'暂缓使用',sub:'发现你已记录的过敏成分',symbol:'!',copy:'本次建议先不要尝试这款产品。'},caution:{label:'谨慎评估',sub:'当前阶段或成分搭配需要留意',symbol:'△',copy:'建议降低频率、错开使用或待肤况稳定后再试。'},observe:{label:'可观察使用',sub:'在当前资料范围内，未发现已知过敏成分',symbol:'✓',copy:'先局部试用，并持续记录真实耐受。'}}[out.level];const decisions=out.findings.map((f,i)=>`<article class="decision-card"><span class="decision-no">${String(i+1).padStart(2,'0')}</span><div><h4>${escapeHTML(f.title.replace('命中你的个人黑名单：','发现已记录的过敏成分：'))}</h4><p>${escapeHTML(f.body)}</p><div class="decision-tags">${f.tags.map(t=>`<span>${escapeHTML(t)}</span>`).join('')}</div></div>${f.url?`<a href="${safeURL(f.url)}" target="_blank" rel="noopener">查看出处 ↗</a>`:''}</article>`).join('');const unknown=out.unknown.length?`另有 ${out.unknown.length} 项未被当前体验库识别，不代表安全或不安全。`:'';$('#resultWrap').innerHTML=`<div class="result-hero ${out.level}"><div class="result-symbol">${meta.symbol}</div><div><small>${meta.sub}</small><h3>${meta.label}</h3><p>${meta.copy}</p></div><div class="result-score"><strong>${out.matched.length}</strong><span>项成分已核对</span></div></div><div class="decision-list">${decisions}</div><div class="result-foot"><span>ⓘ</span>已核对 ${out.matched.length} 项原料；${unknown||'可展开各项资料，了解建议依据。'} 结论不替代医生诊断或成品完整安全评估。</div>`;$('#resultWrap').scrollIntoView({behavior:'smooth',block:'start'})}

function loadSnapshots(key){try{const saved=JSON.parse(localStorage.getItem(`fuzhi-snapshots-${key}`));if(Array.isArray(saved)&&saved.length)return saved}catch{}return key==='personal'?[]:initialSnapshots(key)}

function saveSnapshot(e){e.preventDefault();const score=Number($('#skinScore').value),issues=$$('input[name="issue"]:checked').map(x=>x.value);snapshots.push({id:`custom-${Date.now()}`,day:snapshots.length*2+1,score,issues:issues.length?issues:['无异常'],note:$('#snapshotNote').value.trim(),custom:true});localStorage.setItem(`fuzhi-snapshots-${profileKey}`,JSON.stringify(snapshots));renderBaseline();toast('今日肤况已记录，趋势已更新');$('#snapshotNote').value=''}

function resetSnapshotData(announce){if(profileKey==='personal'&&!window.confirm('清空我的肤况记录？此操作不会修改你的档案。'))return;localStorage.removeItem(`fuzhi-snapshots-${profileKey}`);snapshots=profileKey==='personal'?[]:initialSnapshots(profileKey);renderBaseline();if(announce)toast(profileKey==='personal'?'我的肤况记录已清空':'已恢复示例记录')}

function resetAll(){if(!window.confirm('重置会清除本浏览器中保存的档案和肤况记录，是否继续？'))return;['sensitive','oily','personal'].forEach(k=>localStorage.removeItem(`fuzhi-snapshots-${k}`));localStorage.removeItem('fuzhi-personal');delete PROFILES.personal;$('#personalForm').reset();$('#profileSaveState').textContent='也可以先选择上方示例档案，了解使用方式。';localStorage.removeItem('fuzhi-profile');profileKey='sensitive';$('#ingredients').value='';selectProfile('sensitive',false);updateInputCount();$('#resultWrap').innerHTML='<div class="empty-result"><div class="empty-orb">AI</div><h3>你的专属结论会显示在这里</h3><p>系统会核对已知过敏成分、当前肤况及成分搭配。</p></div>';showTab('profile');toast('体验已重置')}

function renderBaseline(){if(!$('#skinChart'))return;const p=PROFILES[profileKey];if(!snapshots.length){$('#skinTypeMetric').textContent=p.skinType;$('#latestScoreMetric').textContent='—';$('#concernMetric').textContent='待记录';$('#recordCountMetric').textContent='0';$('#baselineStatus').textContent='等待首次记录';$('#baselineStatus').className='status-chip stable';$('#chartSummary').textContent='保存今日肤况后，趋势将从这里开始';$('#skinChart').innerHTML='<p class="chart-empty">每一次记录，都是更了解自己的开始。</p>';$('#baselineNote').textContent='还没有个人肤况记录，先记录今天的感受吧。';return}const s=summarizeSnapshots(snapshots,p);$('#skinTypeMetric').textContent=p.skinType;$('#latestScoreMetric').textContent=s.latest;$('#concernMetric').textContent=s.concern;$('#recordCountMetric').textContent=s.count;const chip=$('#baselineStatus');chip.textContent=s.unstable?'状态波动中':'状态平稳';chip.className=`status-chip ${s.unstable?'alert':'stable'}`;$('#chartSummary').textContent=s.unstable?'近期肤况需多留意':'整体平稳，偶有波动';const note=$('#baselineNote');note.textContent=s.note;note.className=`baseline-note ${s.unstable?'alert':''}`;renderChart(snapshots)}

function renderChart(data){const w=640,h=170,pad={l:25,r:16,t:14,b:22},min=1,max=5;const x=i=>pad.l+i*(w-pad.l-pad.r)/Math.max(1,data.length-1),y=v=>pad.t+(max-v)*(h-pad.t-pad.b)/(max-min);const points=data.map((d,i)=>`${x(i)},${y(d.score)}`).join(' '),area=`${pad.l},${h-pad.b} ${points} ${x(data.length-1)},${h-pad.b}`;const grids=[1,2,3,4,5].map(v=>`<line class="grid-line" x1="${pad.l}" x2="${w-pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-label" x="2" y="${y(v)+3}">${v}</text>`).join('');const dots=data.map((d,i)=>`<circle class="chart-dot ${i===data.length-1&&d.custom?'latest':''}" cx="${x(i)}" cy="${y(d.score)}" r="${i===data.length-1?5:3}"/>`).join('');$('#skinChart').setAttribute('aria-label',`肤况舒适度趋势，共${data.length}次记录，最近${data.at(-1).score}分，满分5分`);$('#skinChart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#68c19c" stop-opacity=".32"/><stop offset="1" stop-color="#68c19c" stop-opacity="0"/></linearGradient></defs>${grids}<polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${points}"/>${dots}<text class="axis-label" x="${pad.l}" y="${h-2}">起始</text><text class="axis-label" x="${w-pad.r-24}" y="${h-2}">今天</text></svg>`}

function escapeHTML(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function safeURL(v=''){try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}}
let toastTimer;function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}

boot();
