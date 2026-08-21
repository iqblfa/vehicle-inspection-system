// ============================================
// dashboard.js
// Logika untuk halaman Dashboard
// ============================================

// 1. AUTH GUARD, HAMBURGER MENU, LOGOUT (tetap sama)
checkAuthGuard();

sesuaikanSidebarSesuaiRole().then(function (profile) {
    if (profile && profile.role !== "admin") {
        // Sembunyikan statistik yang kurang relevan untuk driver
        document.querySelector("#statLaporanKerusakan").closest(".stat-card").style.display = "none";
    }
});

const btnMenu = document.querySelector("#btnMenu");
const sidebar = document.querySelector("#sidebar");
btnMenu.addEventListener("click", function () {
    sidebar.classList.toggle("open");
});

const btnLogout = document.querySelector("#btnLogout");
btnLogout.addEventListener("click", function () {
    logoutUser();
});

// ============================================
// 2. FUNGSI: MENGHITUNG TANGGAL AWAL HARI INI & BULAN INI
//    (dibutuhkan untuk memfilter data "hari ini" dan "bulan ini")
// ============================================

function getTanggalHariIni() {
    const sekarang = new Date();
    const tahun = sekarang.getFullYear();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
    const tanggal = String(sekarang.getDate()).padStart(2, "0");
    return `${tahun}-${bulan}-${tanggal}`;
}

function getTanggalAwalBulanIni() {
    const sekarang = new Date();
    const tahun = sekarang.getFullYear();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
    return `${tahun}-${bulan}-01`;
}

// ============================================
// 3. FUNGSI: MEMUAT STATISTIK KENDARAAN
//    (Total, Kondisi Baik, Perlu Perhatian, Rusak)
// ============================================

async function muatStatistikKendaraan() {

    // Ambil SEMUA data kendaraan (kita butuh detail per-kendaraan, bukan cuma jumlah)
    const { data: semuaKendaraan, error } = await supabaseClient
        .from("vehicles")
        .select("id, status");

    if (error) {
        console.log("Gagal memuat statistik kendaraan:", error.message);
        return;
    }

    // Total kendaraan = panjang array
    document.querySelector("#statTotalKendaraan").textContent = semuaKendaraan.length;

    // Untuk "Kondisi Baik/Perlu Perhatian/Rusak", kita tentukan berdasarkan
    // HASIL PENGECEKAN TERAKHIR setiap kendaraan, bukan dari kolom "status" kendaraan
    // (karena "status" di tabel vehicles itu Aktif/Maintenance/Tidak Aktif -- beda konsep)

    let jumlahBaik = 0;
    let jumlahPerhatian = 0;
    let jumlahRusak = 0;

    // Untuk setiap kendaraan, cari 1 inspeksi TERAKHIR miliknya
    for (const kendaraan of semuaKendaraan) {

        const { data: inspeksiTerakhir } = await supabaseClient
            .from("inspections")
            .select("overall_result")
            .eq("vehicle_id", kendaraan.id)
            .order("inspection_date", { ascending: false })
            .order("inspection_time", { ascending: false })
            .limit(1)
            .maybeSingle(); // seperti .single(), tapi TIDAK error kalau hasilnya kosong

        if (!inspeksiTerakhir) {
            continue; // kendaraan ini belum pernah diperiksa, lewati (tidak dihitung di kategori manapun)
        }

        if (inspeksiTerakhir.overall_result === "LAYAK DIGUNAKAN") {
            jumlahBaik = jumlahBaik + 1;
        } else if (inspeksiTerakhir.overall_result === "PERLU PERHATIAN") {
            jumlahPerhatian = jumlahPerhatian + 1;
        } else if (inspeksiTerakhir.overall_result === "TIDAK LAYAK DIGUNAKAN") {
            jumlahRusak = jumlahRusak + 1;
        }
    }

    document.querySelector("#statKondisiBaik").textContent = jumlahBaik;
    document.querySelector("#statPerluPerhatian").textContent = jumlahPerhatian;
    document.querySelector("#statRusak").textContent = jumlahRusak;
}

// ============================================
// 4. FUNGSI: MEMUAT JUMLAH PENGECEKAN HARI INI & BULAN INI
// ============================================

async function muatStatistikPengecekan() {

    const tanggalHariIni = getTanggalHariIni();
    const tanggalAwalBulan = getTanggalAwalBulanIni();

    // --- Pengecekan hari ini ---
    const { count: countHariIni, error: errorHariIni } = await supabaseClient
        .from("inspections")
        .select("*", { count: "exact", head: true })
        .eq("inspection_date", tanggalHariIni);

    if (errorHariIni) {
        console.log("Gagal memuat pengecekan hari ini:", errorHariIni.message);
    } else {
        document.querySelector("#statPengecekanHariIni").textContent = countHariIni;
    }

    // --- Pengecekan bulan ini ---
    const { count: countBulanIni, error: errorBulanIni } = await supabaseClient
        .from("inspections")
        .select("*", { count: "exact", head: true })
        .gte("inspection_date", tanggalAwalBulan); // gte = "greater than or equal", artinya "mulai dari tanggal ini dan seterusnya"

    if (errorBulanIni) {
        console.log("Gagal memuat pengecekan bulan ini:", errorBulanIni.message);
    } else {
        document.querySelector("#statPengecekanBulanIni").textContent = countBulanIni;
    }
}

// ============================================
// 5. FUNGSI: MEMUAT JUMLAH LAPORAN KERUSAKAN YANG MASIH "OPEN"
// ============================================

async function muatStatistikLaporanKerusakan() {

    const { count, error } = await supabaseClient
        .from("damage_reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "Open");

    if (error) {
        console.log("Gagal memuat laporan kerusakan:", error.message);
        return;
    }

    document.querySelector("#statLaporanKerusakan").textContent = count;
}

// ============================================
// 6. FUNGSI: MEMUAT TABEL "PENGECEKAN TERAKHIR" (5 data terbaru)
// ============================================

async function muatPengecekanTerakhir() {

    const tabelBody = document.querySelector("#tabelPengecekanTerakhir");

    // Mengambil data inspeksi, SEKALIGUS data kendaraan & pemeriksa terkait
    // lewat fitur "join" bawaan Supabase (dijelaskan di bawah kode ini)
    const { data, error } = await supabaseClient
        .from("inspections")
        .select(`
            id,
            inspection_date,
            overall_result,
            vehicles ( plate_number ),
            profiles ( full_name )
        `)
        .order("inspection_date", { ascending: false })
        .order("inspection_time", { ascending: false })
        .limit(5);

    if (error) {
        console.log("Gagal memuat pengecekan terakhir:", error.message);
        tabelBody.innerHTML = `<tr><td colspan="4" class="text-center">Gagal memuat data.</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tabelBody.innerHTML = `<tr><td colspan="4" class="text-center">Belum ada data pengecekan.</td></tr>`;
        return;
    }

    tabelBody.innerHTML = "";

    data.forEach(function (inspeksi) {

        const badgeClass = getBadgeHasil(inspeksi.overall_result);

        const baris = document.createElement("tr");
        baris.innerHTML = `
            <td>${formatTanggalIndonesia(inspeksi.inspection_date)}</td>
            <td>${inspeksi.vehicles ? inspeksi.vehicles.plate_number : "-"}</td>
            <td>${inspeksi.profiles ? inspeksi.profiles.full_name : "-"}</td>
            <td><span class="badge ${badgeClass}">${inspeksi.overall_result}</span></td>
        `;

        tabelBody.appendChild(baris);
    });
}

// Fungsi bantu: menentukan class badge sesuai hasil evaluasi
function getBadgeHasil(hasil) {
    if (hasil === "LAYAK DIGUNAKAN") return "badge-success";
    if (hasil === "PERLU PERHATIAN") return "badge-warning";
    return "badge-danger";
}

// Fungsi bantu: mengubah format tanggal dari "2026-08-15" jadi "15 Agustus 2026"
function formatTanggalIndonesia(tanggalString) {
    const namaBulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const bagian = tanggalString.split("-"); // ["2026", "08", "15"]
    const tahun = bagian[0];
    const bulan = parseInt(bagian[1]) - 1; // dikurangi 1 karena index array mulai dari 0
    const tanggal = parseInt(bagian[2]);

    return `${tanggal} ${namaBulan[bulan]} ${tahun}`;
}

// ============================================
// 7. MEMANGGIL SEMUA FUNGSI SAAT HALAMAN DIMUAT
// ============================================

muatStatistikKendaraan();
muatStatistikPengecekan();
muatStatistikLaporanKerusakan();
muatPengecekanTerakhir();

console.log("dashboard.js berhasil dimuat");