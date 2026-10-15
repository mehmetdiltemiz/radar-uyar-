// Leaflet ve Capacitor çekirdeğini www/lib içine kopyalar (uygulama internetsiz de açılsın diye).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const lib = path.join(root, 'www', 'lib');

const leaflet = path.join(root, 'node_modules', 'leaflet', 'dist');
fs.mkdirSync(path.join(lib, 'leaflet'), { recursive: true });
fs.cpSync(leaflet, path.join(lib, 'leaflet'), { recursive: true });
console.log('leaflet -> www/lib/leaflet');

// Harita döndürme (gidiş yönü yukarı)
fs.copyFileSync(path.join(root, 'node_modules', 'leaflet-rotate', 'dist', 'leaflet-rotate.js'), path.join(lib, 'leaflet-rotate.js'));
console.log('leaflet-rotate.js -> www/lib/leaflet-rotate.js');

// iPhone'daki köprü registerPlugin sağlamıyor; eklentilere erişmek için çekirdek JS gerekli.
fs.copyFileSync(path.join(root, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js'), path.join(lib, 'capacitor.js'));
console.log('capacitor.js -> www/lib/capacitor.js');
