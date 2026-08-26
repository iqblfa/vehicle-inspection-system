// ============================================
// analytics.js
// Logika untuk halaman Laporan Analitik (khusus Admin)
// ============================================

// 1. AUTH GUARD — halaman ini KHUSUS admin
checkAuthGuard();
requireAdminGuard();

const btnMenu = document.querySelector("#btnMenu");
const sidebar = document.querySelector("#sidebar");
btnMenu.addEventListener("click", function () {
    sidebar.classList.toggle("open");
});

const btnLogout = document.querySelector("#btnLogout");
btnLogout.addEventListener("click", function () {
    logoutUser();
});

sesuaikanSidebarSesuaiRole();

// ============================================
// 2. WARNA STANDAR (dipakai berulang di beberapa grafik)
// ============================================

const WARNA = {
    biru: "#2563eb",
    hijau: "#16a34a",
    kuning: "#f59e0b",
    merah: "#dc2626",
    ungu: "#7c3aed",
    abu: "#94a3b8"
};

// ============================================
// 3. FUNGSI BANTU: NAMA BULAN INDONESIA
// ============================================

const NAMA_BULAN = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

// ============================================
// 4. MEMUAT & MENGOLAH SEMUA DATA ANALITIK
// ============================================

async function muatDataAnalitik() {

    const subtitleEl = document.querySelector("#analyticsSubtitle");

    // --- Mengambil semua data inspeksi (untuk grafik tren & distribusi hasil) ---
    const { data: semuaInspeksi, error: errorInspeksi } = await supabaseClient
        .from("inspections")
        .select("inspection_date, overall_result, vehicle_id, vehicles ( plate_number )")
        .order("inspection_date", { ascending: true });

    if (errorInspeksi) {
        subtitleEl.textContent = "Gagal memuat data. Silakan refresh halaman.";
        console.log("Gagal memuat data inspeksi:", errorInspeksi.message);
        return;
    }

    // --- Mengambil semua data laporan kerusakan (untuk grafik tingkat & kendaraan bermasalah) ---
    const { data: semuaLaporan, error: errorLaporan } = await supabaseClient
        .from("damage_reports")
        .select("severity, vehicle_id, vehicles ( plate_number )");

    if (errorLaporan) {
        subtitleEl.textContent = "Gagal memuat data. Silakan refresh halaman.";
        console.log("Gagal memuat data laporan:", errorLaporan.message);
        return;
    }

    subtitleEl.textContent = `Berdasarkan ${semuaInspeksi.length} data pengecekan dan ${semuaLaporan.length} laporan kerusakan.`;

    // Panggil 4 fungsi penggambar grafik, masing-masing mengolah datanya sendiri
    gambarTrenBulanan(semuaInspeksi);
    gambarDistribusiHasil(semuaInspeksi);
    gambarTingkatKerusakan(semuaLaporan);
    gambarKendaraanBermasalah(semuaLaporan);
}

// ============================================
// 5. GRAFIK 1: TREN PENGECEKAN PER BULAN (Line Chart)
// ============================================

function gambarTrenBulanan(semuaInspeksi) {

    // Mengelompokkan jumlah inspeksi per "tahun-bulan" (misal "2026-08")
    const jumlahPerBulan = {};

    semuaInspeksi.forEach(function (inspeksi) {
        const bagianTanggal = inspeksi.inspection_date.split("-"); // ["2026", "08", "15"]
        const kunciBulan = bagianTanggal[0] + "-" + bagianTanggal[1]; // "2026-08"

        if (!jumlahPerBulan[kunciBulan]) {
            jumlahPerBulan[kunciBulan] = 0;
        }
        jumlahPerBulan[kunciBulan] = jumlahPerBulan[kunciBulan] + 1;
    });

    // Mengubah objek jadi 2 array sejajar: label (untuk sumbu X) dan value (untuk data grafik)
    // Object.keys(...).sort() memastikan urutan bulan dari yang paling lama ke terbaru
    const kunciTerurut = Object.keys(jumlahPerBulan).sort();

    const label = kunciTerurut.map(function (kunci) {
        const bagian = kunci.split("-"); // ["2026", "08"]
        const indexBulan = parseInt(bagian[1]) - 1;
        return NAMA_BULAN[indexBulan] + " " + bagian[0];
    });

    const dataAngka = kunciTerurut.map(function (kunci) {
        return jumlahPerBulan[kunci];
    });

    new Chart(document.querySelector("#chartTrenBulanan"), {
        type: "line",
        data: {
            labels: label,
            datasets: [{
                label: "Jumlah Pengecekan",
                data: dataAngka,
                borderColor: WARNA.biru,
                backgroundColor: WARNA.biru + "20", // "20" di akhir kode warna = transparansi ringan
                tension: 0.3, // membuat garis sedikit melengkung, tidak kaku patah-patah
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

// ============================================
// 6. GRAFIK 2: DISTRIBUSI HASIL PENGECEKAN (Donut Chart)
// ============================================

function gambarDistribusiHasil(semuaInspeksi) {

    let jumlahLayak = 0;
    let jumlahPerhatian = 0;
    let jumlahTidakLayak = 0;

    semuaInspeksi.forEach(function (inspeksi) {
        if (inspeksi.overall_result === "LAYAK DIGUNAKAN") {
            jumlahLayak = jumlahLayak + 1;
        } else if (inspeksi.overall_result === "PERLU PERHATIAN") {
            jumlahPerhatian = jumlahPerhatian + 1;
        } else if (inspeksi.overall_result === "TIDAK LAYAK DIGUNAKAN") {
            jumlahTidakLayak = jumlahTidakLayak + 1;
        }
    });

    new Chart(document.querySelector("#chartDistribusiHasil"), {
        type: "doughnut",
        data: {
            labels: ["Layak Digunakan", "Perlu Perhatian", "Tidak Layak"],
            datasets: [{
                data: [jumlahLayak, jumlahPerhatian, jumlahTidakLayak],
                backgroundColor: [WARNA.hijau, WARNA.kuning, WARNA.merah]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom" }
            }
        }
    });
}

// ============================================
// 7. GRAFIK 3: DISTRIBUSI TINGKAT KERUSAKAN (Bar Chart)
// ============================================

function gambarTingkatKerusakan(semuaLaporan) {

    const jumlahPerTingkat = { "Minor": 0, "Moderate": 0, "Major": 0, "Critical": 0 };

    semuaLaporan.forEach(function (laporan) {
        if (jumlahPerTingkat.hasOwnProperty(laporan.severity)) {
            jumlahPerTingkat[laporan.severity] = jumlahPerTingkat[laporan.severity] + 1;
        }
    });

    new Chart(document.querySelector("#chartTingkatKerusakan"), {
        type: "bar",
        data: {
            labels: ["Minor", "Moderate", "Major", "Critical"],
            datasets: [{
                label: "Jumlah Laporan",
                data: [
                    jumlahPerTingkat["Minor"],
                    jumlahPerTingkat["Moderate"],
                    jumlahPerTingkat["Major"],
                    jumlahPerTingkat["Critical"]
                ],
                backgroundColor: [WARNA.abu, WARNA.kuning, "#ea580c", WARNA.merah]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

// ============================================
// 8. GRAFIK 4: 5 KENDARAAN PALING BERMASALAH (Horizontal Bar Chart)
// ============================================

function gambarKendaraanBermasalah(semuaLaporan) {

    // Mengelompokkan jumlah laporan per kendaraan (pakai nomor polisi sebagai kunci)
    const jumlahPerKendaraan = {};

    semuaLaporan.forEach(function (laporan) {
        const platNomor = laporan.vehicles ? laporan.vehicles.plate_number : "Tidak diketahui";

        if (!jumlahPerKendaraan[platNomor]) {
            jumlahPerKendaraan[platNomor] = 0;
        }
        jumlahPerKendaraan[platNomor] = jumlahPerKendaraan[platNomor] + 1;
    });

    // Mengubah jadi array [ [platNomor, jumlah], ... ] supaya bisa diurutkan
    const arrayKendaraan = Object.entries(jumlahPerKendaraan);

    // Urutkan dari jumlah TERBANYAK ke tersedikit
    arrayKendaraan.sort(function (a, b) {
        return b[1] - a[1]; // b[1] - a[1] = urutan menurun (descending)
    });

    // Ambil hanya 5 teratas
    const top5 = arrayKendaraan.slice(0, 5);

    const label = top5.map(function (item) { return item[0]; }); // nomor polisi
    const dataAngka = top5.map(function (item) { return item[1]; }); // jumlah laporan

    new Chart(document.querySelector("#chartKendaraanBermasalah"), {
        type: "bar",
        data: {
            labels: label,
            datasets: [{
                label: "Jumlah Laporan Kerusakan",
                data: dataAngka,
                backgroundColor: WARNA.merah
            }]
        },
        options: {
            indexAxis: "y", // membuat bar chart horizontal (lebih mudah dibaca untuk label nama panjang)
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

// Panggil saat halaman dimuat
muatDataAnalitik();

console.log("analytics.js berhasil dimuat");