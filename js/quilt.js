// 조각보 SVG 그리기 (화면·이미지 저장 공용)
import { layoutQuilt, rng } from './core.js?v=2';

const DARK = new Set(['안정', '자유']);
const BASE = '#cdb894'; // 빈 칸이 비치는 바탕 (연한 흙색 무명)
const BAND = '#8a6a4b'; // 완성 시 둘레 단 (흙색)
let uidSeq = 0;

// ---- 천연 염색 농담: 같은 색도 조각마다 조금씩 다르게 ----
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hsl(h, s, l) {
  const c = (v) => Math.min(1, Math.max(0, v));
  return `hsl(${((h % 360) + 360) % 360} ${(c(s) * 100).toFixed(1)}% ${(c(l) * 100).toFixed(1)}%)`;
}
function shade(hex, r, tag) {
  const [h, s, l] = hexToHsl(hex);
  const dl = tag === '쉼' ? (r() - 0.5) * 0.05 : (r() - 0.5) * 0.12;
  return hsl(h + (r() - 0.5) * 8, s * (0.85 + r() * 0.3), l + dl);
}

function defs(id) {
  // 선택지 순서(0~3)마다 다른 무늬: 민무늬 / 사선 / 꽃점 / 창살
  const set = (tone, c) => `
    <pattern id="${id}-p1${tone}" width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1="0" y1="0" x2="0" y2="4.5" stroke="${c}" stroke-width=".7" stroke-opacity=".2"/></pattern>
    <pattern id="${id}-p2${tone}" width="11" height="11" patternUnits="userSpaceOnUse">
      <g fill="${c}" fill-opacity=".3"><circle cx="5.5" cy="4.2" r=".75"/><circle cx="5.5" cy="6.8" r=".75"/><circle cx="4.2" cy="5.5" r=".75"/><circle cx="6.8" cy="5.5" r=".75"/></g>
      <circle cx="0" cy="0" r=".55" fill="${c}" fill-opacity=".22"/><circle cx="11" cy="11" r=".55" fill="${c}" fill-opacity=".22"/></pattern>
    <pattern id="${id}-p3${tone}" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M0 .5H8M.5 0V8" stroke="${c}" stroke-width=".55" stroke-opacity=".2" fill="none"/>
      <path d="M4 3.2V4.8M3.2 4H4.8" stroke="${c}" stroke-width=".5" stroke-opacity=".18"/></pattern>`;
  return `<defs>
    ${set('l', '#5b4630')}${set('d', '#f4ecdb')}
    <pattern id="${id}-weave" width="2.4" height="2.4" patternUnits="userSpaceOnUse">
      <path d="M0 .6H2.4M.6 0V2.4" stroke="#fff" stroke-width=".35" stroke-opacity=".14"/></pattern>
    <!-- 모시의 굵고 가는 실(슬럽): 가로결이 불규칙하게 비침 -->
    <pattern id="${id}-slub" width="60" height="13" patternUnits="userSpaceOnUse">
      <path d="M0 2.5H60" stroke="#fff" stroke-width=".5" stroke-opacity=".16"/>
      <path d="M6 6.2H34" stroke="#fff" stroke-width=".9" stroke-opacity=".12" stroke-linecap="round"/>
      <path d="M0 9.4H60" stroke="#000" stroke-width=".35" stroke-opacity=".05"/>
      <path d="M38 11.6H56" stroke="#fff" stroke-width=".7" stroke-opacity=".11" stroke-linecap="round"/></pattern>
    <radialGradient id="${id}-glow" cx=".42" cy=".36" r=".8">
      <stop offset="0" stop-color="#fffaf0" stop-opacity=".22"/>
      <stop offset=".6" stop-color="#fffaf0" stop-opacity="0"/>
      <stop offset="1" stop-color="#3b2a1a" stop-opacity=".1"/></radialGradient>
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
  const pad = opt.complete ? 12 : 4;
  const vw = L.W + pad * 2;
  const vh = L.H + pad * 2;
  const filled = new Map();
  quilt.answers.forEach((a, i) => filled.set(L.order[i], { a, i }));

  let empty = '';
  let pieces = '';
  let seams = '';
  L.rects.forEach((q, cell) => {
    const x = q.x + pad;
    const y = q.y + pad;
    const f = filled.get(cell);
    if (!f) {
      empty += `<rect x="${x + 1.5}" y="${y + 1.5}" width="${q.w - 3}" height="${q.h - 3}" fill="#fff" fill-opacity=".07" stroke="#a88f6a" stroke-opacity=".7" stroke-width=".6" stroke-dasharray="1.6 2.4"/>`;
      return;
    }
    const tag = f.a.tag;
    const base = bank.tags[tag]?.color || '#cccccc';
    // 조각마다 고정된 난수 (같은 조각보는 늘 같은 빛깔)
    const r = rng((quilt.seed ^ (cell * 2654435761)) >>> 0);
    const c1 = shade(base, r, tag);
    const tone = DARK.has(tag) ? 'd' : 'l';
    const oi = f.a.optionIndex || 0;
    const isNew = opt.newIndex === f.i;
    const op = tag === '쉼' ? 0.97 : 0.84;
    const o = 0.9; // 이웃과 살짝 겹침 → 겹친 솔기가 진해지는 모시 느낌
    let body = `<rect x="${x - o}" y="${y - o}" width="${q.w + o * 2}" height="${q.h + o * 2}" fill="${c1}" fill-opacity="${op}"/>`;
    // 넉넉한 조각 일부는 대각선으로 이어 붙인 세모 조각
    const tri = q.w > 34 && q.h > 34 && q.w / q.h < 1.7 && q.h / q.w < 1.7 && r() < 0.32;
    let triSeam = '';
    if (tri) {
      const c2 = shade(base, r, tag);
      const flip = r() < 0.5;
      const pts = flip
        ? `${x},${y} ${x + q.w},${y} ${x},${y + q.h}`
        : `${x},${y} ${x + q.w},${y} ${x + q.w},${y + q.h}`;
      body += `<polygon points="${pts}" fill="${c2}" fill-opacity="${op}"/>`;
      const d = flip ? `M${x + q.w} ${y}L${x} ${y + q.h}` : `M${x} ${y}L${x + q.w} ${y + q.h}`;
      triSeam = `<path d="${d}" stroke="#3b2a1a" stroke-opacity=".14" stroke-width="1.6"/><path d="${d}" stroke="#f6eedc" stroke-opacity=".85" stroke-width=".5" stroke-dasharray="1.4 1.1"/>`;
    }
    if (oi) body += `<rect x="${x}" y="${y}" width="${q.w}" height="${q.h}" fill="url(#${id}-p${oi}${tone})"/>`;
    body += `<rect x="${x}" y="${y}" width="${q.w}" height="${q.h}" fill="url(#${id}-slub)"/>`;
    pieces += `<g class="piece${isNew ? ' piece-new' : ''}">${body}${triSeam}</g>`;
    // 솔기: 겹친 천의 그림자 + 가는 미색 홈질 선
    seams += `<rect x="${x}" y="${y}" width="${q.w}" height="${q.h}" fill="none" stroke="#3b2a1a" stroke-opacity=".13" stroke-width="1.5"/>
      <rect x="${x}" y="${y}" width="${q.w}" height="${q.h}" fill="none" stroke="#f6eedc" stroke-opacity=".9" stroke-width=".55" stroke-dasharray="1.6 1.2"/>`;
  });

  let band = '';
  if (opt.complete) {
    const b = 6;
    // 둘레 단 + 네 귀의 쪽빛 귀 장식
    const corner = (cx, cy, rot) => `<g transform="translate(${cx} ${cy}) rotate(${rot})">
        <polygon points="0,0 ${pad},0 0,${pad}" fill="#2e5b88" fill-opacity=".9"/>
        <path d="M1.5 ${pad - 2.5}L${pad - 2.5} 1.5" stroke="#f6eedc" stroke-width=".6" stroke-dasharray="1.4 1"/></g>`;
    band = `<rect x="${b / 2}" y="${b / 2}" width="${vw - b}" height="${vh - b}" fill="none" stroke="${BAND}" stroke-width="${b}"/>
      <rect x="${b / 2}" y="${b / 2}" width="${vw - b}" height="${vh - b}" fill="none" stroke="url(#${id}-slub)" stroke-width="${b}"/>
      <rect x="${pad - 2.5}" y="${pad - 2.5}" width="${L.W + 5}" height="${L.H + 5}" fill="none" stroke="#e9dcc0" stroke-width="2.2"/>
      <rect x="${b + 1.2}" y="${b + 1.2}" width="${vw - b * 2 - 2.4}" height="${vh - b * 2 - 2.4}" fill="none" stroke="#f6eedc" stroke-opacity=".75" stroke-width=".5" stroke-dasharray="1.6 1.2"/>
      ${corner(0, 0, 0)}${corner(vw, 0, 90)}${corner(vw, vh, 180)}${corner(0, vh, 270)}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}" role="img" aria-label="${opt.label || `조각보, ${quilt.answers.length}조각 채움`}">
    ${defs(id)}
    <rect x="0" y="0" width="${vw}" height="${vh}" fill="${opt.complete ? '#e9dcc0' : BASE}"/>
    <rect x="0" y="0" width="${vw}" height="${vh}" fill="url(#${id}-weave)"/>
    ${empty}${pieces}${seams}
    <rect x="${pad}" y="${pad}" width="${L.W}" height="${L.H}" fill="url(#${id}-glow)" pointer-events="none"/>
    ${band}
  </svg>`;
}
