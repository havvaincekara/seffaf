// ŞEFFAF · I — AŞIRI POZLAMA
// Görünür kalan beden zemine karışarak silinir; yalnızca gizlenen beden iz bırakır.
import {
  kameraAc, yuzIzleyici, siluetAyirici, yuzleriCoz, KisiTakip,
  kaplaHesapla, tamEkran, parametre, sinirla,
} from "../ortak/kamera.js";

// ---------- Ayarlar (URL ile değiştirilebilir: ?hiz=1.5&iz=240) ----------
let hiz = parametre("hiz", 1);          // pozlama hızı çarpanı
const SURE_GORUNUR = 24;                // saniye: kesintisiz görünürlükte tam şeffaflık
const SURE_GIZLI = 9;                   // saniye: gizlenince yoğunluğun geri gelmesi
const IZ_OMRU = parametre("iz", 180);   // saniye: izlerin solma süresi
const DEMO = parametre("demo", 0) == 1;

// ---------- Tuval ----------
const tuval = document.getElementById("sahne");
const ctx = tuval.getContext("2d");
const video = document.getElementById("video");
const ortu = document.getElementById("ortu");
const durum = document.getElementById("durum");
const panel = document.getElementById("panel");

let W = 0, H = 0, DPR = 1;
let alan = { x: 0, y: 0, w: 0, h: 0 };
let alanYolu = null;
let kagit = null;
let kumDeseni = null;

// Izgara (bedenin "baskı" çözünürlüğü — düşük çözünürlük fotogram yumuşaklığı verir)
const GW = 192;
let GH = 108;
let videoEn = 16 / 9;
let M, Mham, T;
let figur = document.createElement("canvas");
let fctx = figur.getContext("2d");
let figurVeri;

function izgaraKur(en) {
  videoEn = en;
  GH = Math.round(GW / en);
  M = new Float32Array(GW * GH);
  Mham = new Float32Array(GW * GH);
  T = new Float32Array(GW * GH);
  figur.width = GW; figur.height = GH;
  figurVeri = fctx.createImageData(GW, GH);
}
izgaraKur(16 / 9);

// ---------- Rastgelelik ----------
let tohum = 7;
const rnd = () => ((tohum = (tohum * 16807) % 2147483647) / 2147483647);

function boyutla() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  tuval.width = Math.round(W * DPR); tuval.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const yan = Math.max(28, W * 0.045);
  const ust = Math.max(58, H * 0.1);
  const alt = Math.max(84, H * 0.15);
  alan = { x: yan, y: ust, w: W - yan * 2, h: H - ust - alt };
  kagitCiz();
}

// Elle sürülmüş siyanotip emülsiyonunun düzensiz kenarı
function pirtikliYol(r) {
  const p = new Path2D();
  const faz = Array.from({ length: 6 }, () => rnd() * 10);
  const g = (s, k) => Math.sin(s * 0.013 + faz[k]) * 5 + Math.sin(s * 0.051 + faz[k + 1]) * 2.5 + (rnd() - 0.5) * 2.2;
  const adim = 5;
  p.moveTo(r.x, r.y);
  for (let s = 0; s <= r.w; s += adim) p.lineTo(r.x + s, r.y + g(s, 0));
  for (let s = 0; s <= r.h; s += adim) p.lineTo(r.x + r.w + g(s, 1), r.y + s);
  for (let s = r.w; s >= 0; s -= adim) p.lineTo(r.x + s, r.y + r.h + g(s, 2));
  for (let s = r.h; s >= 0; s -= adim) p.lineTo(r.x + g(s, 3), r.y + s);
  p.closePath();
  return p;
}

function kagitCiz() {
  tohum = 7;
  kagit = document.createElement("canvas");
  kagit.width = tuval.width; kagit.height = tuval.height;
  const k = kagit.getContext("2d");
  k.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Kâğıt
  k.fillStyle = "#efe9dc"; k.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    k.fillStyle = rnd() < 0.5 ? "rgba(120,100,70,0.05)" : "rgba(255,255,255,0.25)";
    k.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 0.6);
  }

  // Emülsiyon alanı
  alanYolu = pirtikliYol(alan);
  k.save();
  k.fillStyle = "#163f70";
  k.fill(alanYolu);
  k.clip(alanYolu);
  // Leke ve hareler
  for (let i = 0; i < 900; i++) {
    const x = alan.x + rnd() * alan.w, y = alan.y + rnd() * alan.h, r = 20 + rnd() * 140;
    const gr = k.createRadialGradient(x, y, 0, x, y, r);
    const koyu = rnd() < 0.6;
    gr.addColorStop(0, koyu ? `rgba(8,30,62,${0.05 + rnd() * 0.08})` : `rgba(48,98,156,${0.04 + rnd() * 0.07})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    k.fillStyle = gr; k.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Yatay fırça izleri
  for (let i = 0; i < 46; i++) {
    const y = alan.y + rnd() * alan.h;
    const x0 = alan.x - 20 + rnd() * alan.w * 0.5;
    k.fillStyle = rnd() < 0.5 ? `rgba(6,24,52,${0.03 + rnd() * 0.05})` : `rgba(70,120,180,${0.02 + rnd() * 0.04})`;
    k.fillRect(x0, y, alan.w * (0.4 + rnd() * 0.8), 2 + rnd() * 14);
  }
  // Benekler
  for (let i = 0; i < 3500; i++) {
    k.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,10,30,0.12)";
    k.fillRect(alan.x + rnd() * alan.w, alan.y + rnd() * alan.h, 1, 1);
  }
  k.restore();
  // Kenar koyulaşması
  k.save();
  k.filter = "blur(3px)";
  k.strokeStyle = "rgba(6,24,50,0.45)";
  k.lineWidth = 6;
  k.stroke(alanYolu);
  k.restore();

  // Kum deseni
  const kum = document.createElement("canvas");
  kum.width = kum.height = 192;
  const kc = kum.getContext("2d");
  const id = kc.createImageData(192, 192);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
  }
  kc.putImageData(id, 0, 0);
  kumDeseni = ctx.createPattern(kum, "repeat");
}

window.addEventListener("resize", boyutla);
boyutla();

// ---------- Algılama ----------
let yuzModel = null, siluetModel = null;
let calisiyor = false;
let sonVideoZaman = -1;
let yuzler = [];
const takip = new KisiTakip(3);
let baslangic = 0;
let fps = 0;
let tersMaske = false, oy = 0;

function algila(t) {
  if (DEMO) { demoAlgila(t); return; }
  if (!calisiyor || video.readyState < 2) return;
  if (video.currentTime === sonVideoZaman) return;
  sonVideoZaman = video.currentTime;
  try {
    siluetModel.segmentForVideo(video, t, (sonuc) => {
      const maskeler = sonuc.confidenceMasks;
      if (!maskeler || !maskeler.length) return;
      const m = maskeler[maskeler.length - 1];
      const mw = m.width, mh = m.height;
      const d = m.getAsFloat32Array();
      for (let gy = 0; gy < GH; gy++) {
        const sy = Math.min(mh - 1, Math.floor(((gy + 0.5) / GH) * mh));
        for (let gx = 0; gx < GW; gx++) {
          const sx = Math.min(mw - 1, Math.floor((1 - (gx + 0.5) / GW) * mw)); // aynala
          Mham[gy * GW + gx] = d[sy * mw + sx];
        }
      }
    });
    const ys = yuzModel.detectForVideo(video, t);
    yuzler = yuzleriCoz(ys, videoEn);
    // Güvenlik: model maskeyi ters (arka plan olasılığı) veriyorsa yüz merkezinden anlayıp çevir
    if (yuzler.length) {
      const f = yuzler[0];
      const gi = Math.min(GH - 1, Math.floor(f.y * GH)) * GW + Math.min(GW - 1, Math.floor(f.x * GW));
      oy = sinirla(oy + (Mham[gi] < 0.3 ? 1 : -1), -30, 30);
      if (oy > 20) tersMaske = true; else if (oy < -20) tersMaske = false;
    }
    if (tersMaske) for (let i = 0; i < Mham.length; i++) Mham[i] = 1 - Mham[i];
  } catch (e) {
    console.warn(e);
  }
}

// Fareyle deneme: imleç bir beden; Shift ya da fare basılıyken = gözler kapalı (gizlenme)
const fare = { x: 0.5, y: 0.45, var: false, gizli: false, ikinci: false };
window.addEventListener("pointermove", (e) => {
  const k = kaplaHesapla(GW / GH, alan.x, alan.y, alan.w, alan.h);
  fare.x = (e.clientX - k.ox) / k.g; fare.y = (e.clientY - k.oy) / k.y; fare.var = true;
});
window.addEventListener("pointerdown", () => (fare.gizli = true));
window.addEventListener("pointerup", () => (fare.gizli = false));

function demoBeden(cx, cy, w) {
  const en = videoEn;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = gx / GW, y = gy / GH;
    const bas = ((x - cx) / (w * 0.55)) ** 2 + ((y - cy) / (w * en * 0.72)) ** 2 < 1;
    const boyun = Math.abs(x - cx) < w * 0.22 && y > cy && y < cy + w * en * 0.95;
    const govdeY = cy + w * en * 0.8;
    const govde = y > govdeY && Math.abs(x - cx) < w * (1.25 + (y - govdeY) * 1.2);
    if (bas || boyun || govde) Mham[gy * GW + gx] = 1;
  }
}

function demoAlgila(t) {
  if (!calisiyor) return;
  Mham.fill(0);
  yuzler = [];
  if (fare.var) {
    const w = 0.11;
    demoBeden(fare.x, fare.y, w);
    if (!(fare.gizli && klavyeShift)) {
      yuzler.push({ x: fare.x, y: fare.y, w, yaw: 0, pitch: 0, gozKapali: fare.gizli || klavyeShift });
    }
  }
  if (fare.ikinci) {
    const x2 = 0.2 + Math.sin(t / 4000) * 0.03;
    demoBeden(x2, 0.5, 0.1);
    yuzler.push({ x: x2, y: 0.5, w: 0.1, yaw: 0.05, pitch: 0, gozKapali: false });
  }
}

// ---------- Güncelleme ----------
let durumMetni = "Görünmek için öne çık.";
let hedefMetin = durumMetni;
let metinGecis = 1;
let ozet = { kisi: 0, gorunur: 0, gizli: 0, seffaf: 0, ortE: 0 };
let izVar = false;

function guncelle(dt, t) {
  const sn = t / 1000;
  for (let i = 0; i < M.length; i++) M[i] = M[i] * 0.45 + Mham[i] * 0.55;

  const kisiler = takip.guncelle(yuzler, sn, () => ({ E: 0, gizli: false, sure: 0 }));
  void kisiler;
  let gorunur = 0, gizli = 0, seffaf = 0, toplamE = 0;
  for (const k of takip.kisiler) {
    if (k.gorunur) {
      k.gizli = k.gozKapali || Math.abs(k.yaw) > 0.65;
    } else {
      k.gizli = true; // yüz kayboldu: elle kapatıldı, arkasını döndü
    }
    if (!k.gizli) {
      const cephe = Math.abs(k.yaw) < 0.35 && Math.abs(k.pitch) < 0.7 ? 1 : 0.55;
      const devinim = sinirla(Math.hypot(k.vx || 0, k.vy || 0) / Math.max(0.03, k.w) / Math.max(dt, 0.016) / 4);
      k.E = sinirla(k.E + (dt / SURE_GORUNUR) * hiz * cephe * (1 + 1.5 * devinim));
      gorunur++; toplamE += k.E;
      if (k.E > 0.97) seffaf++;
    } else {
      k.E = sinirla(k.E - dt / SURE_GIZLI);
      if (k.gorunur) gizli++;
    }
    k.sure = (k.sure || 0) + dt;
  }

  // Piksel düzeyinde baskı
  const sonum = Math.exp(-dt / IZ_OMRU);
  const sabitle = Math.min(1, dt * 1.2);
  const kisi = takip.kisiler;
  const d = figurVeri.data;
  const en = videoEn;
  let izToplam = 0;
  let sahipsizBeden = 0;
  for (let gy = 0; gy < GH; gy++) {
    const ny = gy / GH;
    for (let gx = 0; gx < GW; gx++) {
      const i = gy * GW + gx;
      const nx = gx / GW;
      const m = M[i];
      let canli = 0, hedef = 0;
      if (m > 0.08) {
        let enIyi = null, enIyiD = 2.1;
        for (let j = 0; j < kisi.length; j++) {
          const k = kisi[j];
          if (ny < k.y - k.w * en * 0.95) continue;
          const dx = Math.abs(nx - k.x) / k.w;
          if (dx < enIyiD) { enIyiD = dx; enIyi = k; }
        }
        if (enIyi) {
          let taban = 1 - enIyi.E;
          const ex = (nx - enIyi.x) / (enIyi.w * 0.6), ey = (ny - enIyi.y) / (enIyi.w * en * 0.78);
          if (ex * ex + ey * ey < 1) taban *= taban; // yüz önce çözülür
          canli = m * Math.pow(taban, 1.3);
          if (enIyi.gizli) hedef = m * (1 - enIyi.E);
        } else {
          canli = m; hedef = m; // yüzü olmayan beden: arkasını dönmüş ya da yüzünü kapatmış
          sahipsizBeden++;
        }
      }
      let iz = T[i] * sonum;
      if (hedef > iz) iz += (hedef - iz) * sabitle;
      T[i] = iz;
      izToplam += iz;

      // Renk: canlı beden = pozlanmamış kâğıt; iz = sabitlenmiş, hafif mavimsi beyaz
      const ac = canli, ai = iz * 0.86;
      const a = ac + ai * (1 - ac);
      const o = 4 * i;
      if (a < 0.003) { d[o + 3] = 0; continue; }
      const r = (239 * ac + 206 * ai * (1 - ac)) / a;
      const g = (233 * ac + 222 * ai * (1 - ac)) / a;
      const b = (220 * ac + 236 * ai * (1 - ac)) / a;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a * 255;
    }
  }
  fctx.putImageData(figurVeri, 0, 0);
  izVar = izToplam > GW * GH * 0.004;
  if (sahipsizBeden > GW * GH * 0.02) gizli = Math.max(gizli, 1);

  ozet = { kisi: gorunur + gizli, gorunur, gizli, seffaf, ortE: gorunur ? toplamE / gorunur : 0 };

  // Durum cümlesi
  let m;
  if (!calisiyor) m = "Görünmek için öne çık.";
  else if (ozet.kisi === 0) m = izVar ? "Geriye yalnızca gizlenenler kaldı." : "Görünmek için öne çık.";
  else if (gorunur && seffaf === gorunur && !gizli) m = "Tamamen görünürsün. Artık burada değilsin.";
  else if (gizli && !gorunur) m = "Gizlendiğin yerde iz kalıyor.";
  else if (ozet.ortE > 0.7) m = "Neredeyse tamamen görünürsün.";
  else if (ozet.ortE > 0.35) m = "Görünürlüğün artıyor. Bakmaya devam et.";
  else if (gizli) m = "Biri gizleniyor. Yalnızca o iz bırakacak.";
  else m = "Seni görüyoruz. Daha çok görün.";
  if (m !== hedefMetin) { hedefMetin = m; metinGecis = 0; }
  metinGecis = Math.min(1, metinGecis + dt * 0.8);
  if (metinGecis > 0.5) durumMetni = hedefMetin;

  sesGuncelle(dt);
}

// ---------- Çizim ----------
function sure(sn) {
  const s = Math.floor(sn);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, "0")).join(":");
}

function ciz(t) {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(kagit, 0, 0, W, H);

  const k = kaplaHesapla(GW / GH, alan.x, alan.y, alan.w, alan.h);
  ctx.save();
  ctx.clip(alanYolu);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = `blur(${Math.max(1, (k.g / GW) * 0.8).toFixed(1)}px)`;
  ctx.drawImage(figur, k.ox, k.oy, k.g, k.y);
  ctx.filter = "none";
  // emülsiyon dokusunu baskının üstüne geri ver
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = kumDeseni;
  ctx.fillRect(alan.x, alan.y, alan.w, alan.h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  // Yüz işaretleri: baskı kenar işaretleri gibi
  ctx.font = `400 ${Math.max(10, W * 0.0085)}px "IBM Plex Mono", monospace`;
  ctx.textBaseline = "alphabetic";
  for (const p of takip.kisiler) {
    const [x, y] = k.nokta(p.x, p.y);
    const r = p.w * k.g * 0.75;
    const aci = p.gorunur ? 1 : 0.35;
    ctx.strokeStyle = `rgba(239,233,220,${0.55 * aci})`;
    ctx.lineWidth = 1;
    const c = r * 0.28;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const ax = x + sx * r, ay = y + sy * r * 1.25;
      ctx.moveTo(ax, ay); ctx.lineTo(ax - sx * c, ay);
      ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - sy * c);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(239,233,220,${0.85 * aci})`;
    let etiket;
    if (p.gizli) etiket = p.gorunur ? "gizli · iz bırakıyor" : "yüz yok · iz bırakıyor";
    else if (p.E > 0.97) etiket = "şeffaf";
    else etiket = `görünürlük %${Math.round(p.E * 100)}`;
    ctx.fillText(etiket, x + r + 6, y - r * 1.25 + 10);
  }
  ctx.restore();

  // Kenar notları (kâğıt üzerine mürekkep)
  const ink = "#0b2546";
  ctx.fillStyle = ink;
  const fs = Math.max(10, Math.min(13, W * 0.0095));
  ctx.font = `500 ${fs}px "IBM Plex Mono", monospace`;
  ctx.textAlign = "left";
  const ustY = alan.y - Math.max(18, H * 0.03);
  ctx.fillText("AŞIRI POZLAMA", alan.x, ustY - fs * 1.4);
  ctx.font = `300 ${fs}px "IBM Plex Mono", monospace`;
  ctx.fillText("canlı siyanotip · ŞEFFAF I · “Teşhir Toplumu” üzerine", alan.x, ustY);
  ctx.textAlign = "right";
  const gecen = calisiyor ? (t - baslangic) / 1000 : 0;
  ctx.fillText(`pozlama süresi ${sure(gecen)}`, alan.x + alan.w, ustY - fs * 1.4);
  ctx.fillText("kayıt: yok · görüntü bu odadan çıkmaz", alan.x + alan.w, ustY);

  // Durum cümlesi
  const altOrta = alan.y + alan.h + (H - alan.y - alan.h) * 0.48;
  const buyuk = Math.max(20, Math.min(44, W * 0.026));
  ctx.textAlign = "center";
  ctx.font = `italic 400 ${buyuk}px "Cormorant Garamond", Garamond, serif`;
  ctx.globalAlpha = Math.abs(metinGecis - 0.5) * 2;
  ctx.fillText(durumMetni, W / 2, altOrta);
  ctx.globalAlpha = 1;

  ctx.font = `300 ${fs * 0.92}px "IBM Plex Mono", monospace`;
  ctx.textAlign = "left";
  const altY = H - Math.max(16, H * 0.025);
  ctx.fillText(`kişi ${ozet.kisi} · görünür ${ozet.gorunur} · gizli ${ozet.gizli} · şeffaf ${ozet.seffaf}`, alan.x, altY);
  ctx.textAlign = "right";
  ctx.fillText("B.-C. Han, Şeffaflık Toplumu — “Teşhir Toplumu”", alan.x + alan.w, altY);
  ctx.textAlign = "left";
}

// ---------- Ses: pozlama hışırtısı ----------
let ses = null;
function sesKur() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const tampon = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const v = tampon.getChannelData(0);
    for (let i = 0; i < v.length; i++) v[i] = Math.random() * 2 - 1;
    const kaynak = ac.createBufferSource(); kaynak.buffer = tampon; kaynak.loop = true;
    const bant = ac.createBiquadFilter(); bant.type = "bandpass"; bant.frequency.value = 2400; bant.Q.value = 0.6;
    const kazanc = ac.createGain(); kazanc.gain.value = 0;
    kaynak.connect(bant).connect(kazanc).connect(ac.destination);
    kaynak.start();
    ses = { ac, kazanc, bant };
  } catch (e) { console.warn("ses yok", e); }
}
function sesGuncelle() {
  if (!ses) return;
  const hedef = ozet.kisi ? 0.012 + ozet.ortE * 0.08 : 0.004;
  ses.kazanc.gain.setTargetAtTime(hedef, ses.ac.currentTime, 0.4);
  ses.bant.frequency.setTargetAtTime(1800 + ozet.ortE * 3200, ses.ac.currentTime, 0.6);
}

// ---------- Döngü ----------
let son = performance.now();
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
  let s = `fps ${fps.toFixed(0)} · hız ×${hiz.toFixed(2)} · iz ömrü ${IZ_OMRU}s\n`;
  for (const k of takip.kisiler) {
    s += `#${k.id} E=${k.E.toFixed(2)} yaw=${k.yaw.toFixed(2)} ${k.gizli ? "GİZLİ" : ""} ${k.gorunur ? "" : "(kayıp)"}\n`;
  }
  const yazi = panel.querySelector("pre") || panel.appendChild(document.createElement("pre"));
  yazi.style.margin = 0;
  yazi.textContent = s;
}

// ---------- Başlatma ----------
const basla = document.getElementById("basla");
if (DEMO) {
  basla.textContent = "Fareyle dene";
  document.getElementById("demo").outerHTML = '<span class="ince" style="font-size:.75rem;opacity:.7">imleç = beden · basılı tut = gözleri kapat · 2 = ikinci kişi</span>';
}

basla.addEventListener("click", async () => {
  basla.disabled = true;
  durum.classList.remove("hata");
  try {
    sesKur();
    if (!DEMO) {
      durum.textContent = "Kamera açılıyor…";
      await kameraAc(video);
      izgaraKur(video.videoWidth / video.videoHeight);
      durum.textContent = "Işığa duyarlı yüzey hazırlanıyor (ilk açılışta 10–20 sn sürebilir)…";
      [yuzModel, siluetModel] = await Promise.all([yuzIzleyici(4), siluetAyirici()]);
    }
    calisiyor = true;
    baslangic = performance.now();
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

// ---------- Klavye ----------
let klavyeShift = false;
window.addEventListener("keydown", (e) => {
  if (e.key === "Shift") klavyeShift = true;
  const t = e.key.toLowerCase();
  if (t === "f") tamEkran();
  else if (t === "d") {
    panel.classList.toggle("acik");
    if (panel.classList.contains("acik") && video.srcObject && !panel.querySelector("video")) {
      const v = document.createElement("video");
      v.srcObject = video.srcObject; v.muted = true; v.autoplay = true; v.playsInline = true;
      panel.prepend(v);
    }
  } else if (t === "r") {
    T.fill(0);
    takip.kisiler.forEach((k) => (k.E = 0));
    baslangic = performance.now();
  } else if (t === "+" || t === "=") hiz = Math.min(5, hiz * 1.25);
  else if (t === "-") hiz = Math.max(0.2, hiz / 1.25);
  else if (t === "2" && DEMO) fare.ikinci = !fare.ikinci;
  else if (t === "enter" && !calisiyor) basla.click();
});
window.addEventListener("keyup", (e) => { if (e.key === "Shift") klavyeShift = false; });
