// Leaflet dosyalarını www/lib içine kopyalar (uygulama internetsiz de açılsın diye).
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist');
const dst = path.join(__dirname, '..', 'www', 'lib', 'leaflet');

if (!fs.existsSync(src)) {
  console.log('leaflet bulunamadı, atlanıyor');
  process.exit(0);
}
fs.mkdirSync(dst, { recursive: true });
fs.cpSync(src, dst, { recursive: true });
console.log('leaflet -> www/lib/leaflet');
