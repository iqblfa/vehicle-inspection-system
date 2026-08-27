// ============================================
// pajak.js
// Logika untuk halaman Reminder Pajak (khusus Admin)
// ============================================

checkAuthGuard();
requireAdminGuard();

const btnMenu = document.querySelector("#btnMenu");
const sidebar = document.querySelector("#sidebar");
btnMenu.addEventListener("click", function () {
    sidebar.classList.toggle("open");
});

document.querySelector("#btnLogout").addEventListener("click", function () {
    logoutUser();
});

sesuaikanSidebarSesuaiRole();

// ============================================
// STATE FILTER
// ============================================

let filterPajakAktif = { jenis: "", status: "" };

// ============================================
// FUNGSI: MEMBANGUN DAFTAR PAJAK (2 baris per kendaraan: STNK + KIR)
// ============================================

async function muatDataPajak() {

    const tabelBody = document.querySelector("#tabelPajakBody");
    tabelBody.innerHTML = `<tr><td colspan="5" class="text-center">Memuat data...</td></tr>`;

    const { data, error } = await supabaseClient
        .from("vehicles")
        .select("plate_number, brand, model, vehicle_type, pajak_tahunan_expiry, stnk_5tahun_expiry, kir_expiry");

    if (error) {
        console.log("Gagal memuat data pajak:", error.message);
        tabelBody.innerHTML = `<tr><td colspan="5" class="text-center">Gagal memuat data.</td></tr>`;
        return;
    }

    // --- Mengubah data kendaraan (1 baris) menjadi 2 "baris pajak" terpisah (STNK & KIR) ---
        let daftarPajak = [];
    const jenisWajibKir = ["Truck", "Pick Up"];

    data.forEach(function (kendaraan) {
        const namaKendaraan = `${kendaraan.brand} ${kendaraan.model}`;

        daftarPajak.push({
            plate_number: kendaraan.plate_number,
            nama_kendaraan: namaKendaraan,
            jenis: "pajak_tahunan",
            jenis_label: "Pajak Tahunan (STNK)",
            tanggal: kendaraan.pajak_tahunan_expiry,
            status: getStatusPajak(kendaraan.pajak_tahunan_expiry)
        });

        daftarPajak.push({
            plate_number: kendaraan.plate_number,
            nama_kendaraan: namaKendaraan,
            jenis: "stnk_5tahun",
            jenis_label: "STNK 5 Tahun",
            tanggal: kendaraan.stnk_5tahun_expiry,
            status: getStatusPajak(kendaraan.stnk_5tahun_expiry)
        });

        // KIR hanya ditambahkan ke daftar jika kendaraan ini memang wajib KIR
        if (jenisWajibKir.includes(kendaraan.vehicle_type)) {
            daftarPajak.push({
                plate_number: kendaraan.plate_number,
                nama_kendaraan: namaKendaraan,
                jenis: "kir",
                jenis_label: "KIR",
                tanggal: kendaraan.kir_expiry,
                status: getStatusPajak(kendaraan.kir_expiry)
            });
        }
    });

    // --- Buang baris yang tidak punya tanggal sama sekali (belum diisi admin) ---
    daftarPajak = daftarPajak.filter(function (item) {
        return item.tanggal !== null;
    });

    // --- Terapkan filter jenis ---
    if (filterPajakAktif.jenis !== "") {
        daftarPajak = daftarPajak.filter(function (item) {
            return item.jenis === filterPajakAktif.jenis;
        });
    }

    // --- Terapkan filter status ---
    if (filterPajakAktif.status !== "") {
        daftarPajak = daftarPajak.filter(function (item) {
            if (filterPajakAktif.status === "lewat") return item.status.sisaHari < 0;
            if (filterPajakAktif.status === "segera") return item.status.sisaHari >= 0 && item.status.sisaHari <= 30;
            if (filterPajakAktif.status === "aman") return item.status.sisaHari > 30;
            return true;
        });
    }

    // --- Urutkan dari yang PALING MENDESAK (sisa hari paling kecil/paling negatif dulu) ---
    daftarPajak.sort(function (a, b) {
        return a.status.sisaHari - b.status.sisaHari;
    });

    if (daftarPajak.length === 0) {
        tabelBody.innerHTML = `<tr><td colspan="5" class="text-center">Tidak ada data pajak yang sesuai.</td></tr>`;
        return;
    }

    tabelBody.innerHTML = "";

    daftarPajak.forEach(function (item) {

        const tanggalFormat = formatTanggalSederhana(item.tanggal);

        const baris = document.createElement("tr");
        baris.innerHTML = `
            <td>${item.plate_number}</td>
            <td>${item.nama_kendaraan}</td>
            <td>${item.jenis_label}</td>
            <td>${tanggalFormat}</td>
            <td><span class="badge ${item.status.badgeClass}">${item.status.label}</span></td>
        `;

        tabelBody.appendChild(baris);
    });
}

function formatTanggalSederhana(tanggalString) {
    const namaBulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const bagian = tanggalString.split("-");
    return `${parseInt(bagian[2])} ${namaBulan[parseInt(bagian[1]) - 1]} ${bagian[0]}`;
}

muatDataPajak();

document.querySelector("#btnTerapkanFilterPajak").addEventListener("click", function () {
    filterPajakAktif.jenis = document.querySelector("#filterJenisPajak").value;
    filterPajakAktif.status = document.querySelector("#filterStatusPajak").value;
    muatDataPajak();
});

document.querySelector("#btnResetFilterPajak").addEventListener("click", function () {
    document.querySelector("#filterJenisPajak").value = "";
    document.querySelector("#filterStatusPajak").value = "";
    filterPajakAktif = { jenis: "", status: "" };
    muatDataPajak();
});

console.log("pajak.js berhasil dimuat");