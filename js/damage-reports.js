// ============================================
// damage-reports.js
// Logika untuk halaman Laporan Kerusakan
// ============================================

// 1. AUTH GUARD, HAMBURGER MENU, LOGOUT
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

// ============================================
// 2. STATE FILTER
// ============================================

let filterLaporanAktif = {
    status: "",
    kendaraanId: ""
};

let laporanSedangDibuka = null; // menyimpan id laporan yang sedang dibuka di modal detail

// ============================================
// 3. FUNGSI BANTU: BADGE STATUS
// ============================================

function getBadgeStatusLaporan(status) {
    if (status === "Open") return "badge-status-open";
    if (status === "In Progress") return "badge-status-inprogress";
    if (status === "Waiting Sparepart") return "badge-status-waiting";
    if (status === "Completed") return "badge-status-completed";
    return "badge-status-closed";
}

function formatTanggalIndonesia(tanggalWaktuString) {
    const namaBulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const tanggalSaja = tanggalWaktuString.split("T")[0]; // buang bagian jam kalau ada
    const bagian = tanggalSaja.split("-");
    const tahun = bagian[0];
    const bulan = parseInt(bagian[1]) - 1;
    const tanggal = parseInt(bagian[2]);
    return `${tanggal} ${namaBulan[bulan]} ${tahun}`;
}

// ============================================
// 4. MENGISI DROPDOWN KENDARAAN (dipakai di filter DAN form manual)
// ============================================

async function isiSemuaDropdownKendaraan() {

    const { data, error } = await supabaseClient
        .from("vehicles")
        .select("id, plate_number")
        .order("plate_number", { ascending: true });

    if (error || !data) {
        return;
    }

    const dropdownFilter = document.querySelector("#filterKendaraanLaporan");
    const dropdownManual = document.querySelector("#manualKendaraan");

    data.forEach(function (kendaraan) {
        const opsi1 = document.createElement("option");
        opsi1.value = kendaraan.id;
        opsi1.textContent = kendaraan.plate_number;
        dropdownFilter.appendChild(opsi1);

        const opsi2 = document.createElement("option");
        opsi2.value = kendaraan.id;
        opsi2.textContent = kendaraan.plate_number;
        dropdownManual.appendChild(opsi2);
    });
}

isiSemuaDropdownKendaraan();

// ============================================
// 5. FUNGSI UTAMA: MEMUAT DATA LAPORAN
// ============================================

async function muatDataLaporan() {

    const tabelBody = document.querySelector("#tabelLaporanBody");
    tabelBody.innerHTML = `<tr><td colspan="8" class="text-center">Memuat data...</td></tr>`;

    let query = supabaseClient
        .from("damage_reports")
        .select(`
            id, report_number, created_at, damage_description, severity, status,
            inspection_id, photo_url,
            vehicles ( plate_number )
        `);

    if (filterLaporanAktif.status !== "") {
        query = query.eq("status", filterLaporanAktif.status);
    }
    if (filterLaporanAktif.kendaraanId !== "") {
        query = query.eq("vehicle_id", filterLaporanAktif.kendaraanId);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
        console.log("Gagal memuat laporan kerusakan:", error.message);
        tabelBody.innerHTML = `<tr><td colspan="8" class="text-center">Gagal memuat data.</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tabelBody.innerHTML = `<tr><td colspan="8" class="text-center">Belum ada laporan kerusakan.</td></tr>`;
        return;
    }

    tabelBody.innerHTML = "";

    data.forEach(function (laporan) {

        const badgeClass = getBadgeStatusLaporan(laporan.status);
        const platNomor = laporan.vehicles ? laporan.vehicles.plate_number : "-";
        const sumberLabel = laporan.inspection_id ? "Otomatis" : "Manual";

        // Memotong deskripsi supaya tidak terlalu panjang di tabel
        const deskripsiSingkat = laporan.damage_description.length > 40
            ? laporan.damage_description.substring(0, 40) + "..."
            : laporan.damage_description;

        const baris = document.createElement("tr");
        baris.innerHTML = `
            <td>${laporan.report_number}</td>
            <td>${formatTanggalIndonesia(laporan.created_at)}</td>
            <td>${platNomor}</td>
            <td>${deskripsiSingkat}</td>
            <td>${laporan.severity}</td>
            <td><span class="badge ${badgeClass}">${laporan.status}</span></td>
            <td><span class="badge badge-source">${sumberLabel}</span></td>
            <td><button class="btn-icon btn-lihat-laporan" data-id="${laporan.id}">🔍</button></td>
        `;

        tabelBody.appendChild(baris);
    });

    document.querySelectorAll(".btn-lihat-laporan").forEach(function (tombol) {
        tombol.addEventListener("click", function () {
            const id = tombol.getAttribute("data-id");
            bukaDetailLaporan(id);
        });
    });
}

muatDataLaporan();

// ============================================
// 6. FILTER: TERAPKAN & RESET
// ============================================

document.querySelector("#btnTerapkanFilterLaporan").addEventListener("click", function () {
    filterLaporanAktif.status = document.querySelector("#filterStatusLaporan").value;
    filterLaporanAktif.kendaraanId = document.querySelector("#filterKendaraanLaporan").value;
    muatDataLaporan();
});

document.querySelector("#btnResetFilterLaporan").addEventListener("click", function () {
    document.querySelector("#filterStatusLaporan").value = "";
    document.querySelector("#filterKendaraanLaporan").value = "";
    filterLaporanAktif = { status: "", kendaraanId: "" };
    muatDataLaporan();
});

// ============================================
// 7. MODAL DETAIL & UBAH STATUS
// ============================================

async function bukaDetailLaporan(id) {

    const { data, error } = await supabaseClient
        .from("damage_reports")
        .select(`
            id, report_number, created_at, damage_description, damage_location,
            severity, status, photo_url, inspection_id,
            vehicles ( plate_number, brand, model )
        `)
        .eq("id", id)
        .single();

    if (error) {
        alert("Gagal memuat detail laporan.");
        return;
    }

    laporanSedangDibuka = id;

    const platNomor = data.vehicles ? data.vehicles.plate_number : "-";
    const namaKendaraan = data.vehicles ? `${data.vehicles.brand} ${data.vehicles.model}` : "-";
    const sumberLabel = data.inspection_id ? "Otomatis dari Pengecekan" : "Dilaporkan Manual";

    let html = `
        <div class="detail-info-grid">
            <div class="detail-info-item">
                <div class="label">Nomor Laporan</div>
                <div class="value">${data.report_number}</div>
            </div>
            <div class="detail-info-item">
                <div class="label">Kendaraan</div>
                <div class="value">${platNomor} - ${namaKendaraan}</div>
            </div>
            <div class="detail-info-item">
                <div class="label">Tanggal Dilaporkan</div>
                <div class="value">${formatTanggalIndonesia(data.created_at)}</div>
            </div>
            <div class="detail-info-item">
                <div class="label">Tingkat Kerusakan</div>
                <div class="value">${data.severity}</div>
            </div>
            <div class="detail-info-item">
                <div class="label">Sumber Laporan</div>
                <div class="value">${sumberLabel}</div>
            </div>
            <div class="detail-info-item">
                <div class="label">Lokasi</div>
                <div class="value">${data.damage_location || "-"}</div>
            </div>
        </div>

        <div class="detail-section" style="margin-top: 16px;">
            <div class="detail-section-title">Deskripsi Kerusakan</div>
            <p>${data.damage_description}</p>
        </div>
    `;

    if (data.photo_url) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Foto</div>
                <img src="${data.photo_url}" alt="Foto kerusakan" style="max-width: 100%; border-radius: 8px; cursor: pointer;" onclick="window.open('${data.photo_url}', '_blank')">
            </div>
        `;
    }

    document.querySelector("#detailLaporanContent").innerHTML = html;
    document.querySelector("#inputUbahStatus").value = data.status;
    document.querySelector("#statusUpdateError").textContent = "";

    document.querySelector("#modalDetailLaporan").classList.add("show");
}

document.querySelector("#btnCloseModalDetailLaporan").addEventListener("click", function () {
    document.querySelector("#modalDetailLaporan").classList.remove("show");
});

document.querySelector("#btnBatalUbahStatus").addEventListener("click", function () {
    document.querySelector("#modalDetailLaporan").classList.remove("show");
});

// ============================================
// 8. MENYIMPAN PERUBAHAN STATUS
// ============================================

document.querySelector("#btnSimpanStatus").addEventListener("click", async function () {

    const statusBaru = document.querySelector("#inputUbahStatus").value;
    const errorEl = document.querySelector("#statusUpdateError");
    const btnSimpan = document.querySelector("#btnSimpanStatus");

    errorEl.textContent = "";
    btnSimpan.disabled = true;
    btnSimpan.textContent = "Menyimpan...";

    const { error } = await supabaseClient
        .from("damage_reports")
        .update({ status: statusBaru })
        .eq("id", laporanSedangDibuka);

    btnSimpan.disabled = false;
    btnSimpan.textContent = "Simpan Status";

    if (error) {
        console.log("Gagal mengubah status:", error.message);
        errorEl.textContent = "Gagal menyimpan perubahan status.";
        return;
    }

    document.querySelector("#modalDetailLaporan").classList.remove("show");
    muatDataLaporan();

    // --- Jika status baru adalah "Completed", tawarkan pencatatan servis ---
    if (statusBaru === "Completed") {
        const mauCatatServis = confirm("Status berhasil diperbarui menjadi Completed. Apakah Anda ingin langsung mencatat detail servis/perbaikan untuk laporan ini?");
        if (mauCatatServis) {
            window.location.href = "maintenance.html";
            return;
        }
    }

    alert("Status laporan berhasil diperbarui.");
});

// ============================================
// 9. MODAL BUAT LAPORAN MANUAL
// ============================================

const modalLaporanManual = document.querySelector("#modalLaporanManual");
const formLaporanManual = document.querySelector("#formLaporanManual");
let fileFotoManual = null;

document.querySelector("#btnBuatLaporanManual").addEventListener("click", function () {
    formLaporanManual.reset();
    document.querySelector("#formLaporanManualError").textContent = "";
    document.querySelector("#manualFotoPreview").innerHTML = "Belum ada foto";
    fileFotoManual = null;
    modalLaporanManual.classList.add("show");
});

document.querySelector("#btnCloseModalManual").addEventListener("click", function () {
    modalLaporanManual.classList.remove("show");
});
document.querySelector("#btnBatalLaporanManual").addEventListener("click", function () {
    modalLaporanManual.classList.remove("show");
});

// Preview foto yang dipilih
document.querySelector("#manualFoto").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;

    fileFotoManual = file;

    const reader = new FileReader();
    reader.onload = function (e) {
        document.querySelector("#manualFotoPreview").innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`;
    };
    reader.readAsDataURL(file);
});

// ============================================
// 10. SUBMIT FORM LAPORAN MANUAL
// ============================================

formLaporanManual.addEventListener("submit", async function (event) {

    event.preventDefault();

    const errorEl = document.querySelector("#formLaporanManualError");
    errorEl.textContent = "";

    const kendaraanId = document.querySelector("#manualKendaraan").value;
    const lokasi = document.querySelector("#manualLokasi").value.trim();
    const deskripsi = document.querySelector("#manualDeskripsi").value.trim();
    const tingkat = document.querySelector("#manualTingkat").value;

    if (kendaraanId === "" || deskripsi === "" || tingkat === "") {
        errorEl.textContent = "Kendaraan, deskripsi, dan tingkat kerusakan wajib diisi.";
        return;
    }

    const btnSimpan = document.querySelector("#btnSimpanLaporanManual");
    btnSimpan.disabled = true;
    btnSimpan.textContent = "Menyimpan...";

    // Ambil id user yang login
    const { data: userData } = await supabaseClient.auth.getUser();

    // Upload foto jika ada
    let urlFoto = null;
    if (fileFotoManual) {
        btnSimpan.textContent = "Mengupload foto...";
        const namaFileUnik = "manual-" + Date.now() + ".jpg";

        const { error: errorUpload } = await supabaseClient
            .storage
            .from("inspection-photos")
            .upload(namaFileUnik, fileFotoManual);

        if (!errorUpload) {
            const { data: urlData } = supabaseClient
                .storage
                .from("inspection-photos")
                .getPublicUrl(namaFileUnik);
            urlFoto = urlData.publicUrl;
        } else {
            console.log("Gagal upload foto laporan manual:", errorUpload.message);
        }
    }

    btnSimpan.textContent = "Menyimpan data...";

    const nomorLaporan = "DMG-MANUAL-" + Date.now();

    const { error } = await supabaseClient
        .from("damage_reports")
        .insert([{
            report_number: nomorLaporan,
            inspection_id: null,
            vehicle_id: kendaraanId,
            reporter_id: userData.user.id,
            damage_description: deskripsi,
            damage_location: lokasi || null,
            severity: tingkat,
            photo_url: urlFoto,
            status: "Open"
        }]);

    btnSimpan.disabled = false;
    btnSimpan.textContent = "Simpan Laporan";

    if (error) {
        console.log("Gagal menyimpan laporan manual:", error.message);
        errorEl.textContent = "Data gagal disimpan. Silakan coba kembali.";
        return;
    }

    modalLaporanManual.classList.remove("show");
    muatDataLaporan();
    alert("Laporan kerusakan berhasil disimpan.");
});

console.log("damage-reports.js berhasil dimuat");