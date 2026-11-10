// 조각보 SVG 그리기 (화면·이미지 저장 공용)
import { layoutQuilt } from './core.js?v=1';

const DARK = new Set(['안정', '자유']);
const BASE = '#cdb894'; // 빈 칸이 비치는 바탕 (연한 흙색 무명)
const BAND = '#8a6a4b'; // 완성 시 둘레 단 (흙색)
let uidSeq = 0;

function patternDefs(id) {
  // 선택지 순서(0~3)마다 다른 무늬: 민무늬 / 빗살 / 점 / 창살
  const defs = (tone, c) => `
    <pattern id="${id}-p1${tone}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="${c}" stroke-width="1.1" stroke-opacity=".22"/></pattern>
    <pattern id="${id}-p2${tone}" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="1.15" fill="${c}" fill-opacity=".28"/></pattern>
    <pattern id="${id}-p3${tone}" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M0 5H10M5 0V10" stroke="${c}" stroke-width=".7" stroke-opacity=".22" fill="none"/></pattern>`;
  return `<defs>
    ${defs('l', '#5b4630')}${defs('d', '#f4ecdb')}
    <pattern id="${id}-weave" width="3" height="3" patternUnits="userSpaceOnUse">
      <path d="M0 .5H3M.5 0V3" stroke="#fff" stroke-width=".45" stroke-opacity=".16"/></pattern>
    <linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".18"/>
      <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient>
  </defs>`;
}

/**
 * @param {{seed:number, answers:{optionIndex:number, tag:string}[]}} quilt
 * @param {object} bank 질문 은행 (태그 색, 질문 수)
 * @param {{newIndex?:number, complete?:boolean, label?:string}} opt
 */
export function quiltSVG(quilt, bank, opt = {}) {
  const n = bank.questions.length;
  const L = layoutQuilt(quilt.seed, n);
  const id = `jq${++uidSeq}`;
  const pad = opt.complete ? 10 : 4;
  const vw = L.W + pad * 2;
  const vh = L.H + pad * 2;
  const filled = new Map();
  quilt.answers.forEach((a, i) => filled.set(L.order[i], { a, i }));

  let empty = '';
  let pieces = '';
  L.rects.forEach((q, cell) => {
    const x = q.x + pad;
    const y = q.y + pad;
    const f = filled.get(cell);
    if (!f) {
      empty += `<rect x="${x + 2}" y="${y + 2}" width="${q.w - 4}" height="${q.h - 4}" rx="1" fill="#b89f78" fill-opacity=".12" stroke="#a88f6a" stroke-width=".7" stroke-dasharray="2.5 2.5"/>`;
      return;
    }
    const tag = f.a.tag;
    const color = bank.tags[tag]?.color || '#ccc';
    const tone = DARK.has(tag) ? 'd' : 'l';
    const stitch = DARK.has(tag) ? '#efe4cc' : tag === '쉼' ? '#b9a47f' : '#f7f0e0';
    const oi = f.a.optionIndex || 0;
    const isNew = opt.newIndex === f.i;
    // 이웃 조각과 1px씩 겹쳐 놓아, 겹친 자리가 살짝 진해지는 모시 느낌
    pieces += `<g class="piece${isNew ? ' piece-new' : ''}">
      <rect x="${x - 0.8}" y="${y - 0.8}" width="${q.w + 1.6}" height="${q.h + 1.6}" fill="${color}" fill-opacity="${tag === '쉼' ? 1 : 0.86}"/>
      ${oi ? `<rect x="${x}" y="${y}" width="${q.w}" height="${q.h}" fill="url(#${id}-p${oi}${tone})"/>` : ''}
      <rect x="${x + 2.6}" y="${y + 2.6}" width="${Math.max(q.w - 5.2, 1)}" height="${Math.max(q.h - 5.2, 1)}" fill="none" stroke="${stitch}" stroke-width=".75" stroke-dasharray="2.6 1.9" stroke-linecap="round"/>
    </g>`;
  });

  // 조각 사이 바느질선 (가는 미색 선)
  let seams = '';
  L.rects.forEach((q, cell) => {
    if (!filled.has(cell)) return;
    seams += `<rect x="${q.x + pad}" y="${q.y + pad}" width="${q.w}" height="${q.h}" fill="none" stroke="#f3ead6" stroke-opacity=".9" stroke-width=".9"/>`;
  });

  const band = opt.complete
    ? `<rect x="3" y="3" width="${vw - 6}" height="${vh - 6}" fill="none" stroke="${BAND}" stroke-width="6" stroke-opacity=".9"/>
       <rect x="6.5" y="6.5" width="${vw - 13}" height="${vh - 13}" fill="none" stroke="#f3ead6" stroke-width=".8" stroke-dasharray="3 2"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}" role="img" aria-label="${opt.label || `조각보, ${quilt.answers.length}조각 채움`}">
    ${patternDefs(id)}
    <rect x="0" y="0" width="${vw}" height="${vh}" fill="${BASE}"/>
    <rect x="0" y="0" width="${vw}" height="${vh}" fill="url(#${id}-weave)"/>
    ${empty}${pieces}${seams}
    <rect x="${pad}" y="${pad}" width="${L.W}" height="${L.H}" fill="url(#${id}-sheen)" pointer-events="none"/>
    ${band}
  </svg>`;
}
