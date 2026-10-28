# ŞEFFAF

Byung-Chul Han'ın *Şeffaflık Toplumu*'ndan yola çıkan, web kamerasıyla çalışan iki etkileşimli enstalasyon.

- **I · Aşırı Pozlama** (`asiri-pozlama/`): görünür olma zorunluluğu. Canlı siyanotip: görünür kalan beden zemine karışarak silinir, yalnızca gizlenen iz bırakır.
- **II · Kuyu** (`kuyu/`): bakışın ve bedenin ele geçirilmesi. Kafa takipli derinlik yanılsaması: bakış sürdükçe kuyu derinleşir, bakışı çektiğin an derinliğin hiç olmadığı ortaya çıkar.

Kavram metinleri, mekân kurgusu, etkileşim senaryosu ve teknik iş akışı giriş sayfasındadır (`index.html`).

## GitHub Pages'te yayınlama

1. GitHub'da yeni bir **public** depo aç (örneğin `seffaf`).
2. Bu klasördeki her şeyi (`index.html`, `asiri-pozlama/`, `kuyu/`, `ortak/`, `.nojekyll`) deponun köküne yükle. Web arayüzünde **Add file → Upload files** ile klasörleri sürükleyip bırakabilirsin.
3. **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, Branch **main / (root)**, Save.
4. 1–2 dakika sonra adres hazır olur: `https://KULLANICIADI.github.io/seffaf/`

## Sunum günü

- Güncel Chrome kullan. Adresi https ile aç, aksi halde kamera çalışmaz. İnternet gerekir, çünkü modeller ilk açılışta çevrim içi yüklenir.
- **F** tam ekran · **D** ayar paneli (kamera görüntüsü ve değerler) · **R** sıfırla
- Aşırı Pozlama: `?hiz=1.5` pozlama hızı, `?iz=240` izlerin solma süresi (sn), klavyede `+ / −`
- Kuyu: `?ekran=2.4` görüntünün duvardaki genişliği (metre), `?fov=62` kamera görüş açısı, `?kamera=alt` (kamera ekranın altındaysa), `?hiz=1.3`
- Kamerasız yedek gösterim: `?demo=1`

## Gizlilik

Görüntü yalnızca tarayıcıda işlenir. Hiçbir kare kaydedilmez ya da gönderilmez.

## Teknik

Saf HTML/JS, derleme adımı yok. Google MediaPipe Tasks Vision 0.10.14 (Face Landmarker, Pose Landmarker, Image Segmenter) CDN'den yüklenir. Çizim Canvas 2D, ses Web Audio ile yapılır.
