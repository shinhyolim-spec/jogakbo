// 완성한 조각보 + 결과 문장을 한 장의 이미지로
import { quiltSVG } from './quilt.js?v=2';

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
  const H = 1350;
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
  for (let i = 0; i < 900; i++) {
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

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7a5c3e';
  ctx.font = `30px ${FONT}`;
  ctx.fillText(`일상의 조각보 · ${fmtDate(rec.completedAt)}`, W / 2, 96);

  const img = await loadSVG(quiltSVG(rec, bank, { complete: true }));
  const qw = 580;
  const qh = qw * (img.height / img.width);
  const qx = (W - qw) / 2;
  const qy = 140;
  ctx.save();
  ctx.shadowColor = 'rgba(80,55,30,.25)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.drawImage(img, qx, qy, qw, qh);
  ctx.restore();

  const R = rec.result;
  let y = qy + qh + 92;
  ctx.fillStyle = '#2f2a25';
  ctx.font = `bold 44px ${FONT}`;
  for (const l of wrap(ctx, R.sentence, 880)) { ctx.fillText(l, W / 2, y); y += 62; }
  y += 18;
  ctx.font = `28px ${FONT}`;
  ctx.fillStyle = '#6d5a47';
  const tags = R.tags.map((t) => `${t}`).join(' · ');
  ctx.fillText(`요즘 아끼는 것 — ${msgs.tags[R.tags[0]].value}`, W / 2, y);
  y += 46;
  ctx.fillText(`나의 결 — ${tags}`, W / 2, y);
  y += 74;
  ctx.fillStyle = '#4a3c2f';
  ctx.font = `34px ${FONT}`;
  for (const l of wrap(ctx, `“${R.word}”`, 860)) { ctx.fillText(l, W / 2, y); y += 50; }

  // 태그 색 띠
  const tagKeys = Object.keys(bank.tags);
  const bw = 60;
  let bx = W / 2 - (tagKeys.length * (bw + 10) - 10) / 2;
  for (const t of tagKeys) {
    ctx.fillStyle = bank.tags[t].color;
    ctx.globalAlpha = R.tags.includes(t) ? 0.95 : 0.35;
    ctx.fillRect(bx, H - 70, bw, 14);
    bx += bw + 10;
  }
  ctx.globalAlpha = 1;
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}
