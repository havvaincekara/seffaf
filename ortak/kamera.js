// ŞEFFAF — ortak kamera ve algılama modülü
// Görüntü yalnızca bu tarayıcıda işlenir; hiçbir kare kaydedilmez ya da gönderilmez.

export const MP_SURUM = "0.10.14";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_SURUM}`;

export const MODELLER = {
  yuz: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  poz: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  siluet: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
};

let _lib = null;
let _vision = null;

async function kutuphane() {
  if (!_lib) _lib = await import(`${CDN}/vision_bundle.mjs`);
  if (!_vision) _vision = await _lib.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  return { lib: _lib, vision: _vision };
}

async function olustur(Sinif, vision, secenek) {
  try {
    return await Sinif.createFromOptions(vision, {
      ...secenek,
      baseOptions: { ...secenek.baseOptions, delegate: "GPU" },
    });
  } catch (e) {
    console.warn("GPU başlatılamadı, CPU deneniyor:", e);
    return await Sinif.createFromOptions(vision, {
      ...secenek,
      baseOptions: { ...secenek.baseOptions, delegate: "CPU" },
    });
  }
}

export async function yuzIzleyici(sayi = 4) {
  const { lib, vision } = await kutuphane();
  return olustur(lib.FaceLandmarker, vision, {
    baseOptions: { modelAssetPath: MODELLER.yuz },
    runningMode: "VIDEO",
    numFaces: sayi,
    outputFaceBlendshapes: true,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export async function pozIzleyici(sayi = 4) {
  const { lib, vision } = await kutuphane();
  return olustur(lib.PoseLandmarker, vision, {
    baseOptions: { modelAssetPath: MODELLER.poz },
    runningMode: "VIDEO",
    numPoses: sayi,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export async function siluetAyirici() {
  const { lib, vision } = await kutuphane();
  return olustur(lib.ImageSegmenter, vision, {
    baseOptions: { modelAssetPath: MODELLER.siluet },
    runningMode: "VIDEO",
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
}

export async function kameraAc(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Bu tarayıcı kamera erişimine izin vermiyor. Sayfayı https:// adresinden ve güncel Chrome ile açın.");
  }
  const akis = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = akis;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  if (!video.videoWidth) await new Promise((r) => (video.onloadedmetadata = r));
  return akis;
}

// Yüz sonuçlarını sade bir yapıya çevirir. x değerleri AYNALANMIŞTIR (izleyici sağa giderse x büyür).
// en: video genişlik/yükseklik oranı
export function yuzleriCoz(sonuc, en = 16 / 9) {
  const cikti = [];
  if (!sonuc || !sonuc.faceLandmarks) return cikti;
  sonuc.faceLandmarks.forEach((lm, i) => {
    const L = lm[234], R = lm[454], N = lm[1], T = lm[10], B = lm[152];
    const minx = Math.min(L.x, R.x), maxx = Math.max(L.x, R.x);
    const gen = maxx - minx;
    const yuk = (B.y - T.y) / en; // x birimine çevrilmiş yükseklik
    const w = Math.max(gen, yuk * 0.85);
    const oran = (N.x - minx) / Math.max(1e-4, gen);
    const yaw = -(oran - 0.5) * 2; // aynalı: + izleyicinin sağı
    const dikey = (N.y - T.y) / Math.max(1e-4, B.y - T.y);
    const pitch = (dikey - 0.55) * 2.5; // + aşağı
    let kl = 0, kr = 0;
    const bs = sonuc.faceBlendshapes && sonuc.faceBlendshapes[i] && sonuc.faceBlendshapes[i].categories;
    if (bs) {
      for (const c of bs) {
        if (c.categoryName === "eyeBlinkLeft") kl = c.score;
        else if (c.categoryName === "eyeBlinkRight") kr = c.score;
      }
    }
    cikti.push({
      x: 1 - (minx + maxx) / 2,
      y: (T.y + B.y) / 2,
      w,
      yaw,
      pitch,
      gozKapali: kl > 0.55 && kr > 0.55,
    });
  });
  return cikti;
}

// Basit kimlik eşleştirme: kareler arasında aynı kişiyi takip eder.
export class KisiTakip {
  constructor(hafiza = 3) {
    this.kisiler = [];
    this.sonId = 0;
    this.hafiza = hafiza; // saniye
  }
  guncelle(yuzler, zaman, yeniKisi = () => ({})) {
    const bos = new Set(this.kisiler.map((_, i) => i));
    const eslesen = [];
    for (const y of yuzler) {
      let enIyi = -1, enIyiD = Infinity;
      for (const i of bos) {
        const k = this.kisiler[i];
        const d = Math.hypot(k.x - y.x, k.y - y.y) / Math.max(0.04, k.w);
        if (d < enIyiD) { enIyiD = d; enIyi = i; }
      }
      if (enIyi >= 0 && enIyiD < 2.5) {
        const k = this.kisiler[enIyi];
        bos.delete(enIyi);
        k.vx = (y.x - k.x); k.vy = (y.y - k.y);
        Object.assign(k, y, { gorulme: zaman, gorunur: true });
        eslesen.push(k);
      } else {
        const k = Object.assign({ id: ++this.sonId, vx: 0, vy: 0, dogum: zaman }, yeniKisi(), y, { gorulme: zaman, gorunur: true });
        this.kisiler.push(k);
        eslesen.push(k);
      }
    }
    for (const i of bos) this.kisiler[i].gorunur = false;
    this.kisiler = this.kisiler.filter((k) => zaman - k.gorulme < this.hafiza);
    return eslesen;
  }
}

// Ekranı kaplayacak şekilde (cover) normalize koordinatı piksele çevirir
export function kaplaHesapla(kaynakEn, hedefX, hedefY, hedefG, hedefY2) {
  const hedefEn = hedefG / hedefY2;
  let g, y;
  if (kaynakEn > hedefEn) { y = hedefY2; g = y * kaynakEn; } else { g = hedefG; y = g / kaynakEn; }
  const ox = hedefX + (hedefG - g) / 2, oy = hedefY + (hedefY2 - y) / 2;
  return { ox, oy, g, y, nokta: (nx, ny) => [ox + nx * g, oy + ny * y] };
}

export function tamEkran() {
  const d = document.documentElement;
  if (!document.fullscreenElement) d.requestFullscreen && d.requestFullscreen().catch(() => {});
  else document.exitFullscreen && document.exitFullscreen();
}

export function parametre(ad, varsayilan) {
  const p = new URLSearchParams(location.search).get(ad);
  if (p === null) return varsayilan;
  const n = parseFloat(p);
  return isNaN(n) ? p : n;
}

export const sinirla = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const yumusat = (a, b, k) => a + (b - a) * k;
