// ============================================
// maintenance.js
// Logika CRUD untuk halaman Riwayat Servis (khusus Admin)
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
// 2. STATE FILTER
// ============================================

let filterServisAktif = {
    kendaraanId: ""
};

// ============================================
// 3. ELEMEN-ELEMEN YANG SERING DIPAKAI
// ============================================

const tabelServisBody = document.querySelector("#tabelServisBody");
const modalServis = document.querySelector("#modalServis");
const modalServisTitle = document.querySelector("#modalServisTitle");
const formServis = document.querySelector("#formServis");
const formServisError = document.querySelector("#formServisError");
const btnTambahServis = document.querySelector("#btnTambahServis");
const btnCloseModalServis = document.querySelector("#btnCloseModalServis");
const btnBatalServis = document.querySelector("#btnBatalServis");

// ============================================
// 4. MENGISI DROPDOWN KENDARAAN (filter DAN form)
// ============================================

async function isiDropdownKendaraanServis() {

    const { data, error } = await supabaseClient
        .from("vehicles")
        .select("id, plate_number")
        .order("plate_number", { ascending: true });

    if (error || !data) {
        return;
    }

    const dropdownFilter = document.querySelector("#filterKendaraanServis");
    const dropdownForm = document.querySelector("#servisKendaraan");

    data.forEach(function (kendaraan) {
        const opsi1 = document.createElement("option");
        opsi1.value = kendaraan.id;
        opsi1.textContent = kendaraan.plate_number;
        dropdownFilter.appendChild(opsi1);

        const opsi2 = document.createElement("option");
        opsi2.value = kendaraan.id;
        opsi2.textContent = kendaraan.plate_number;
        dropdownForm.appendChild(opsi2);
    });
}

isiDropdownKendaraanServis();

// ============================================
// 5. FUNGSI BANTU: FORMAT RUPIAH & TANGGAL
// ============================================

function formatRupiah(angka) {
    if (angka === null || angka === undefined) {
        return "-";
    }
    return "Rp " + Number(angka).toLocaleString("id-ID");
}

function formatTanggalIndonesia(tanggalString) {
    const namaBulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const bagian = tanggalString.split("-");
    return `${parseInt(bagian[2])} ${namaBulan[parseInt(bagian[1]) - 1]} ${bagian[0]}`;
}

// ============================================
// 6. FUNGSI UTAMA: MEMUAT DATA SERVIS (READ)
// ============================================

async function muatDataServis() {

    tabelServisBody.innerHTML = `<tr><td colspan="6" class="text-center">Memuat data...</td></tr>`;

    let query = supabaseClient
        .from("maintenance_records")
        .select(`
            id, maintenance_date, description, cost, performed_by,
            vehicles ( plate_number )
        `);

    if (filterServisAktif.kendaraanId !== "") {
        query = query.eq("vehicle_id", filterServisAktif.kendaraanId);
    }

    query = query.order("maintenance_date", { ascending: false });

    const { data, error } = await query;

    if (error) {
        console.log("Gagal memuat riwayat servis:", error.message);
        tabelServisBody.innerHTML = `<tr><td colspan="6" class="text-center">Gagal memuat data.</td></tr>`;
        return;
    }

    // --- Update kartu ringkasan ---
    document.querySelector("#statTotalServis").textContent = data.length;

    let totalBiaya = 0;
    data.forEach(function (rec) {
        totalBiaya = totalBiaya + (rec.cost ? Number(rec.cost) : 0);
    });
    document.querySelector("#statTotalBiaya").textContent = formatRupiah(totalBiaya);

    if (data.length === 0) {
        tabelServisBody.innerHTML = `<tr><td colspan="6" class="text-center">Belum ada catatan servis.</td></tr>`;
        return;
    }

    tabelServisBody.innerHTML = "";

    data.forEach(function (rec) {

        const platNomor = rec.vehicles ? rec.vehicles.plate_number : "-";

        const baris = document.createElement("tr");
        baris.innerHTML = `
            <td>${formatTanggalIndonesia(rec.maintenance_date)}</td>
            <td>${platNomor}</td>
            <td>${rec.description}</td>
            <td>${formatRupiah(rec.cost)}</td>
            <td>${rec.performed_by || "-"}</td>
            <td>
                <button class="btn-icon btn-edit-servis" data-id="${rec.id}">✏️</button>
                <button class="btn-icon danger btn-delete-servis" data-id="${rec.id}">🗑️</button>
            </td>
        `;

        tabelServisBody.appendChild(baris);
    });

    pasangEventTombolServis();
}

muatDataServis();

// ============================================
// 7. FILTER: TERAPKAN & RESET
// ============================================

document.querySelector("#btnTerapkanFilterServis").addEventListener("click", function () {
    filterServisAktif.kendaraanId = document.querySelector("#filterKendaraanServis").value;
    muatDataServis();
});

document.querySelector("#btnResetFilterServis").addEventListener("click", function () {
    document.querySelector("#filterKendaraanServis").value = "";
    filterServisAktif = { kendaraanId: "" };
    muatDataServis();
});

// ============================================
// 8. MEMBUKA & MENUTUP MODAL
// ============================================

function bukaModalTambahServis() {
    modalServisTitle.textContent = "Catat Servis Baru";
    formServis.reset();
    document.querySelector("#servisId").value = "";
    formServisError.textContent = "";
    modalServis.classList.add("show");
}

function tutupModalServis() {
    modalServis.classList.remove("show");
}

btnTambahServis.addEventListener("click", bukaModalTambahServis);
btnCloseModalServis.addEventListener("click", tutupModalServis);
btnBatalServis.addEventListener("click", tutupModalServis);

// ============================================
// 9. FUNGSI: TAMBAH / EDIT (CREATE & UPDATE)
// ============================================

formServis.addEventListener("submit", async function (event) {

    event.preventDefault();
    formServisError.textContent = "";

    const servisId = document.querySelector("#servisId").value;
    const kendaraanId = document.querySelector("#servisKendaraan").value;
    const tanggal = document.querySelector("#servisTanggal").value;
    const biaya = document.querySelector("#servisBiaya").value;
    const deskripsi = document.querySelector("#servisDeskripsi").value.trim();
    const bengkel = document.querySelector("#servisBengkel").value.trim();

    if (kendaraanId === "" || tanggal === "" || deskripsi === "") {
        formServisError.textContent = "Kendaraan, tanggal, dan deskripsi wajib diisi.";
        return;
    }

    const dataServis = {
        vehicle_id: kendaraanId,
        maintenance_date: tanggal,
        description: deskripsi,
        cost: biaya ? parseFloat(biaya) : null,
        performed_by: bengkel || null
    };

    let result;

    if (servisId) {
        result = await supabaseClient
            .from("maintenance_records")
            .update(dataServis)
            .eq("id", servisId);
    } else {
        result = await supabaseClient
            .from("maintenance_records")
            .insert([dataServis]);
    }

    if (result.error) {
        console.log("Gagal menyimpan servis:", result.error.message);
        formServisError.textContent = "Data gagal disimpan. Silakan coba kembali.";
        return;
    }

    tutupModalServis();
    muatDataServis();
    alert("Catatan servis berhasil disimpan.");
});

// ============================================
// 10. TOMBOL EDIT & HAPUS
// ============================================

function pasangEventTombolServis() {

    document.querySelectorAll(".btn-edit-servis").forEach(function (tombol) {
        tombol.addEventListener("click", async function () {
            const id = tombol.getAttribute("data-id");
            await bukaModalEditServis(id);
        });
    });

    document.querySelectorAll(".btn-delete-servis").forEach(function (tombol) {
        tombol.addEventListener("click", async function () {
            const id = tombol.getAttribute("data-id");
            hapusServis(id);
        });
    });
}

async function bukaModalEditServis(id) {

    const { data, error } = await supabaseClient
        .from("maintenance_records")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        alert("Gagal mengambil data servis.");
        return;
    }

    modalServisTitle.textContent = "Edit Catatan Servis";
    formServisError.textContent = "";

    document.querySelector("#servisId").value = data.id;
    document.querySelector("#servisKendaraan").value = data.vehicle_id;
    document.querySelector("#servisTanggal").value = data.maintenance_date;
    document.querySelector("#servisBiaya").value = data.cost || "";
    document.querySelector("#servisDeskripsi").value = data.description;
    document.querySelector("#servisBengkel").value = data.performed_by || "";

    modalServis.classList.add("show");
}

async function hapusServis(id) {

    const konfirmasi = confirm("Yakin ingin menghapus catatan servis ini?");
    if (!konfirmasi) {
        return;
    }

    const { error } = await supabaseClient
        .from("maintenance_records")
        .delete()
        .eq("id", id);

    if (error) {
        console.log("Gagal menghapus:", error.message);
        alert("Data gagal dihapus. Silakan coba kembali.");
        return;
    }

    muatDataServis();
    alert("Catatan servis berhasil dihapus.");
}

console.log("maintenance.js berhasil dimuat");