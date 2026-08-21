// ============================================
// history.js
// Logika untuk halaman Riwayat Pengecekan
// ============================================

// 1. AUTH GUARD, HAMBURGER MENU, LOGOUT
checkAuthGuard();

let profilUserLogin = null; // akan diisi setelah sesuaikanSidebarSesuaiRole() selesai

sesuaikanSidebarSesuaiRole().then(function (profile) {
    profilUserLogin = profile;
    muatDataHistory(); // muat ulang data setelah kita tahu role-nya (supaya filter driver berlaku sejak awal)
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
// 2. VARIABEL STATE (menyimpan kondisi filter & halaman saat ini)
// ============================================

const DATA_PER_HALAMAN = 10;
let halamanSaatIni = 1;
let totalData = 0;

// Objek untuk menyimpan filter yang SEDANG diterapkan
let filterAktif = {
    search: "",
    kendaraanId: "",
    status: "",
    tanggalDari: "",
    tanggalSampai: ""
};

// ============================================
// 3. FUNGSI BANTU (dipakai berulang)
// ============================================

function getBadgeHasil(hasil) {
    if (hasil === "LAYAK DIGUNAKAN") return "badge-success";
    if (hasil === "PERLU PERHATIAN") return "badge-warning";
    return "badge-danger";
}

function formatTanggalIndonesia(tanggalString) {
    const namaBulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const bagian = tanggalString.split("-");
    const tahun = bagian[0];
    const bulan = parseInt(bagian[1]) - 1;
    const tanggal = parseInt(bagian[2]);
    return `${tanggal} ${namaBulan[bulan]} ${tahun}`;
}

// ============================================
// 4. MENGISI DROPDOWN FILTER KENDARAAN
// ============================================

async function isiDropdownFilterKendaraan() {

    const dropdown = document.querySelector("#filterKendaraan");

    const { data, error } = await supabaseClient
        .from("vehicles")
        .select("id, plate_number")
        .order("plate_number", { ascending: true });

    if (error || !data) {
        return;
    }

    data.forEach(function (kendaraan) {
        const opsi = document.createElement("option");
        opsi.value = kendaraan.id;
        opsi.textContent = kendaraan.plate_number;
        dropdown.appendChild(opsi);
    });
}

isiDropdownFilterKendaraan();

// ============================================
// 5. FUNGSI UTAMA: MEMUAT DATA RIWAYAT (dengan filter + pagination)
// ============================================

async function muatDataHistory() {

    const tabelBody = document.querySelector("#tabelHistoryBody");
    tabelBody.innerHTML = `<tr><td colspan="9" class="text-center">Memuat data...</td></tr>`;

    // Menghitung batas awal & akhir data untuk halaman saat ini
    const dariIndex = (halamanSaatIni - 1) * DATA_PER_HALAMAN;
    const sampaiIndex = dariIndex + DATA_PER_HALAMAN - 1;

    // Membangun query dasar, lalu ditambah filter satu-satu SECARA KONDISIONAL
    let query = supabaseClient
        .from("inspections")
        .select(`
            id,
            inspection_date,
            inspection_time,
            odometer,
            overall_result,
            findings_count,
            vehicles ( plate_number, brand, model ),
            profiles ( full_name )
        `, { count: "exact" });

    // Filter: kendaraan tertentu
    if (filterAktif.kendaraanId !== "") {
        query = query.eq("vehicle_id", filterAktif.kendaraanId);
    }

    // Filter: status/hasil tertentu
    if (filterAktif.status !== "") {
        query = query.eq("overall_result", filterAktif.status);
    }

    // Filter: rentang tanggal
    if (filterAktif.tanggalDari !== "") {
        query = query.gte("inspection_date", filterAktif.tanggalDari);
    }
    if (filterAktif.tanggalSampai !== "") {
        query = query.lte("inspection_date", filterAktif.tanggalSampai);
    }

    // Filter TAMBAHAN: jika yang login adalah DRIVER, hanya tampilkan inspeksi miliknya sendiri
    if (profilUserLogin && profilUserLogin.role !== "admin") {
        const { data: userData } = await supabaseClient.auth.getUser();
        query = query.eq("inspector_id", userData.user.id);
    }
    
    // Urutkan dari yang terbaru, lalu ambil sesuai halaman (pagination)
    query = query
        .order("inspection_date", { ascending: false })
        .order("inspection_time", { ascending: false })
        .range(dariIndex, sampaiIndex);

    const { data, error, count } = await query;

    if (error) {
        console.log("Gagal memuat riwayat:", error.message);
        tabelBody.innerHTML = `<tr><td colspan="9" class="text-center">Gagal memuat data.</td></tr>`;
        return;
    }

    totalData = count;

    // --- Filter "search" nomor polisi dilakukan MANUAL di JavaScript ---
    // (karena kita mencari di kolom tabel vehicles yang terhubung, bukan kolom
    // langsung di tabel inspections, sehingga tidak bisa pakai .ilike() langsung)
    let dataUntukDitampilkan = data;

    if (filterAktif.search !== "") {
        const kataKunci = filterAktif.search.toLowerCase();
        dataUntukDitampilkan = data.filter(function (inspeksi) {
            const platNomor = inspeksi.vehicles ? inspeksi.vehicles.plate_number.toLowerCase() : "";
            return platNomor.includes(kataKunci);
        });
    }

    if (dataUntukDitampilkan.length === 0) {
        tabelBody.innerHTML = `<tr><td colspan="9" class="text-center">Tidak ada data yang sesuai.</td></tr>`;
        updatePaginationInfo();
        return;
    }

    tabelBody.innerHTML = "";

    dataUntukDitampilkan.forEach(function (inspeksi) {

        const badgeClass = getBadgeHasil(inspeksi.overall_result);
        const namaKendaraan = inspeksi.vehicles ? `${inspeksi.vehicles.brand} ${inspeksi.vehicles.model}` : "-";
        const platNomor = inspeksi.vehicles ? inspeksi.vehicles.plate_number : "-";
        const namaPemeriksa = inspeksi.profiles ? inspeksi.profiles.full_name : "-";

        const baris = document.createElement("tr");
        baris.innerHTML = `
            <td>${formatTanggalIndonesia(inspeksi.inspection_date)}</td>
            <td>${inspeksi.inspection_time.substring(0, 5)}</td>
            <td>${platNomor}</td>
            <td>${namaKendaraan}</td>
            <td>${namaPemeriksa}</td>
            <td>${inspeksi.odometer.toLocaleString("id-ID")} km</td>
            <td><span class="badge ${badgeClass}">${inspeksi.overall_result}</span></td>
            <td>${inspeksi.findings_count}</td>
            <td><button class="btn-icon btn-detail" data-id="${inspeksi.id}">🔍</button></td>
        `;

        tabelBody.appendChild(baris);
    });

    // Pasang event listener untuk tombol detail yang baru dibuat
    document.querySelectorAll(".btn-detail").forEach(function (tombol) {
        tombol.addEventListener("click", function () {
            const id = tombol.getAttribute("data-id");
            bukaDetailPengecekan(id);
        });
    });

    updatePaginationInfo();
}

// ============================================
// 6. FUNGSI: MEMPERBARUI TAMPILAN INFO PAGINATION
// ============================================

function updatePaginationInfo() {

    const totalHalaman = Math.ceil(totalData / DATA_PER_HALAMAN) || 1;

    document.querySelector("#paginationInfo").textContent =
        `Menampilkan halaman ${halamanSaatIni} dari ${totalHalaman} (${totalData} total data)`;

    document.querySelector("#paginationPageNumber").textContent = `Halaman ${halamanSaatIni}`;

    const btnPrev = document.querySelector("#btnPrevPage");
    const btnNext = document.querySelector("#btnNextPage");

    // Tombol "Sebelumnya" dinonaktifkan kalau sudah di halaman pertama
    btnPrev.disabled = (halamanSaatIni <= 1);

    // Tombol "Berikutnya" dinonaktifkan kalau sudah di halaman terakhir
    btnNext.disabled = (halamanSaatIni >= totalHalaman);
}

// ============================================
// 7. EVENT LISTENER: TOMBOL PAGINATION
// ============================================

document.querySelector("#btnPrevPage").addEventListener("click", function () {
    if (halamanSaatIni > 1) {
        halamanSaatIni = halamanSaatIni - 1;
        muatDataHistory();
    }
});

document.querySelector("#btnNextPage").addEventListener("click", function () {
    const totalHalaman = Math.ceil(totalData / DATA_PER_HALAMAN) || 1;
    if (halamanSaatIni < totalHalaman) {
        halamanSaatIni = halamanSaatIni + 1;
        muatDataHistory();
    }
});

// ============================================
// 8. EVENT LISTENER: TOMBOL FILTER
// ============================================

document.querySelector("#btnTerapkanFilter").addEventListener("click", function () {

    filterAktif.search = document.querySelector("#filterSearch").value.trim();
    filterAktif.kendaraanId = document.querySelector("#filterKendaraan").value;
    filterAktif.status = document.querySelector("#filterStatus").value;
    filterAktif.tanggalDari = document.querySelector("#filterTanggalDari").value;
    filterAktif.tanggalSampai = document.querySelector("#filterTanggalSampai").value;

    halamanSaatIni = 1; // reset ke halaman 1 setiap kali filter baru diterapkan
    muatDataHistory();
});

document.querySelector("#btnResetFilter").addEventListener("click", function () {

    document.querySelector("#filterSearch").value = "";
    document.querySelector("#filterKendaraan").value = "";
    document.querySelector("#filterStatus").value = "";
    document.querySelector("#filterTanggalDari").value = "";
    document.querySelector("#filterTanggalSampai").value = "";

    filterAktif = {
        search: "",
        kendaraanId: "",
        status: "",
        tanggalDari: "",
        tanggalSampai: ""
    };

    halamanSaatIni = 1;
    muatDataHistory();
});

// ============================================
// 9. FUNGSI: MEMBUKA MODAL DETAIL PENGECEKAN
// ============================================

async function bukaDetailPengecekan(inspectionId) {

    const modalDetail = document.querySelector("#modalDetail");
    const detailContent = document.querySelector("#detailContent");

    detailContent.innerHTML = `<p class="text-center">Memuat detail...</p>`;
    modalDetail.classList.add("show");

    // --- Mengambil data header inspeksi ---
    const { data: inspeksi, error: errorInspeksi } = await supabaseClient
        .from("inspections")
        .select(`
            id, inspection_date, inspection_time, odometer, location,
            overall_result, findings_count, notes,
            vehicles ( plate_number, brand, model ),
            profiles ( full_name )
        `)
        .eq("id", inspectionId)
        .single();

    if (errorInspeksi) {
        detailContent.innerHTML = `<p class="text-center">Gagal memuat detail pengecekan.</p>`;
        return;
    }

    // --- Mengambil semua item checklist terkait ---
    const { data: items, error: errorItems } = await supabaseClient
        .from("inspection_items")
        .select("*")
        .eq("inspection_id", inspectionId)
        .order("category", { ascending: true });

    // --- Mengambil semua foto terkait ---
    const { data: photos, error: errorPhotos } = await supabaseClient
        .from("inspection_photos")
        .select("*")
        .eq("inspection_id", inspectionId);

    // --- Menyusun tampilan HTML detail ---
    renderDetailContent(inspeksi, items || [], photos || []);
}

// ============================================
// 10. FUNGSI: MENYUSUN TAMPILAN HTML DETAIL PENGECEKAN
// ============================================

function renderDetailContent(inspeksi, items, photos) {

    const detailContent = document.querySelector("#detailContent");

    const platNomor = inspeksi.vehicles ? inspeksi.vehicles.plate_number : "-";
    const namaKendaraan = inspeksi.vehicles ? `${inspeksi.vehicles.brand} ${inspeksi.vehicles.model}` : "-";
    const namaPemeriksa = inspeksi.profiles ? inspeksi.profiles.full_name : "-";

    // Menentukan class warna banner hasil
    let resultClass = "detail-result-layak";
    if (inspeksi.overall_result === "PERLU PERHATIAN") resultClass = "detail-result-perhatian";
    if (inspeksi.overall_result === "TIDAK LAYAK DIGUNAKAN") resultClass = "detail-result-tidaklayak";

    // --- Bagian 1: Banner hasil ---
    let html = `
        <div class="detail-result-banner ${resultClass}">
            ${inspeksi.overall_result}
        </div>

        <div class="detail-section">
            <div class="detail-info-grid">
                <div class="detail-info-item">
                    <div class="label">Nomor Polisi</div>
                    <div class="value">${platNomor}</div>
                </div>
                <div class="detail-info-item">
                    <div class="label">Kendaraan</div>
                    <div class="value">${namaKendaraan}</div>
                </div>
                <div class="detail-info-item">
                    <div class="label">Tanggal & Jam</div>
                    <div class="value">${formatTanggalIndonesia(inspeksi.inspection_date)}, ${inspeksi.inspection_time.substring(0, 5)}</div>
                </div>
                <div class="detail-info-item">
                    <div class="label">Pemeriksa</div>
                    <div class="value">${namaPemeriksa}</div>
                </div>
                <div class="detail-info-item">
                    <div class="label">Odometer</div>
                    <div class="value">${inspeksi.odometer.toLocaleString("id-ID")} km</div>
                </div>
                <div class="detail-info-item">
                    <div class="label">Lokasi</div>
                    <div class="value">${inspeksi.location || "-"}</div>
                </div>
            </div>
        </div>
    `;

    // --- Bagian 2: Checklist, dikelompokkan ulang per kategori ---
    html += `<div class="detail-section"><div class="detail-section-title">Checklist Pengecekan (${inspeksi.findings_count} temuan)</div>`;

    // Mengelompokkan array "items" (flat/datar) menjadi per kategori
    const kategoriUnik = [...new Set(items.map(function (item) { return item.category; }))];
    // Penjelasan baris di atas ada di bawah kode ini

    kategoriUnik.forEach(function (kategori) {

        html += `<div class="detail-checklist-category">
                    <div class="detail-checklist-category-title">${kategori}</div>`;

        const itemsKategoriIni = items.filter(function (item) { return item.category === kategori; });

        itemsKategoriIni.forEach(function (item) {

            const badgeClass = item.status === "Baik" ? "badge-success" :
                                item.status === "Rusak" ? "badge-danger" :
                                item.status === "Perlu Perhatian" ? "badge-warning" : "badge-secondary";

            html += `<div class="detail-checklist-row">
                        <span>${item.item_name}</span>
                        <span class="badge ${badgeClass}">${item.status}</span>`;

            if (item.status === "Rusak" && item.notes) {
                html += `<div class="damage-note">
                            <strong>Kerusakan (${item.severity || "-"}):</strong> ${item.notes}
                          </div>`;
            }

            html += `</div>`;
        });

        html += `</div>`;
    });

    html += `</div>`;

    // --- Bagian 3: Foto-foto ---
    if (photos.length > 0) {
        html += `<div class="detail-section">
                    <div class="detail-section-title">Foto (${photos.length})</div>
                    <div class="detail-photo-grid">`;

        photos.forEach(function (foto) {
            html += `<img src="${foto.photo_url}" alt="${foto.photo_type}" title="${foto.photo_type}" onclick="window.open('${foto.photo_url}', '_blank')">`;
        });

        html += `</div></div>`;
    }

    detailContent.innerHTML = html;
}

// ============================================
// 11. TUTUP MODAL DETAIL
// ============================================

document.querySelector("#btnCloseModalDetail").addEventListener("click", function () {
    document.querySelector("#modalDetail").classList.remove("show");
});

// ============================================
// 12. MEMUAT DATA SAAT HALAMAN PERTAMA KALI DIBUKA
// (dipanggil lewat .then() di bagian atas file, setelah role diketahui)
// ============================================

console.log("history.js berhasil dimuat");


// ============================================
// PHASE 22: EXPORT KE EXCEL
// ============================================

document.querySelector("#btnExportExcel").addEventListener("click", async function () {

    const btn = document.querySelector("#btnExportExcel");
    btn.disabled = true;
    btn.textContent = "Menyiapkan data...";

    // Mengambil SEMUA data sesuai filter yang sedang aktif (TANPA batasan pagination)
    let query = supabaseClient
        .from("inspections")
        .select(`
            inspection_date, inspection_time, odometer, overall_result, findings_count, location,
            vehicles ( plate_number, brand, model ),
            profiles ( full_name )
        `);

    if (filterAktif.kendaraanId !== "") {
        query = query.eq("vehicle_id", filterAktif.kendaraanId);
    }
    if (filterAktif.status !== "") {
        query = query.eq("overall_result", filterAktif.status);
    }
    if (filterAktif.tanggalDari !== "") {
        query = query.gte("inspection_date", filterAktif.tanggalDari);
    }
    if (filterAktif.tanggalSampai !== "") {
        query = query.lte("inspection_date", filterAktif.tanggalSampai);
    }

    query = query.order("inspection_date", { ascending: false });

    const { data, error } = await query;

    btn.disabled = false;
    btn.textContent = "📥 Export ke Excel";

    if (error) {
        alert("Gagal mengambil data untuk export.");
        console.log(error.message);
        return;
    }

    if (data.length === 0) {
        alert("Tidak ada data untuk diexport.");
        return;
    }

    // --- Mengubah data mentah menjadi format baris-kolom sederhana untuk Excel ---
    const dataUntukExcel = data.map(function (inspeksi) {
        return {
            "Tanggal": formatTanggalIndonesia(inspeksi.inspection_date),
            "Jam": inspeksi.inspection_time.substring(0, 5),
            "Nomor Polisi": inspeksi.vehicles ? inspeksi.vehicles.plate_number : "-",
            "Merk/Model": inspeksi.vehicles ? `${inspeksi.vehicles.brand} ${inspeksi.vehicles.model}` : "-",
            "Pemeriksa": inspeksi.profiles ? inspeksi.profiles.full_name : "-",
            "Odometer (km)": inspeksi.odometer,
            "Lokasi": inspeksi.location || "-",
            "Hasil": inspeksi.overall_result,
            "Jumlah Temuan": inspeksi.findings_count
        };
    });

    // --- Membuat file Excel memakai SheetJS ---
    const worksheet = XLSX.utils.json_to_sheet(dataUntukExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Pengecekan");

    // Mengatur lebar kolom supaya tidak terlalu sempit
    worksheet["!cols"] = [
        { wch: 16 }, // Tanggal
        { wch: 8 },  // Jam
        { wch: 14 }, // Nomor Polisi
        { wch: 20 }, // Merk/Model
        { wch: 18 }, // Pemeriksa
        { wch: 14 }, // Odometer
        { wch: 18 }, // Lokasi
        { wch: 22 }, // Hasil
        { wch: 14 }  // Jumlah Temuan
    ];

    // Nama file otomatis menyertakan tanggal export
    const sekarang = new Date();
    const namaFile = `Riwayat-Pengecekan-${sekarang.getFullYear()}${String(sekarang.getMonth() + 1).padStart(2, "0")}${String(sekarang.getDate()).padStart(2, "0")}.xlsx`;

    XLSX.writeFile(workbook, namaFile);
});


// ============================================
// PHASE 22: CETAK PDF (lewat fitur Print bawaan browser)
// ============================================

document.querySelector("#btnCetakPDF").addEventListener("click", function () {

    // Memicu dialog print bawaan browser.
    // CSS khusus di history-print.css (media="print") akan otomatis
    // mengatur ulang tampilan supaya rapi saat dicetak/disimpan sebagai PDF.
    window.print();
});