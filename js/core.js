// 화면과 무관한 계산: 난수, 조각보 배치, 질문 출제, 성향 집계, 결과 문장
export const TAG_ORDER = ['관계', '성취', '안정', '자유', '쉼', '성장'];

// 시드 고정 난수 (같은 조각보는 언제 열어도 같은 모양)
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

// 조각보 배치: 사각형을 반복해서 둘로 나눠 n개의 손바느질 같은 조각을 만든다.
// 가장 큰 조각부터 나누되, 크기 차이가 나도록 무작위성을 섞는다.
export function layoutQuilt(seed, n, W = 300, H = 360) {
  const r = rng(seed);
  let rects = [{ x: 0, y: 0, w: W, h: H }];
  const MIN = 26;
  while (rects.length < n) {
    // 면적에 무작위 가중을 곱해 다음에 나눌 조각 선택
    let best = -1;
    let bestScore = -1;
    rects.forEach((q, i) => {
      if (q.w < MIN * 2 && q.h < MIN * 2) return;
      const s = q.w * q.h * (0.55 + r() * 0.9);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    if (best < 0) break;
    const q = rects[best];
    let vertical = q.w / q.h > 1.15 ? true : q.h / q.w > 1.15 ? false : r() < 0.5;
    if (vertical && q.w < MIN * 2) vertical = false;
    if (!vertical && q.h < MIN * 2) vertical = true;
    const t = 0.32 + r() * 0.36;
    let a;
    let b;
    if (vertical) {
      const cut = Math.round(Math.min(Math.max(q.w * t, MIN), q.w - MIN));
      a = { x: q.x, y: q.y, w: cut, h: q.h };
      b = { x: q.x + cut, y: q.y, w: q.w - cut, h: q.h };
    } else {
      const cut = Math.round(Math.min(Math.max(q.h * t, MIN), q.h - MIN));
      a = { x: q.x, y: q.y, w: q.w, h: cut };
      b = { x: q.x, y: q.y + cut, w: q.w, h: q.h - cut };
    }
    rects.splice(best, 1, a, b);
  }
  // 위에서 아래, 왼쪽에서 오른쪽 순서로 정렬해 칸 번호를 안정적으로
  rects = rects.sort((p, q) => p.y - q.y || p.x - q.x);
  // 채워지는 순서는 따로 섞는다 (조각이 여기저기 붙어 가는 느낌)
  const order = rects.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { W, H, rects, order };
}

// 다음 질문: 아직 덜 나온 갈래(일상·일·관계…)에서 먼저, 그 안에서는 무작위
export function pickNextQuestion(bank, answeredIds, rand = Math.random) {
  const done = new Set(answeredIds);
  const left = bank.questions.filter((q) => !done.has(q.id));
  if (!left.length) return null;
  const answeredPerCat = {};
  bank.questions.forEach((q) => { if (done.has(q.id)) answeredPerCat[q.category] = (answeredPerCat[q.category] || 0) + 1; });
  const cats = [...new Set(left.map((q) => q.category))];
  const min = Math.min(...cats.map((c) => answeredPerCat[c] || 0));
  const pool = left.filter((q) => (answeredPerCat[q.category] || 0) === min);
  return pool[Math.floor(rand() * pool.length)];
}

// 성향 집계.
// 질문 은행에 태그별 선택지 수가 고르지 않아서(예: 자유 26개, 성취 11개)
// 단순히 고른 횟수만 세면 선택지가 많은 태그가 늘 위로 올라온다.
// 그래서 "그 태그를 고를 수 있었던 질문 중 실제로 고른 비율"로 순위를 매긴다.
export function tallyTags(bank, answers) {
  const byId = Object.fromEntries(bank.questions.map((q) => [q.id, q]));
  const stat = Object.fromEntries(TAG_ORDER.map((t) => [t, { tag: t, count: 0, offered: 0, last: -1 }]));
  answers.forEach((a, i) => {
    const q = byId[a.qid];
    if (!q) return;
    new Set(q.options.map((o) => o.tag)).forEach((t) => { if (stat[t]) stat[t].offered += 1; });
    if (stat[a.tag]) { stat[a.tag].count += 1; stat[a.tag].last = i; }
  });
  const list = Object.values(stat).map((s) => ({ ...s, rate: s.offered ? s.count / s.offered : 0 }));
  // 비율 → 고른 횟수 → 더 최근에 고른 것 순
  list.sort((p, q) => q.rate - p.rate || q.count - p.count || q.last - p.last);
  return list;
}

export function topTags(tally) {
  const picked = tally.filter((s) => s.count > 0);
  const top = picked.slice(0, 2);
  // 셋째가 둘째와 거의 비슷하면 함께 넣는다 (2~3개)
  const third = picked[2];
  if (third && top[1] && third.rate >= top[1].rate * 0.9) top.push(third);
  return top.map((s) => s.tag);
}

// 받침 여부로 조사 고르기
export function josa(word, pair) {
  const ch = word.charCodeAt(word.length - 1);
  const has = ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 !== 0;
  const [withB, without] = pair.split('/');
  return word + (has ? withB : without);
}

// 답 조합 지문: 어떤 질문에 몇 번째 답을 골랐는지 (답한 순서와 무관)
export function answerHash(answers) {
  const sig = answers.map((a) => `${a.qid}:${a.optionIndex}`).sort().join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < sig.length; i++) {
    h ^= sig.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 나를 표현하는 한 단어: 한 문장과 같은 성향 순위로 후보 묶음을 고르고,
// 그 안에서는 고른 답 조합으로 하나를 정한다.
// 1위가 유난히 두드러지면(2위 비율이 1위의 55% 미만) 그 성향 하나의 단어 묶음을 쓴다.
export const SOLO_RATIO = 0.55;
export function pickOneWord(words, bank, answers) {
  if (!words || !bank || !answers?.length) return null;
  const picked = tallyTags(bank, answers).filter((t) => t.count > 0);
  if (!picked.length) return null;
  const [p, s] = picked;
  const solo = !s || s.rate < p.rate * SOLO_RATIO;
  const pool = (!solo && words.pairs[`${p.tag}>${s.tag}`]) || words.solo[p.tag] || [];
  if (!pool.length) return null;
  const w = pool[answerHash(answers) % pool.length];
  return { word: w.word, line: w.line };
}

// 고른 답 조합으로 후보 중 하나 고르기. 항목마다 salt를 달리해 서로 따로 정해지게 한다.
export function chooseByAnswers(list, answers, salt) {
  if (!list || !list.length) return '';
  let h = answerHash(answers);
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 0x01000193) >>> 0;
  return list[Math.floor(rng(h)() * list.length)];
}

// 예전 형식(문구 하나)과 새 형식(후보 배열)을 모두 받는다
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export function buildResult(bank, msgs, answers, seed, words) {
  const tally = tallyTags(bank, answers);
  const tags = topTags(tally);
  const [p, s = p, t] = tags;
  const P = msgs.tags[p];
  const S = msgs.tags[s];
  const pick = (obj, key, oldKey, salt) => chooseByAnswers(asList(obj[key] ?? obj[oldKey]), answers, salt);
  // 한 문장: 앞부분(둘째 성향)과 뒷부분(첫째 성향)을 따로 고른다
  const front = p === s ? '' : pick(S, 'modifiers', 'modifier', 'front');
  const back = pick(P, 'cores', 'core', 'back');
  const sentence = front ? `${front} ${back}` : back;
  const valueNoun = pick(P, 'values', 'value', 'value1');
  const valueLine = pick(P, 'valueLines', 'valueLine', 'valueLine');
  const values = p === s
    ? `요즘 당신은 ${josa(valueNoun, '을/를')} 아끼는 사람이네요. ${valueLine}`
    : `요즘 당신은 ${josa(valueNoun, '을/를')} 아끼는 사람이네요. ${pick(S, 'values', 'value', 'value2')}도 마음 한켠에 소중히 두고 있어요. ${valueLine}`;
  let need = `지금 당신에게는 ${josa(P.need, '이/가')} 필요해 보여요. ${P.needLine}`;
  if (t) need += ` ${msgs.third.replace('{tag}', t)}`;
  const word = pick(P, 'words', 'words', 'word');
  return {
    tags,
    tally: tally.map(({ tag, count, offered }) => ({ tag, count, offered })),
    sentence,
    sentenceParts: { front, back },
    values,
    valueNoun,
    need,
    word,
    oneWord: pickOneWord(words, bank, answers),
  };
}
