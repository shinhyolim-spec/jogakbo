import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutQuilt, pickNextQuestion, tallyTags, topTags, buildResult, josa, rng, TAG_ORDER } from '../js/core.js';

const bank = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url)));
const msgs = JSON.parse(readFileSync(new URL('../data/messages.json', import.meta.url)));

// 질문 은행 형식
const ids = new Set();
for (const q of bank.questions) {
  assert.ok(!ids.has(q.id), `중복 id ${q.id}`); ids.add(q.id);
  assert.ok(bank.categories.includes(q.category), q.id);
  assert.equal(q.options.length, 4, q.id);
  for (const o of q.options) assert.ok(TAG_ORDER.includes(o.tag), `${q.id} 태그 ${o.tag}`);
}
assert.equal(bank.questions.length, 30);
for (const t of TAG_ORDER) { assert.ok(bank.tags[t]?.color); assert.ok(msgs.tags[t]?.core); }

// 배치: 정확히 n칸, 겹침 없이 전체를 덮음
for (let s = 1; s < 300; s++) {
  const L = layoutQuilt(s, 30);
  assert.equal(L.rects.length, 30);
  assert.equal(L.rects.reduce((a, r) => a + r.w * r.h, 0), L.W * L.H);
  assert.ok(L.rects.every((r) => r.w >= 20 && r.h >= 20), `seed ${s} 너무 작은 조각`);
  assert.deepEqual([...L.order].sort((a, b) => a - b), [...Array(30).keys()]);
}
assert.deepEqual(layoutQuilt(42, 30), layoutQuilt(42, 30));

// 출제: 중복 없이 30개, 갈래가 고르게 섞임
const r = rng(7);
const asked = [];
for (let i = 0; i < 30; i++) {
  const q = pickNextQuestion(bank, asked, r);
  assert.ok(q && !asked.includes(q.id));
  asked.push(q.id);
  const perCat = {};
  asked.forEach((id) => { const c = bank.questions.find((x) => x.id === id).category; perCat[c] = (perCat[c] || 0) + 1; });
  const v = Object.values(perCat);
  if (Object.keys(perCat).length === 6) assert.ok(Math.max(...v) - Math.min(...v) <= 1);
}
assert.equal(pickNextQuestion(bank, asked), null);

// 집계: 늘 첫째 선택지(태그 섞임)를 고르면…
const answers = bank.questions.map((q) => ({ qid: q.id, optionIndex: 0, tag: q.options[0].tag }));
const tally = tallyTags(bank, answers);
assert.equal(tally.reduce((a, s) => a + s.count, 0), 30);
// 성취만 고를 수 있는 만큼 다 고르면 성취가 1위여야 함 (선택지 수 보정 확인)
const ach = bank.questions.map((q) => {
  const i = Math.max(0, q.options.findIndex((o) => o.tag === '성취'));
  return { qid: q.id, optionIndex: i, tag: q.options[i].tag };
});
assert.equal(topTags(tallyTags(bank, ach))[0], '성취');

assert.equal(josa('온기', '을/를'), '온기를');
assert.equal(josa('뿌듯함', '을/를'), '뿌듯함을');

// 결과 문장: 모든 1·2위 조합에서 만들어짐
for (const a of TAG_ORDER) for (const b of TAG_ORDER) {
  const fake = bank.questions.map((q) => {
    let i = q.options.findIndex((o) => o.tag === a);
    if (i < 0) i = q.options.findIndex((o) => o.tag === b);
    if (i < 0) i = 0;
    return { qid: q.id, optionIndex: i, tag: q.options[i].tag };
  });
  const res = buildResult(bank, msgs, fake, 3);
  assert.ok(res.sentence && res.values && res.need && res.word);
  assert.ok(!/undefined/.test(JSON.stringify(res)));
}
const ex = buildResult(bank, msgs, answers, 5);
console.log(ex.tags, '\n', ex.sentence, '\n', ex.values, '\n', ex.need, '\n', ex.word);
console.log('core tests passed');
