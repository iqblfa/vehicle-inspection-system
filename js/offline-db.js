// ============================================
// offline-db.js
// Helper untuk menyimpan & mengambil data inspeksi
// yang tertunda (belum sempat terkirim ke Supabase)
// menggunakan IndexedDB.
// ============================================

const DB_NAME = "vins-offline-db";
const DB_VERSION = 1;
const STORE_NAME = "pending-inspections";

// ============================================
// FUNGSI: MEMBUKA (atau membuat) DATABASE
// ============================================

function bukaOfflineDB() {
    return new Promise(function (resolve, reject) {

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Dipanggil HANYA saat database dibuat pertama kali, atau versi dinaikkan
        request.onupgradeneeded = function (event) {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // Membuat "tabel" (disebut object store) untuk menyimpan data tertunda
                db.createObjectStore(STORE_NAME, { keyPath: "localId", autoIncrement: true });
            }
        };

        request.onsuccess = function (event) {
            resolve(event.target.result);
        };

        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

// ============================================
// FUNGSI: MENYIMPAN DATA INSPEKSI KE INDEXEDDB
// ============================================

async function simpanInspeksiOffline(dataInspeksi) {

    const db = await bukaOfflineDB();

    return new Promise(function (resolve, reject) {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        const request = store.add(dataInspeksi);

        request.onsuccess = function () {
            resolve(request.result); // mengembalikan localId yang baru dibuat
        };

        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

// ============================================
// FUNGSI: MENGAMBIL SEMUA DATA YANG MASIH TERTUNDA
// ============================================

async function ambilSemuaInspeksiOffline() {

    const db = await bukaOfflineDB();

    return new Promise(function (resolve, reject) {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = function () {
            resolve(request.result);
        };

        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

// ============================================
// FUNGSI: MENGHAPUS 1 DATA TERTUNDA (setelah berhasil disinkronkan)
// ============================================

async function hapusInspeksiOffline(localId) {

    const db = await bukaOfflineDB();

    return new Promise(function (resolve, reject) {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(localId);

        request.onsuccess = function () {
            resolve();
        };

        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

// ============================================
// FUNGSI: MENGHITUNG BERAPA BANYAK DATA YANG MASIH TERTUNDA
// ============================================

async function hitungInspeksiTertunda() {
    const semuaData = await ambilSemuaInspeksiOffline();
    return semuaData.length;
}

console.log("offline-db.js berhasil dimuat");