// 완성한 조각보 + 결과 문장을 한 장의 이미지로
import { quiltSVG } from './quilt.js?v=3';

const FONT = '"Gowun Batang", "Nanum Myeongjo", "AppleMyungjo", serif';

function loadSVG(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function wrap(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export const fmtDate = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

export async function renderShareImage(rec, bank, msgs) {
  const W = 1080;
  const H = 2000; // 넉넉히 그린 뒤 내용 높이에 맞춰 자른다
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  try { await Promise.all([document.fonts.load(`40px "Gowun Batang"`), document.fonts.load(`bold 40px "Gowun Batang"`)]); } catch { /* 기본 글꼴 */ }

  // 한지 바탕: 미색 + 섬유 결
  ctx.fillStyle = '#f5efe2';
  ctx.fillRect(0, 0, W, H);
  let s = rec.seed || 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 1200; i++) {
    ctx.strokeStyle = `rgba(150,120,80,${0.03 + rnd() * 0.05})`;
    ctx.lineWidth = 0.6 + rnd();
    const x = rnd() * W;
    const y = rnd() * H;
    const a = rnd() * Math.PI;
    const l = 6 + rnd() * 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const spaced = (px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7a5c3e';
  ctx.font = `30px ${FONT}`;
  ctx.fillText(`일상의 조각보 · ${fmtDate(rec.completedAt)}`, W / 2, 96);

  const img = await loadSVG(quiltSVG(rec, bank, { complete: true }));
  const qw = 520;
  const qh = qw * (img.height / img.width);
  const qx = (W - qw) / 2;
  const qy = 136;
  ctx.save();
  ctx.shadowColor = 'rgba(80,55,30,.25)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.drawImage(img, qx, qy, qw, qh);
  ctx.restore();

  const R = rec.result;
  let y = qy + qh + 84;

  // 나를 표현하는 한 단어 — 카드에서 가장 크게
  if (R.oneWord) {
    ctx.fillStyle = '#8a6a4b';
    ctx.font = `26px ${FONT}`;
    spaced(6);
    ctx.fillText('나를 표현하는 한 단어', W / 2, y);
    y += 112;
    ctx.fillStyle = '#2f2a25';
    ctx.font = `92px ${FONT}`;
    spaced(14);
    ctx.fillText(R.oneWord.word, W / 2, y);
    spaced(0);
    y += 66;
    ctx.fillStyle = '#6d5a47';
    ctx.font = `32px ${FONT}`;
    for (const l of wrap(ctx, R.oneWord.line, 880)) { ctx.fillText(l, W / 2, y); y += 46; }
    // 짧은 홈질선
    y += 14;
    ctx.strokeStyle = '#c9b28f';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(W / 2 - 60, y);
    ctx.lineTo(W / 2 + 60, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 78;
  }

  ctx.fillStyle = '#2f2a25';
  ctx.font = `bold 40px ${FONT}`;
  for (const l of wrap(ctx, R.sentence, 880)) { ctx.fillText(l, W / 2, y); y += 58; }
  y += 16;
  ctx.font = `28px ${FONT}`;
  ctx.fillStyle = '#6d5a47';
  const tags = R.tags.map((t) => `${t}`).join(' · ');
  ctx.fillText(`요즘 아끼는 것 — ${msgs.tags[R.tags[0]].value}`, W / 2, y);
  y += 46;
  ctx.fillText(`나의 결 — ${tags}`, W / 2, y);
  y += 70;
  ctx.fillStyle = '#4a3c2f';
  ctx.font = `32px ${FONT}`;
  for (const l of wrap(ctx, `“${R.word}”`, 860)) { ctx.fillText(l, W / 2, y); y += 48; }

  // 태그 색 띠
  y += 40;
  const tagKeys = Object.keys(bank.tags);
  const bw = 60;
  let bx = W / 2 - (tagKeys.length * (bw + 10) - 10) / 2;
  for (const t of tagKeys) {
    ctx.fillStyle = bank.tags[t].color;
    ctx.globalAlpha = R.tags.includes(t) ? 0.95 : 0.35;
    ctx.fillRect(bx, y, bw, 14);
    bx += bw + 10;
  }
  ctx.globalAlpha = 1;

  // 내용 높이에 맞춰 자르기 (최소 1350 = 4:5 비율)
  const outH = Math.min(H, Math.max(1350, Math.ceil(y + 70)));
  const out = document.createElement('canvas');
  out.width = W;
  out.height = outH;
  out.getContext('2d').drawImage(c, 0, 0);
  return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}
