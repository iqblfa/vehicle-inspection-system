// ============================================
// sw.js
// Service Worker untuk mendukung mode offline
// ============================================

const CACHE_NAME = "vins-cache-v1";

// Daftar file yang WAJIB tersedia offline (file inti untuk Form Pengecekan)
const FILES_TO_CACHE = [
    "/inspection.html",
    "/login.html",
    "/css/style.css",
    "/css/dashboard.css",
    "/css/inspection.css",
    "/css/responsive.css",
    "/js/config.js",
    "/js/auth.js",
    "/js/inspection.js",
    "/js/offline-db.js"
];

// ============================================
// EVENT: install (pertama kali Service Worker didaftarkan)
// ============================================

self.addEventListener("install", function (event) {
    console.log("[Service Worker] Menginstall...");

    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            console.log("[Service Worker] Menyimpan file ke cache");
            return cache.addAll(FILES_TO_CACHE);
        })
    );

    self.skipWaiting(); // langsung aktif tanpa perlu tutup-buka tab
});

// ============================================
// EVENT: activate (setelah install selesai, membersihkan cache versi lama)
// ============================================

self.addEventListener("activate", function (event) {
    console.log("[Service Worker] Mengaktifkan...");

    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.map(function (name) {
                    if (name !== CACHE_NAME) {
                        console.log("[Service Worker] Menghapus cache lama:", name);
                        return caches.delete(name);
                    }
                })
            );
        })
    );

    self.clients.claim(); // langsung kendalikan semua tab yang terbuka
});

// ============================================
// EVENT: fetch (setiap kali halaman meminta sebuah file)
// ============================================

self.addEventListener("fetch", function (event) {

    // Strategi: coba ambil dari internet dulu, kalau gagal baru pakai cache
    event.respondWith(
        fetch(event.request)
            .then(function (response) {
                // Berhasil dari internet: simpan salinan terbaru ke cache untuk jaga-jaga nanti
                return caches.open(CACHE_NAME).then(function (cache) {
                    // Hanya cache request GET yang sukses (bukan POST ke Supabase, dll)
                    if (event.request.method === "GET" && response.status === 200) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                });
            })
            .catch(function () {
                // Gagal dari internet (offline): coba ambil dari cache
                console.log("[Service Worker] Offline, mengambil dari cache:", event.request.url);
                return caches.match(event.request);
            })
    );
});