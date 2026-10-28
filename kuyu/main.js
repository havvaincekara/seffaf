// ŞEFFAF · II — KUYU
// Kafa takibiyle hesaplanan bir derinlik yanılsaması. Ne kadar teslim olursan kuyu o kadar derinleşir;
// bakışını çektiğin anda derinliğin hiç olmadığı ortaya çıkar.
import {
  kameraAc, yuzIzleyici, pozIzleyici, yuzleriCoz, tamEkran, parametre, sinirla,
} from "../ortak/kamera.js";

// ---------- Ayarlar ----------
const EKRAN_M = parametre("ekran", 1.6);   // görüntünün fiziksel genişliği (metre)
const FOV = parametre("fov", 62);          // kameranın yatay görüş açısı (derece)
const KAMERA = parametre("kamera", "ust"); // kamera ekranın üstünde mi altında mı
const HIZ = parametre("hiz", 1);
const DEMO = parametre("demo", 0) == 1;
const YUZ_M = 0.15;                        // ortalama yanak-yanak genişliği
const TAN = Math.tan((FOV * Math.PI) / 360);

const tuval = document.getElementById("sahne");
const ctx = tuval.getContext("2d");
const video = document.getElementById("video");
const ortu = document.getElementById("ortu");
const durum = document.getElementById("durum");
const panel = document.getElementById("panel");

let W = 0, H = 0, DPR = 1, h = 0.5625;
function boyutla() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight; h = H / W;
  tuval.width = Math.round(W * DPR); tuval.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", boyutla);
boyutla();

// ---------- Baş ve izdüşüm ----------
// Ekran düzlemi z=0; birim = ekran genişliği. İzleyici z>0, kuyu z<0.
const bas = { x: 0, y: -0.05, z: 1.6 / EKRAN_M };
const basHedef = { ...bas };
let duz = 0; // 0: derin, 1: tamamen yassı

function yansit(px, py, pz) {
  const z = pz * (1 - duz);
  const t = bas.z / (bas.z - z);
  const sx = bas.x + t * (px - bas.x);
  const sy = bas.y + t * (py - bas.y);
  return [(sx + 0.5) * W, (h / 2 - sy) * W, t];
}

function yuzdenBas(f, en) {
  const zM = YUZ_M / Math.max(0.02, f.w * 2 * TAN);
  const xM = (f.x - 0.5) * 2 * TAN * zM;
  const yM = -(f.y - 0.5) * (2 * TAN / en) * zM;
  const kamY = DEMO || KAMERA === "orta" ? 0 : KAMERA === "alt" ? -h / 2 : h / 2;
  return { x: xM / EKRAN_M, y: kamY + yM / EKRAN_M, z: Math.max(0.15, zM / EKRAN_M) };
}

// ---------- Durum ----------
let calisiyor = false;
let videoEn = 16 / 9;
let yuzModel = null, pozModel = null;
let sonVideoZaman = -1, kareNo = 0;
let yuzler = [];
let pozlar = [];

const S = {
  evre: "bos",       // bos | bakiyor | kirilma
  C: 0,              // teslimiyet / ele geçirilme 0..1
  D: 1.2,            // kuyu derinliği (ekran genişliği cinsinden)
  akis: 0,
  sureBakis: 0,
  z0: 1, enYakin: 1,
  donukSure: 0, kapaliSure: 0, kayipSure: 0,
  kirilmaZaman: 0,
  rapor: null,
  iz: null, izZaman: 0,
  kisiSayisi: 0,
};

// Kuyunun içinde süzülen buyruklar
const BUYRUKLAR = ["yaklaş", "biraz daha", "kal", "kımıldama", "bak", "burada", "daha derin", "uzaklaşma", "hâlâ buradayız", "yalnızca sen", "gözünü ayırma", "bir saniye daha"];
let tohum = 11;
const rnd = () => ((tohum = (tohum * 16807) % 2147483647) / 2147483647);
const kelimeler = Array.from({ length: 18 }, (_, i) => ({
  m: BUYRUKLAR[i % BUYRUKLAR.length],
  x: (rnd() - 0.5) * 0.7,
  y: (rnd() - 0.5) * 0.8,
  z0: rnd() * 6,
}));

// ---------- Algılama ----------
function algila(t) {
  if (DEMO) { demoAlgila(t); return; }
  if (!calisiyor || video.readyState < 2) return;
  if (video.currentTime === sonVideoZaman) return;
  sonVideoZaman = video.currentTime;
  kareNo++;
  try {
    yuzler = yuzleriCoz(yuzModel.detectForVideo(video, t), videoEn);
    if (kareNo % 2 === 0) {
      const r = pozModel.detectForVideo(video, t);
      pozlar = (r.landmarks || []).map((lm) => lm.map((p) => ({ x: 1 - p.x, y: p.y, v: p.visibility == null ? 1 : p.visibility })));
    }
  } catch (e) { console.warn(e); }
}

// Fareyle deneme: imleç = baş, tekerlek = uzaklık, K basılı = başını çevir, boşluk basılı = gözleri kapat
const fare = { x: 0.5, y: 0.42, zM: 1.5, var: false };
let tusK = false, tusBosluk = false;
window.addEventListener("pointermove", (e) => { fare.x = e.clientX / W; fare.y = e.clientY / H; fare.var = true; });
window.addEventListener("wheel", (e) => { fare.zM = sinirla(fare.zM + e.deltaY * 0.0015, 0.35, 3.5); }, { passive: true });

function demoPoz(fx, fy, u, en) {
  const p = Array.from({ length: 33 }, () => ({ x: fx, y: fy, v: 0 }));
  const k = (i, dx, dy) => (p[i] = { x: fx + dx * u, y: fy + dy * u * en, v: 1 });
  k(0, 0, 0);
  k(11, -1.25, 1.45); k(12, 1.25, 1.45);
  k(13, -1.55, 2.7); k(14, 1.55, 2.7);
  k(15, -1.5, 3.8); k(16, 1.5, 3.8);
  k(23, -0.75, 3.95); k(24, 0.75, 3.95);
  k(25, -0.8, 5.6); k(26, 0.8, 5.6);
  k(27, -0.85, 7.2); k(28, 0.85, 7.2);
  return p;
}

function demoAlgila() {
  if (!calisiyor) return;
  yuzler = []; pozlar = [];
  if (!fare.var) return;
  const w = YUZ_M / (fare.zM * 2 * TAN);
  yuzler.push({ x: fare.x, y: fare.y, w, yaw: tusK ? 0.85 : 0, pitch: 0, gozKapali: tusBosluk });
  pozlar.push(demoPoz(fare.x, fare.y, w * 0.9, videoEn));
}

// ---------- Mantık ----------
function birincil() {
  if (!yuzler.length) return null;
  return yuzler.reduce((a, b) => (b.w > a.w ? b : a));
}

function kirilmayaGec(t) {
  S.evre = "kirilma";
  S.kirilmaZaman = t;
  S.rapor = {
    sure: S.sureBakis,
    cm: Math.max(0, Math.round((S.z0 - S.enYakin) * EKRAN_M * 100)),
    derinlik: S.D * EKRAN_M,
  };
  if (pozlar.length) {
    // İkizi o anki perspektifiyle yüzeye dondur: artık başını oynatsan da kımıldamaz, çünkü hep düzdü.
    const b = { ...bas };
    S.iz = govde(pozlar[0], S.C);
    S.izZ = -(0.45 + S.C * S.C * 1.8);
    S.izYansit = (x, y, z) => { const tt = b.z / (b.z - z); return [(b.x + tt * (x - b.x) + 0.5) * W, (h / 2 - (b.y + tt * (y - b.y))) * W, tt]; };
    S.izZaman = t;
  }
  sesKir();
}

function yeniBakis() {
  S.evre = "bakiyor";
  S.C = 0; S.sureBakis = 0;
  S.z0 = bas.z; S.enYakin = bas.z;
  S.donukSure = S.kapaliSure = S.kayipSure = 0;
}

function guncelle(dt, t) {
  const sn = t / 1000;
  const f = birincil();
  S.kisiSayisi = yuzler.length;

  // Baş konumu
  if (f && calisiyor) Object.assign(basHedef, yuzdenBas(f, videoEn));
  else Object.assign(basHedef, { x: Math.sin(sn * 0.21) * 0.07, y: -0.04 + Math.cos(sn * 0.13) * 0.03, z: 1.6 / EKRAN_M });
  const k = 1 - Math.exp(-dt * 7);
  const oncekiX = bas.x, oncekiY = bas.y, oncekiZ = bas.z;
  bas.x += (basHedef.x - bas.x) * k;
  bas.y += (basHedef.y - bas.y) * k;
  bas.z += (basHedef.z - bas.z) * k;
  const hizBas = Math.hypot(bas.x - oncekiX, bas.y - oncekiY, (bas.z - oncekiZ) * 0.5) / Math.max(dt, 0.016);

  if (S.evre === "kirilma") {
    const g = (t - S.kirilmaZaman) / 1000;
    duz = g < 1.6 ? 1 - Math.pow(1 - g / 1.6, 3) : g < 10 ? 1 : Math.max(0, 1 - (g - 10) / 2.2);
    if (g > 12.2) { duz = 0; S.C = 0; S.D = 1.2; S.evre = f ? "bakiyor" : "bos"; if (f) yeniBakis(); }
  } else {
    duz = Math.max(0, duz - dt);
    if (!f) {
      S.kayipSure += dt;
      if (S.evre === "bakiyor" && S.kayipSure > 1.2) {
        if (S.C > 0.18) kirilmayaGec(t); else S.evre = "bos";
      }
      S.C = Math.max(0, S.C - dt * 0.05);
    } else {
      S.kayipSure = 0;
      if (S.evre === "bos") yeniBakis();
      const donuk = Math.abs(f.yaw) > 0.6;
      S.donukSure = donuk ? S.donukSure + dt : 0;
      S.kapaliSure = f.gozKapali ? S.kapaliSure + dt : 0;
      const dikkat = !donuk && !f.gozKapali && Math.abs(f.yaw) < 0.4 ? 1 : 0;
      const sabit = 1 - sinirla(hizBas / 0.25);
      const yaklasma = sinirla(((S.z0 - bas.z) / S.z0) * 2.5);
      if (dikkat) S.C = sinirla(S.C + dt * 0.04 * HIZ * (0.35 + 0.65 * sabit) * (0.6 + 1.3 * yaklasma));
      else S.C = Math.max(0, S.C - dt * 0.03);
      S.sureBakis += dt * dikkat;
      S.enYakin = Math.min(S.enYakin, bas.z);
      // Bakışı çekmek ya da geri çekilmek büyüyü bozar
      if (S.donukSure > 0.7 || S.kapaliSure > 1.0 || (bas.z > S.z0 * 1.35 && bas.z > S.enYakin * 1.5)) {
        if (S.C > 0.18) kirilmayaGec(t);
        else { S.C *= 0.5; S.z0 = bas.z; S.enYakin = bas.z; }
      }
    }
  }

  // Derinlik ve akış
  const hedefD = 1.2 + S.C * S.C * 42;
  if (S.evre !== "kirilma") S.D += (hedefD - S.D) * (1 - Math.exp(-dt * 1.2));
  S.akis += dt * (0.05 + S.C * 0.9);
  sesGuncelle();
}

// ---------- Beden piktogramı ----------
// Poz noktalarını kuyunun içinde duran bir piktograma çevirir ve ele geçirilmeyi işler:
// baş öne düşer, omuzlar kapanır, kollar sarkar.
function govde(lm, C) {
  const g = (i) => lm[i];
  const ok = (i) => lm[i] && lm[i].v > 0.45;
  if (!ok(0) && !(ok(11) && ok(12))) return null;
  const en = videoEn;
  const omuzO = ok(11) && ok(12) ? { x: (g(11).x + g(12).x) / 2, y: (g(11).y + g(12).y) / 2 } : { x: g(0).x, y: g(0).y + 0.12 };
  const omuzG = ok(11) && ok(12) ? Math.abs(g(11).x - g(12).x) : 0.12;
  const kalcaO = ok(23) && ok(24) ? { x: (g(23).x + g(24).x) / 2, y: (g(23).y + g(24).y) / 2 } : { x: omuzO.x, y: omuzO.y + omuzG * 1.5 * en };
  const govdeU = Math.max(0.05, kalcaO.y - omuzO.y);
  const P = {};
  const al = (ad, i, yedek) => (P[ad] = ok(i) ? { x: g(i).x, y: g(i).y } : yedek);
  al("burun", 0, { x: omuzO.x, y: omuzO.y - govdeU * 0.45 });
  al("so", 11, { x: omuzO.x - omuzG / 2, y: omuzO.y });
  al("sa", 12, { x: omuzO.x + omuzG / 2, y: omuzO.y });
  al("sdir", 13, { x: P.so.x - omuzG * 0.12, y: P.so.y + govdeU * 0.5 });
  al("adir", 14, { x: P.sa.x + omuzG * 0.12, y: P.sa.y + govdeU * 0.5 });
  al("sel", 15, { x: P.sdir.x, y: P.sdir.y + govdeU * 0.48 });
  al("ael", 16, { x: P.adir.x, y: P.adir.y + govdeU * 0.48 });
  al("sk", 23, { x: kalcaO.x - omuzG * 0.3, y: kalcaO.y });
  al("ak", 24, { x: kalcaO.x + omuzG * 0.3, y: kalcaO.y });
  al("sdz", 25, { x: P.sk.x - omuzG * 0.04, y: P.sk.y + govdeU * 0.95 });
  al("adz", 26, { x: P.ak.x + omuzG * 0.04, y: P.ak.y + govdeU * 0.95 });
  al("sbil", 27, { x: P.sdz.x - omuzG * 0.03, y: P.sdz.y + govdeU * 0.95 });
  al("abil", 28, { x: P.adz.x + omuzG * 0.03, y: P.adz.y + govdeU * 0.95 });

  // Ele geçirilme: baş düşer, omuzlar öne kapanır, kollar gövdeye yapışır
  P.burun = { x: P.burun.x, y: P.burun.y + govdeU * 0.42 * C };
  const kap = 0.25 * C;
  P.so = { x: P.so.x + (omuzO.x - P.so.x) * kap, y: P.so.y + govdeU * 0.06 * C };
  P.sa = { x: P.sa.x + (omuzO.x - P.sa.x) * kap, y: P.sa.y + govdeU * 0.06 * C };
  for (const [d, e, o, k] of [["sdir", "sel", "so", "sk"], ["adir", "ael", "sa", "ak"]]) {
    const sark = C * 0.7;
    P[d] = { x: P[d].x + (P[o].x - P[d].x) * sark * 0.8, y: P[d].y + (P[o].y + govdeU * 0.5 - P[d].y) * sark };
    P[e] = { x: P[e].x + (P[k].x - P[e].x) * sark * 0.8, y: P[e].y + (P[k].y + govdeU * 0.1 - P[e].y) * sark };
  }

  // Dünya koordinatlarına: ayaklar kuyunun tabanında
  const taban = Math.max(P.sbil.y, P.abil.y);
  const olcek = (h * 0.62) / Math.max(0.2, taban - Math.min(P.burun.y, P.so.y) + govdeU * 0.3);
  const cx = (omuzO.x - 0.5) * 0.9;
  const D = {};
  for (const ad in P) D[ad] = { x: cx + (P[ad].x - omuzO.x) * olcek * en, y: -h / 2 + (taban - P[ad].y) * olcek };
  D.kalinlik = Math.max(0.01, omuzG * olcek * en * 0.24);
  D.basR = D.kalinlik * 1.05;
  return D;
}

function piktogram(D, z, alfa, renk = "200,222,252", izdusum = yansit) {
  if (!D) return;
  const yansit = izdusum;
  const Y = (p) => yansit(p.x, p.y, z);
  const [, , t] = Y(D.so);
  const kal = D.kalinlik * t * W;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `rgba(${renk},${alfa})`;
  ctx.fillStyle = `rgba(${renk},${alfa})`;
  const yol = (...ads) => {
    ctx.beginPath();
    ads.forEach((a, i) => { const [x, y] = Y(D[a]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  };
  ctx.lineWidth = kal;
  yol("so", "sdir", "sel");
  yol("sa", "adir", "ael");
  yol("sk", "sdz", "sbil");
  yol("ak", "adz", "abil");
  // gövde: omuz genişliğinde yuvarlak uçlu tek kütle
  const om = { x: (D.so.x + D.sa.x) / 2, y: (D.so.y + D.sa.y) / 2 };
  const ka = { x: (D.sk.x + D.ak.x) / 2, y: (D.sk.y + D.ak.y) / 2 };
  const omG = Math.hypot(D.so.x - D.sa.x, D.so.y - D.sa.y);
  ctx.lineWidth = Math.max(kal * 1.6, omG * 0.78 * t * W);
  ctx.beginPath();
  const g1 = yansit(om.x, om.y - omG * 0.05, z), g2 = yansit(ka.x, ka.y + omG * 0.15, z);
  ctx.moveTo(g1[0], g1[1]); ctx.lineTo(g2[0], g2[1]); ctx.stroke();
  ctx.lineWidth = kal;
  // baş: piktogram geleneğindeki gibi gövdeden ayrık
  const tepe = om.y + omG * 0.42 + D.basR;
  const [bx, by] = yansit(D.burun.x, Math.max(tepe, D.burun.y + D.basR * 0.4), z);
  ctx.beginPath();
  ctx.arc(bx, by, D.basR * t * W, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- Çizim ----------
function sis(z, uzun) { return Math.exp(z / uzun); }

function cizgi(a, b, alfa) {
  ctx.strokeStyle = `rgba(200,222,252,${alfa})`;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}

function ciz(t) {
  const sn = t / 1000;
  const yy = h / 2;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#040a14";
  ctx.fillRect(0, 0, W, H);

  const D = S.D;
  const sisU = 1.6 + S.C * 7;

  // Kuyunun dibindeki ışık
  const [vx, vy, vt] = yansit(0, 0, -D);
  const isik = ctx.createRadialGradient(vx, vy, 0, vx, vy, Math.max(W, H) * (0.12 + S.C * 0.5));
  isik.addColorStop(0, `rgba(120,170,235,${0.05 + S.C * 0.22 * (1 - duz)})`);
  isik.addColorStop(1, "rgba(4,10,20,0)");
  ctx.fillStyle = isik; ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = "lighter";

  // Halkalar
  const aralik = 0.2;
  const n = Math.min(220, Math.ceil(D / aralik) + 1);
  for (let i = 0; i < n; i++) {
    let z = -(((i * aralik + S.akis) % D + D) % D);
    const alfa = sis(z, sisU) * sinirla(-z / 0.25) * 0.55;
    if (alfa < 0.01) continue;
    const a = yansit(-0.5, yy, z), b = yansit(0.5, yy, z), c = yansit(0.5, -yy, z), d = yansit(-0.5, -yy, z);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(200,222,252,${alfa})`;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.stroke();
  }

  // Boylamasına çizgiler
  const parca = 18;
  const duvar = [];
  for (let i = 0; i <= 8; i++) { const u = -0.5 + i / 8; duvar.push([u, yy], [u, -yy]); }
  for (let i = 1; i < 6; i++) { const v = -yy + (2 * yy * i) / 6; duvar.push([-0.5, v], [0.5, v]); }
  ctx.lineWidth = 1;
  for (const [x, y] of duvar) {
    let onceki = yansit(x, y, 0);
    for (let j = 1; j <= parca; j++) {
      const z = -D * Math.pow(j / parca, 1.6);
      const p = yansit(x, y, z);
      const alfa = sis(z, sisU) * 0.42;
      if (alfa > 0.01) cizgi(onceki, p, alfa);
      onceki = p;
    }
  }

  // Dip duvar (sığken görünür)
  const dipA = sis(-D, sisU) * 0.5;
  if (dipA > 0.02) {
    for (let i = 0; i <= 8; i++) { const u = -0.5 + i / 8; cizgi(yansit(u, yy, -D), yansit(u, -yy, -D), dipA); }
    for (let i = 0; i <= 6; i++) { const v = -yy + (2 * yy * i) / 6; cizgi(yansit(-0.5, v, -D), yansit(0.5, v, -D), dipA); }
  }

  // Buyruklar
  const kelimeA = sinirla((S.C - 0.08) * 2.2) * (1 - duz);
  if (kelimeA > 0.01) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const k of kelimeler) {
      const KD = Math.min(D, 6);
      const z = -(((k.z0 + S.akis * 0.85) % KD + KD) % KD);
      const a = sis(z, sisU) * sinirla(-z / 0.4) * kelimeA;
      if (a < 0.02) continue;
      const [x, y, tt] = yansit(k.x, k.y * yy, z);
      ctx.font = `italic 400 ${Math.max(4, 0.034 * tt * W)}px "Cormorant Garamond", Garamond, serif`;
      ctx.fillStyle = `rgba(200,222,252,${a * 0.9})`;
      ctx.fillText(k.m, x, y);
    }
  }

  // Bedenler: izleyicinin piktogram ikizi kuyunun içinde
  const zIkiz = -(0.45 + S.C * S.C * 1.8);
  if (S.evre !== "kirilma") {
    pozlar.forEach((p, i) => {
      const g = govde(p, i === 0 ? S.C : S.C * 0.5);
      const a = (i === 0 ? 0.92 : 0.5) * Math.max(0.25, sis(zIkiz, sisU * 1.6));
      piktogram(g, zIkiz - i * 0.15, a);
      // bakış hattı: ikizin başından kuyunun dibine
      if (g && i === 0 && S.C > 0.15) {
        const bp = yansit(g.burun.x, g.burun.y, zIkiz);
        ctx.lineWidth = 1;
        cizgi(bp, [vx, vy], (S.C - 0.15) * 0.5);
      }
    });
  }
  // Yassılan iz: kuyu çökünce beden yüzeyde kalır
  if (S.iz) {
    const g = (t - S.izZaman) / 1000;
    const a = S.evre === "kirilma" ? 0.85 : Math.max(0, 0.85 - (g - 12) / 18);
    if (a > 0.01) piktogram(S.iz, S.izZ, a, "232,240,255", S.izYansit);
    else if (S.evre !== "kirilma") S.iz = null;
  }
  ctx.globalCompositeOperation = "source-over";

  // Ekran çerçevesi (z=0) — duvarın kendisi
  ctx.strokeStyle = "rgba(200,222,252,0.14)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  yaziCiz(t, sn);
}

function sure(sn) {
  const s = Math.floor(sn);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function yaziCiz(t) {
  const fs = Math.max(10, Math.min(13, W * 0.0092));
  const kenar = Math.max(22, W * 0.03);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(200,222,252,0.75)";
  ctx.font = `500 ${fs}px "IBM Plex Mono", monospace`;
  ctx.textAlign = "left";
  ctx.fillText("KUYU", kenar, kenar + fs);
  ctx.font = `300 ${fs}px "IBM Plex Mono", monospace`;
  ctx.fillText("ŞEFFAF II · kafa takipli derinlik yanılsaması", kenar, kenar + fs * 2.5);
  const yakin = Math.max(0, Math.round((S.z0 - bas.z) * EKRAN_M * 100));
  if (S.evre === "bakiyor") {
    ctx.fillText(`bakış ${sure(S.sureBakis)} · yaklaşma ${yakin} cm · derinlik ${(S.D * EKRAN_M).toFixed(1).replace(".", ",")} m`, kenar, kenar + fs * 4);
  }
  ctx.textAlign = "right";
  ctx.fillText("kayıt: yok", W - kenar, kenar + fs);
  ctx.fillText("B.-C. Han, Şeffaflık Toplumu", W - kenar, kenar + fs * 2.5);

  const buyuk = Math.max(22, Math.min(50, W * 0.03));
  ctx.textAlign = "center";
  if (S.evre === "kirilma" && S.rapor) {
    const g = (t - S.kirilmaZaman) / 1000;
    const sol = (bas2, bit) => sinirla((g - bas2) / 0.9) * sinirla((bit - g) / 1.2);
    ctx.fillStyle = `rgba(232,240,255,${sol(1.3, 10.5)})`;
    ctx.font = `italic 400 ${buyuk * 1.6}px "Cormorant Garamond", Garamond, serif`;
    ctx.fillText("Derinlik yoktu.", W / 2, H * 0.2);
    ctx.fillStyle = `rgba(200,222,252,${sol(2.8, 10.5) * 0.85})`;
    ctx.font = `300 ${fs * 1.15}px "IBM Plex Mono", monospace`;
    const r = S.rapor;
    ctx.fillText(`${Math.round(r.sure)} saniye boyunca düz bir yüzeye baktın · ${r.cm} cm yaklaştın · ${r.derinlik.toFixed(1).replace(".", ",")} metrelik derinliğe inandın`, W / 2, H * 0.2 + buyuk * 1.4);
    ctx.fillStyle = `rgba(232,240,255,${sol(4.6, 10.5)})`;
    ctx.font = `italic 400 ${buyuk}px "Cormorant Garamond", Garamond, serif`;
    ctx.fillText("Kuyu, senin bakışındı.", W / 2, H - kenar - buyuk * 0.4);
    return;
  }
  let m;
  if (!calisiyor || S.evre === "bos") m = "Yaklaş.";
  else if (S.C < 0.12) m = "Bir derinlik açılıyor.";
  else if (S.C < 0.4) m = "Biraz daha yaklaş.";
  else if (S.C < 0.72) m = "Kımıldama. Bak.";
  else m = "Artık yalnızca bakıyorsun.";
  ctx.fillStyle = "rgba(200,222,252,0.82)";
  ctx.font = `italic 400 ${buyuk}px "Cormorant Garamond", Garamond, serif`;
  ctx.fillText(m, W / 2, H - kenar - buyuk * 0.4);
  if (S.kisiSayisi > 1) {
    ctx.font = `300 ${fs}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = "rgba(200,222,252,0.5)";
    ctx.fillText("bu derinlik tek bir bakış için hesaplanıyor — şu an en çok yaklaşana ait", W / 2, H - kenar + fs * 0.6);
  }
}

// ---------- Ses: kuyu uğultusu ----------
let ses = null;
function sesKur() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const ana = ac.createGain(); ana.gain.value = 0;
    const suzgec = ac.createBiquadFilter(); suzgec.type = "lowpass"; suzgec.frequency.value = 400;
    ana.connect(suzgec).connect(ac.destination);
    const osc = [55, 82.4, 110.3].map((f, i) => {
      const o = ac.createOscillator(); o.type = i === 2 ? "triangle" : "sine"; o.frequency.value = f;
      const g = ac.createGain(); g.gain.value = [0.6, 0.35, 0.12][i];
      o.connect(g).connect(ana); o.start();
      return o;
    });
    ses = { ac, ana, suzgec, osc };
  } catch (e) { console.warn("ses yok", e); }
}
function sesGuncelle() {
  if (!ses || S.evre === "kirilma") return;
  const n = ses.ac.currentTime;
  ses.ana.gain.setTargetAtTime(0.01 + S.C * 0.16, n, 0.5);
  ses.suzgec.frequency.setTargetAtTime(220 + S.C * 900, n, 0.8);
  ses.osc[0].frequency.setTargetAtTime(55 - S.C * 14, n, 1.2);
}
function sesKir() {
  if (!ses) return;
  const n = ses.ac.currentTime;
  ses.ana.gain.cancelScheduledValues(n);
  ses.ana.gain.setTargetAtTime(0, n, 0.03);
  const o = ses.ac.createOscillator(); o.type = "sine"; o.frequency.value = 659.3;
  const g = ses.ac.createGain(); g.gain.setValueAtTime(0.0001, n + 1.2);
  g.gain.exponentialRampToValueAtTime(0.07, n + 1.25);
  g.gain.exponentialRampToValueAtTime(0.0001, n + 5);
  o.connect(g).connect(ses.ac.destination); o.start(n + 1.2); o.stop(n + 5.1);
}

// ---------- Döngü ----------
let son = performance.now(), fps = 60;
function kare(t) {
  const dt = Math.min(0.1, (t - son) / 1000);
  son = t;
  fps = fps * 0.95 + (dt > 0 ? 1 / dt : 0) * 0.05;
  algila(t);
  guncelle(dt, t);
  ciz(t);
  if (panel.classList.contains("acik")) panelYaz();
  requestAnimationFrame(kare);
}
requestAnimationFrame(kare);

function panelYaz() {
  const f = birincil();
  let s = `fps ${fps.toFixed(0)} · ekran ${EKRAN_M} m · fov ${FOV}°\n`;
  s += `evre ${S.evre} · C=${S.C.toFixed(2)} · D=${S.D.toFixed(1)}\n`;
  s += `baş x=${bas.x.toFixed(2)} y=${bas.y.toFixed(2)} z=${bas.z.toFixed(2)} (${(bas.z * EKRAN_M).toFixed(2)} m)\n`;
  if (f) s += `yaw=${f.yaw.toFixed(2)} göz ${f.gozKapali ? "kapalı" : "açık"} · yüz ${yuzler.length} · poz ${pozlar.length}\n`;
  const yazi = panel.querySelector("pre") || panel.appendChild(document.createElement("pre"));
  yazi.style.margin = 0;
  yazi.textContent = s;
}

// ---------- Başlatma ----------
const basla = document.getElementById("basla");
if (DEMO) {
  basla.textContent = "Fareyle dene";
  document.getElementById("demo").outerHTML = '<span class="ince" style="font-size:.75rem;opacity:.7">imleç = baş · tekerlek = uzaklık · K basılı = başını çevir · boşluk = gözleri kapat</span>';
}
basla.addEventListener("click", async () => {
  basla.disabled = true;
  durum.classList.remove("hata");
  try {
    sesKur();
    if (!DEMO) {
      durum.textContent = "Kamera açılıyor…";
      await kameraAc(video);
      videoEn = video.videoWidth / video.videoHeight;
      durum.textContent = "Kuyu kazılıyor (ilk açılışta 10–20 sn sürebilir)…";
      [yuzModel, pozModel] = await Promise.all([yuzIzleyici(4), pozIzleyici(3)]);
    }
    calisiyor = true;
    ortu.classList.add("kapandi");
    document.body.classList.add("calisiyor");
  } catch (e) {
    console.error(e);
    basla.disabled = false;
    durum.classList.add("hata");
    if (e && e.name === "NotAllowedError") durum.textContent = "Kamera izni verilmedi. Adres çubuğundaki kamera simgesinden izin verip sayfayı yenileyin.";
    else if (e && e.name === "NotFoundError") durum.textContent = "Kamera bulunamadı. Bir web kamerası bağlayın.";
    else durum.textContent = "Başlatılamadı: " + (e && e.message ? e.message : e) + " — İnternet bağlantısını kontrol edin (modeller çevrim içi yüklenir).";
  }
});

window.addEventListener("keydown", (e) => {
  const t = e.key.toLowerCase();
  if (t === "k") tusK = true;
  if (e.code === "Space") { tusBosluk = true; e.preventDefault(); }
  if (t === "f") tamEkran();
  else if (t === "d") {
    panel.classList.toggle("acik");
    if (panel.classList.contains("acik") && video.srcObject && !panel.querySelector("video")) {
      const v = document.createElement("video");
      v.srcObject = video.srcObject; v.muted = true; v.autoplay = true; v.playsInline = true;
      panel.prepend(v);
    }
  } else if (t === "r") { S.evre = "bos"; S.C = 0; S.D = 1.2; duz = 0; S.iz = null; }
  else if (t === "enter" && !calisiyor) basla.click();
});
window.addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() === "k") tusK = false;
  if (e.code === "Space") tusBosluk = false;
});
