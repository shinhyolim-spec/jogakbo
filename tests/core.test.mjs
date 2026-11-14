import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutQuilt, pickNextQuestion, tallyTags, topTags, buildResult, josa, rng, TAG_ORDER, pickOneWord, answerHash } from '../js/core.js';

const bank = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url)));
const msgs = JSON.parse(readFileSync(new URL('../data/messages.json', import.meta.url)));
const words = JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url)));

// 한 단어 후보: 40개 이상, 중복 없음, 모든 1위>2위 조합과 단독 성향에 후보가 있음
const allWords = [...Object.values(words.pairs).flat(), ...Object.values(words.solo).flat()];
assert.ok(allWords.length >= 40, `후보 ${allWords.length}개`);
assert.equal(new Set(allWords.map((w) => w.word)).size, allWords.length, '중복 단어');
for (const w of allWords) assert.ok(w.word && w.line, JSON.stringify(w));
for (const a of TAG_ORDER) {
  assert.ok(words.solo[a]?.length, `solo ${a}`);
  for (const b of TAG_ORDER) if (a !== b) assert.ok(words.pairs[`${a}>${b}`]?.length, `pair ${a}>${b}`);
}

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
// 한 단어: 답 순서와 무관, 시드와 무관, 답이 같으면 늘 같은 단어
const shuffled = [...answers].reverse();
assert.equal(answerHash(answers), answerHash(shuffled));
assert.deepEqual(pickOneWord(words, bank, answers), pickOneWord(words, bank, shuffled));
assert.deepEqual(buildResult(bank, msgs, answers, 1, words).oneWord, buildResult(bank, msgs, answers, 999, words).oneWord);
assert.equal(pickOneWord(null, bank, answers), null); // 단어 파일이 없어도 깨지지 않음
// 1·2위 조합의 후보 안에서 나옴
const t2 = tallyTags(bank, answers).filter((t) => t.count > 0);
const pool = t2[1].rate < t2[0].rate * 0.55 ? words.solo[t2[0].tag] : words.pairs[`${t2[0].tag}>${t2[1].tag}`];
assert.ok(pool.some((w) => w.word === pickOneWord(words, bank, answers).word));
// 성취가 나올 때마다 성취만 고르면 → 성취가 유난히 두드러짐 → 성취 단독 단어
assert.ok(words.solo['성취'].some((w) => w.word === pickOneWord(words, bank, ach).word));

// 결과 문구: 답이 같으면 늘 같고(시드 무관), 앞·뒷부분은 각 성향의 후보에서 나옴
const r1 = buildResult(bank, msgs, answers, 1, words);
assert.deepEqual(r1, buildResult(bank, msgs, answers, 999, words));
assert.deepEqual(r1, buildResult(bank, msgs, shuffled, 3, words));
assert.ok(msgs.tags[r1.tags[1]].modifiers.includes(r1.sentenceParts.front));
assert.ok(msgs.tags[r1.tags[0]].cores.includes(r1.sentenceParts.back));
assert.equal(r1.sentence, `${r1.sentenceParts.front} ${r1.sentenceParts.back}`);
assert.ok(msgs.tags[r1.tags[0]].values.includes(r1.valueNoun));
// 예전 형식(문구 하나씩)의 messages로도 깨지지 않음
const oldMsgs = { ...msgs, tags: Object.fromEntries(TAG_ORDER.map((t) => [t, { ...msgs.tags[t], modifiers: undefined, cores: undefined, values: undefined, valueLines: undefined, modifier: msgs.tags[t].modifiers[0], core: msgs.tags[t].cores[0], value: msgs.tags[t].values[0], valueLine: msgs.tags[t].valueLines[0] }])) };
assert.ok(!/undefined/.test(JSON.stringify(buildResult(bank, oldMsgs, answers, 1, words))));
// 같은 1·2위라도 답이 다르면 앞·뒷부분이 따로 달라짐
const fronts = new Set(); const backs = new Set();
for (let k = 0; k < 200; k++) {
  const r = rng(500 + k);
  const a2 = bank.questions.map((q) => { const i = Math.floor(r() * 4); return { qid: q.id, optionIndex: i, tag: q.options[i].tag }; });
  const v = buildResult(bank, msgs, a2, 0, words);
  fronts.add(v.sentenceParts.front); backs.add(v.sentenceParts.back);
}
assert.ok(fronts.size >= 25 && backs.size >= 25, `앞 ${fronts.size} 뒤 ${backs.size}`);

const ex = buildResult(bank, msgs, answers, 5, words);
console.log(ex.tags, ex.oneWord, '\n', ex.sentence, '\n', ex.values, '\n', ex.need, '\n', ex.word);
console.log('core tests passed');
