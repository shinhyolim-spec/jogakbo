import { newSeed, pickNextQuestion, buildResult, tallyTags, TAG_ORDER } from './core.js?v=2';
import { quiltSVG } from './quilt.js?v=2';
import { renderShareImage, fmtDate } from './share.js?v=2';

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const KEY = 'jogakbo.v1';
let bank;
let msgs;
let db;
let flash = null; // 방금 붙인 조각 (홈 화면 애니메이션용)

// ---------- 저장 (이 기기 브라우저에만) ----------
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === 'object') return { current: null, wardrobe: [], hung: [], ...v };
  } catch { /* 비어 있거나 읽을 수 없음 */ }
  return { current: null, wardrobe: [], hung: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast('이 브라우저에서는 저장이 안 돼요. (사생활 보호 모드인지 확인해 주세요)'); }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const qById = (id) => bank.questions.find((q) => q.id === id);
const rec = (id) => db.wardrobe.find((r) => r.id === id);

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}

function ensureCurrent() {
  if (!db.current) {
    db.current = { id: uid(), seed: newSeed(), bankId: bank.bankId, startedAt: Date.now(), answers: [] };
    save();
  }
  return db.current;
}

// ---------- 화면: 조각보 (홈) ----------
function viewHome() {
  const cur = ensureCurrent();
  const n = bank.questions.length;
  const k = cur.answers.length;
  const just = flash;
  flash = null;
  const left = n - k;
  view.innerHTML = `
    <header class="head">
      <p class="eyebrow">일상의 조각보</p>
      <h1>${k === 0 ? '오늘, 첫 조각을 놓아 볼까요' : `${n}조각 중 <b>${k}</b>조각을 채웠어요`}</h1>
    </header>
    <figure class="frame ${k === 0 ? 'is-empty' : ''}">
      ${quiltSVG(cur, bank, { newIndex: just ? k - 1 : undefined })}
    </figure>
    ${just ? `<p class="just">‘${esc(just)}’ 조각을 살포시 붙였어요</p>` : '<p class="just">&nbsp;</p>'}
    <div class="progress" aria-hidden="true"><i style="width:${(k / n) * 100}%"></i></div>
    <button class="btn primary" id="go">${k === 0 ? '오늘의 조각 하나 채우기' : just ? '한 조각 더 채우기' : '오늘의 조각 하나 채우기'}</button>
    <p class="hint">${k === 0
    ? '질문 하나에 답하면 조각 하나가 생겨요.<br>기한은 없어요. 하루 한두 조각도, 한 번에 다 채워도 좋아요.'
    : `남은 조각 ${left}개. 언제 들어와도 이어서 채울 수 있어요.`}</p>
  `;
  $('#go').onclick = () => { location.hash = '#q'; };
}

// ---------- 화면: 질문 ----------
let pendingQ = null;
function viewQuestion() {
  const cur = ensureCurrent();
  const answered = cur.answers.map((a) => a.qid);
  // 같은 질문을 새로고침해도 바뀌지 않게, 화면에 띄운 질문을 기억
  if (!pendingQ || answered.includes(pendingQ.id) || pendingQ.cur !== cur.id) {
    const q = pickNextQuestion(bank, answered);
    if (!q) { location.hash = '#home'; return; }
    pendingQ = { id: q.id, cur: cur.id };
  }
  const q = qById(pendingQ.id);
  const no = cur.answers.length + 1;
  view.innerHTML = `
    <header class="head q-head">
      <a href="#home" class="back" aria-label="조각보로 돌아가기">‹ 조각보</a>
      <p class="eyebrow">${esc(q.category)} · ${no}번째 조각</p>
      <h1 class="question">${esc(q.text)}</h1>
    </header>
    <div class="options" role="list">
      ${q.options.map((o, i) => `<button class="opt" role="listitem" data-i="${i}"><span class="opt-mark" aria-hidden="true">${'一二三四'[i]}</span>${esc(o.text)}</button>`).join('')}
    </div>
    <details class="memo">
      <summary>한 줄 메모 덧붙이기 <small>(선택)</small></summary>
      <input id="memo" type="text" maxlength="60" placeholder="떠오른 생각을 짧게 적어 두세요" autocomplete="off">
      <p class="hint small">메모를 적고 나서 답을 고르면 함께 저장돼요.</p>
    </details>
  `;
  view.querySelectorAll('.opt').forEach((b) => {
    b.onclick = () => answer(q, Number(b.dataset.i));
  });
}

function answer(q, i) {
  const cur = ensureCurrent();
  if (cur.answers.some((a) => a.qid === q.id)) return;
  const memo = ($('#memo')?.value || '').trim().slice(0, 60);
  cur.answers.push({ qid: q.id, optionIndex: i, tag: q.options[i].tag, memo, at: Date.now() });
  pendingQ = null;
  if (cur.answers.length >= bank.questions.length) {
    const r = {
      ...cur,
      completedAt: Date.now(),
      result: buildResult(bank, msgs, cur.answers, cur.seed),
    };
    db.wardrobe.unshift(r);
    db.current = null;
    save();
    location.hash = `#quilt/${r.id}/new`;
    return;
  }
  save();
  flash = q.options[i].text;
  location.hash = '#home';
}

// ---------- 화면: 완성된 조각보 + 나에 대한 이야기 ----------
function viewQuilt(id, isNew) {
  const r = rec(id);
  if (!r) { location.hash = '#wardrobe'; return; }
  const R = r.result;
  const hung = db.hung.includes(r.id);
  const others = db.wardrobe.filter((x) => x.id !== r.id);
  const memos = r.answers.filter((a) => a.memo);
  view.innerHTML = `
    <header class="head">
      ${isNew ? '<p class="eyebrow">마지막 조각까지, 모두 모였어요</p>' : `<a href="#wardrobe" class="back">‹ 옷장</a><p class="eyebrow">${fmtDate(r.completedAt)}에 완성</p>`}
      <h1>${isNew ? '조각보가 완성되었어요' : '나의 조각보'}</h1>
    </header>
    <figure class="frame complete ${isNew ? 'just-done' : ''}">${quiltSVG(r, bank, { complete: true })}</figure>
    <article class="story ${isNew ? 'reveal' : ''}">
      <p class="story-lead">나를 표현하는 한 문장</p>
      <p class="story-sentence">${esc(R.sentence)}</p>
      <div class="story-tags">${R.tags.map((t) => `<span class="chip" style="--c:${bank.tags[t].color}">${esc(t)}</span>`).join('')}</div>
      <section><h2>요즘 내가 소중히 여기는 것</h2><p>${esc(R.values)}</p></section>
      <section><h2>나에게 필요한 것</h2><p>${esc(R.need)}</p></section>
      <section class="word"><h2>나에게 건네는 한마디</h2><p>“${esc(R.word)}”</p></section>
      ${memos.length ? `<details class="memos"><summary>그때 남긴 메모 ${memos.length}개</summary><ul>${memos.map((a) => `<li><b>${esc(qById(a.qid)?.text || '')}</b><span>${esc(a.memo)}</span></li>`).join('')}</ul></details>` : ''}
    </article>
    <div class="actions">
      <button class="btn primary" id="share">이미지로 저장 · 보내기</button>
      <button class="btn" id="hang">${hung ? '전시장에서 내리기' : '전시장 벽에 걸기'}</button>
      ${others.length ? '<button class="btn" id="cmp">예전 조각보와 나란히 보기</button>' : ''}
      ${isNew ? '<a class="btn ghost" href="#home">새 조각보 시작하기</a>' : '<button class="btn ghost danger" id="del">옷장에서 꺼내 정리하기</button>'}
    </div>
  `;
  $('#share').onclick = () => share(r);
  $('#hang').onclick = () => {
    db.hung = hung ? db.hung.filter((x) => x !== r.id) : [r.id, ...db.hung];
    save();
    toast(hung ? '전시장에서 내렸어요' : '전시장 벽에 걸었어요');
    viewQuilt(id, false);
  };
  if (others.length) $('#cmp').onclick = () => pickCompare(r);
  const del = $('#del');
  if (del) {
    del.onclick = () => {
      if (!confirm('이 조각보를 지울까요? 지우면 되돌릴 수 없어요.')) return;
      db.wardrobe = db.wardrobe.filter((x) => x.id !== r.id);
      db.hung = db.hung.filter((x) => x !== r.id);
      save();
      location.hash = '#wardrobe';
    };
  }
}

// ---------- 공유 ----------
async function share(r) {
  toast('이미지를 만들고 있어요…');
  let blob;
  try { blob = await renderShareImage(r, bank, msgs); } catch { toast('이미지를 만들지 못했어요'); return; }
  const file = new File([blob], `조각보-${fmtDate(r.completedAt).replace(/[. ]+/g, '')}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '일상의 조각보', text: r.result.sentence });
      return;
    } catch (e) { if (e?.name === 'AbortError') return; }
  }
  // 공유 기능이 없으면: 미리보기 + 다운로드 (아이폰은 길게 눌러 저장)
  const url = URL.createObjectURL(blob);
  openSheet(`
    <h2>조각보 이미지</h2>
    <img src="${url}" alt="완성한 조각보와 결과 문장" class="share-img">
    <p class="hint small">이미지를 길게 눌러 저장하거나, 아래 버튼을 눌러 내려받으세요.</p>
    <a class="btn primary" href="${url}" download="${file.name}">이미지 내려받기</a>
    <button class="btn ghost" data-close>닫기</button>
  `, () => URL.revokeObjectURL(url));
}

function openSheet(html, onClose) {
  const d = $('#sheet');
  d.innerHTML = `<div class="sheet-body">${html}</div>`;
  d.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => d.close(); });
  d.onclick = (e) => { if (e.target === d) d.close(); };
  d.onclose = () => onClose && onClose();
  d.showModal();
}

function pickCompare(r) {
  const others = db.wardrobe.filter((x) => x.id !== r.id);
  if (others.length === 1) { location.hash = `#compare/${others[0].id}/${r.id}`; return; }
  openSheet(`
    <h2>어느 조각보와 나란히 볼까요?</h2>
    <div class="pick">${others.map((o) => `<button class="pick-item" data-id="${o.id}">
      <span class="pick-thumb">${quiltSVG(o, bank, { complete: true })}</span>
      <span><b>${fmtDate(o.completedAt)}</b><small>${esc(o.result.sentence)}</small></span></button>`).join('')}</div>
    <button class="btn ghost" data-close>닫기</button>
  `);
  $('#sheet').querySelectorAll('.pick-item').forEach((b) => {
    b.onclick = () => { $('#sheet').close(); location.hash = `#compare/${b.dataset.id}/${r.id}`; };
  });
}

// ---------- 화면: 옷장 ----------
function viewWardrobe() {
  const list = db.wardrobe;
  const cur = db.current && db.current.answers.length ? db.current : null;
  view.innerHTML = `
    <header class="head">
      <p class="eyebrow">나만의 일상 옷장</p>
      <h1>${list.length ? `개어 둔 조각보 ${list.length}장` : '아직 옷장이 비어 있어요'}</h1>
    </header>
    <div class="closet">
      <div class="door left" aria-hidden="true"></div><div class="door right" aria-hidden="true"></div>
      <div class="closet-inner">
        ${list.length ? '' : '<p class="closet-empty">조각보를 완성하면 이곳에 차곡차곡 개어 둘게요.</p>'}
        ${list.map((r, i) => `<a class="folded" href="#quilt/${r.id}" style="--i:${i}">
            <span class="fold-cloth">${quiltSVG(r, bank, { complete: true })}</span>
            <span class="fold-label"><b>${fmtDate(r.completedAt)}</b>${db.hung.includes(r.id) ? ' · 전시 중' : ''}<small>${esc(r.result.sentence)}</small></span>
          </a>`).join('')}
      </div>
    </div>
    ${cur ? `<p class="hint">만드는 중인 조각보: ${cur.answers.length}/${bank.questions.length}조각 · <a href="#home">이어서 채우기</a></p>` : ''}
    ${list.length >= 2 ? '<button class="btn" id="cmp2">두 조각보 나란히 보기</button>' : ''}
    <p class="hint small">조각보는 몇 번이든 새로 만들 수 있어요. 몇 달 뒤 다시 만들어 예전 조각보와 나란히 놓아 보세요.</p>
  `;
  const b = $('#cmp2');
  if (b) b.onclick = () => pickCompare(list[0]);
}

// ---------- 화면: 비교 ----------
function viewCompare(a, b) {
  let A = rec(a);
  let B = rec(b);
  if (!A || !B) { location.hash = '#wardrobe'; return; }
  if (A.completedAt > B.completedAt) [A, B] = [B, A];
  const ta = Object.fromEntries(tallyTags(bank, A.answers).map((s) => [s.tag, s]));
  const tb = Object.fromEntries(tallyTags(bank, B.answers).map((s) => [s.tag, s]));
  const mapA = Object.fromEntries(A.answers.map((x) => [x.qid, x]));
  const changed = B.answers
    .filter((x) => mapA[x.qid] && mapA[x.qid].optionIndex !== x.optionIndex)
    .map((x) => ({ q: qById(x.qid), before: mapA[x.qid], after: x }))
    .filter((c) => c.q);
  const pct = (s) => Math.round((s.offered ? s.count / s.offered : 0) * 100);
  view.innerHTML = `
    <header class="head">
      <a href="#quilt/${B.id}" class="back">‹ 조각보</a>
      <p class="eyebrow">나란히 보기</p>
      <h1>나, 이렇게 변했구나</h1>
    </header>
    <div class="pair">
      ${[A, B].map((r, i) => `<a class="pair-item" href="#quilt/${r.id}">
        <span class="pair-when">${i ? '지금' : '그때'} · ${fmtDate(r.completedAt)}</span>
        ${quiltSVG(r, bank, { complete: true })}
        <span class="pair-sentence">${esc(r.result.sentence)}</span></a>`).join('')}
    </div>
    <section class="bars">
      <h2>조각 색의 변화 <small>(고를 수 있었던 때 중 고른 비율)</small></h2>
      ${TAG_ORDER.map((t) => `<div class="bar-row">
        <span class="bar-name"><i style="background:${bank.tags[t].color}"></i>${esc(t)}</span>
        <span class="bar"><i class="then" style="width:${pct(ta[t])}%;background:${bank.tags[t].color}"></i></span>
        <span class="bar"><i style="width:${pct(tb[t])}%;background:${bank.tags[t].color}"></i></span>
      </div>`).join('')}
      <div class="bar-row legend"><span></span><span>그때</span><span>지금</span></div>
    </section>
    <section class="changes">
      <h2>달라진 대답 ${changed.length}개</h2>
      ${changed.length ? `<ul>${changed.map((c) => `<li><b>${esc(c.q.text)}</b>
        <span>${esc(c.q.options[c.before.optionIndex].text)} <em>→</em> ${esc(c.q.options[c.after.optionIndex].text)}</span></li>`).join('')}</ul>`
    : '<p class="hint">모든 질문에 같은 대답을 했어요. 한결같은 당신이네요.</p>'}
    </section>
  `;
}

// ---------- 화면: 전시장 ----------
function viewGallery() {
  const list = db.hung.map(rec).filter(Boolean);
  view.innerHTML = `
    <header class="head">
      <p class="eyebrow">나만의 전시장</p>
      <h1>${list.length ? '벽에 걸어 둔 조각보' : '아직 걸어 둔 조각보가 없어요'}</h1>
    </header>
    <div class="wall">
      ${list.length ? list.map((r) => `<a class="hung" href="#quilt/${r.id}">
        <span class="rod" aria-hidden="true"></span>
        <span class="hung-cloth">${quiltSVG(r, bank, { complete: true })}</span>
        <span class="caption"><b>${fmtDate(r.completedAt)}</b><span>${esc(r.result.sentence)}</span></span>
      </a>`).join('') : `<p class="wall-empty">옷장에서 마음에 드는 조각보를 꺼내<br>‘전시장 벽에 걸기’를 눌러 보세요.</p>
        ${db.wardrobe.length ? '<a class="btn" href="#wardrobe">옷장 열기</a>' : ''}`}
    </div>
  `;
}

// ---------- 라우팅 ----------
function route() {
  const [name, a, b] = (location.hash.slice(1) || 'home').split('/');
  const tab = { home: 'home', q: 'home', wardrobe: 'wardrobe', quilt: 'wardrobe', compare: 'wardrobe', gallery: 'gallery' }[name] || 'home';
  document.querySelectorAll('#tabs a').forEach((el) => el.classList.toggle('on', el.dataset.tab === tab));
  document.body.dataset.view = name;
  if (name === 'q') viewQuestion();
  else if (name === 'quilt') viewQuilt(a, b === 'new');
  else if (name === 'wardrobe') viewWardrobe();
  else if (name === 'compare') viewCompare(a, b);
  else if (name === 'gallery') viewGallery();
  else viewHome();
  window.scrollTo(0, 0);
  if (name === 'quilt' && b === 'new') history.replaceState(null, '', `#quilt/${a}`);
}

async function boot() {
  try {
    const [q, m] = await Promise.all([
      fetch('data/questions.json?v=2').then((r) => r.json()),
      fetch('data/messages.json?v=2').then((r) => r.json()),
    ]);
    bank = q;
    msgs = m;
  } catch {
    view.innerHTML = '<p class="hint">질문을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.</p>';
    return;
  }
  db = load();
  // 질문 은행이 바뀌어 없는 질문의 답이 남아 있으면 정리
  if (db.current) db.current.answers = db.current.answers.filter((x) => qById(x.qid));
  window.addEventListener('hashchange', route);
  route();
}

boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
