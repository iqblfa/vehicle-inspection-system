// ============================================
// vehicles.js
// Logika CRUD untuk halaman Data Kendaraan
// ============================================

// 1. AUTH GUARD — jalankan dulu sebelum apapun
checkAuthGuard();
requireAdminGuard();

// 2. HAMBURGER MENU (sama seperti halaman lain)
const btnMenu = document.querySelector("#btnMenu");
const sidebar = document.querySelector("#sidebar");
btnMenu.addEventListener("click", function () {
    sidebar.classList.toggle("open");
});

// 3. LOGOUT
const btnLogout = document.querySelector("#btnLogout");
btnLogout.addEventListener("click", function () {
    logoutUser();
});

// ============================================
// 4. ELEMEN-ELEMEN YANG SERING DIPAKAI
// ============================================

const tabelBody = document.querySelector("#tabelKendaraanBody");
const modalKendaraan = document.querySelector("#modalKendaraan");
const modalTitle = document.querySelector("#modalTitle");
const formKendaraan = document.querySelector("#formKendaraan");
const formError = document.querySelector("#formError");
const btnTambahKendaraan = document.querySelector("#btnTambahKendaraan");
const btnCloseModal = document.querySelector("#btnCloseModal");
const btnBatal = document.querySelector("#btnBatal");

// ============================================
// 5. FUNGSI: MENGAMBIL & MENAMPILKAN DATA (READ)
// ============================================

async function loadVehicles() {

    tabelBody.innerHTML = `<tr><td colspan="7" class="text-center">Memuat data...</td></tr>`;

    const { data, error } = await supabaseClient
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.log("Gagal memuat data kendaraan:", error.message);
        tabelBody.innerHTML = `<tr><td colspan="7" class="text-center">Gagal memuat data.</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tabelBody.innerHTML = `<tr><td colspan="7" class="text-center">Belum ada data kendaraan.</td></tr>`;
        return;
    }

    // Mengosongkan tabel sebelum diisi ulang
    tabelBody.innerHTML = "";

    // Melakukan perulangan (loop) untuk setiap baris data
    data.forEach(function (vehicle) {

        const badgeClass = getBadgeClass(vehicle.status);

                const statusPajakTahunan = getStatusPajak(vehicle.pajak_tahunan_expiry);
        const statusStnk5Tahun = getStatusPajak(vehicle.stnk_5tahun_expiry);

        // KIR hanya relevan untuk kendaraan angkutan (Truck, Pick Up)
        const jenisWajibKir = ["Truck", "Pick Up"];
        const kendaraanWajibKir = jenisWajibKir.includes(vehicle.vehicle_type);
        const statusKir = kendaraanWajibKir ? getStatusPajak(vehicle.kir_expiry) : null;
        const kolomKir = kendaraanWajibKir
            ? `<span class="badge ${statusKir.badgeClass}">${statusKir.label}</span>`
            : `<span class="badge badge-secondary">Tidak Wajib</span>`;

        const baris = document.createElement("tr");
        baris.innerHTML = `
            <td>${vehicle.plate_number}</td>
            <td>${vehicle.brand} ${vehicle.model}</td>
            <td>${vehicle.vehicle_type}</td>
            <td>${vehicle.department || "-"}</td>
            <td><span class="badge ${badgeClass}">${vehicle.status}</span></td>
            <td><span class="badge ${statusPajakTahunan.badgeClass}">${statusPajakTahunan.label}</span></td>
            <td><span class="badge ${statusStnk5Tahun.badgeClass}">${statusStnk5Tahun.label}</span></td>
            <td>${kolomKir}</td>
            <td>${vehicle.last_odometer ? vehicle.last_odometer.toLocaleString("id-ID") + " km" : "-"}</td>
            <td>
                <button class="btn-icon btn-edit" data-id="${vehicle.id}">✏️</button>
                <button class="btn-icon danger btn-delete" data-id="${vehicle.id}">🗑️</button>
            </td>
        `;

        tabelBody.appendChild(baris);
    });

    // Memasang event listener untuk tombol edit & hapus yang baru dibuat
    pasangEventTombolAksi();
}

// Fungsi bantu: menentukan class badge sesuai status
function getBadgeClass(status) {
    if (status === "Aktif") return "badge-aktif";
    if (status === "Maintenance") return "badge-maintenance";
    return "badge-tidakaktif";
}

// Panggil fungsi ini saat halaman pertama kali dimuat
loadVehicles();

// ============================================
// 6. MEMBUKA & MENUTUP MODAL
// ============================================

function bukaModalTambah() {
    modalTitle.textContent = "Tambah Kendaraan";
    formKendaraan.reset(); // mengosongkan semua field form
    document.querySelector("#vehicleId").value = ""; // pastikan id kosong (mode tambah)
    formError.textContent = "";
    modalKendaraan.classList.add("show");
}

function tutupModal() {
    modalKendaraan.classList.remove("show");
}

btnTambahKendaraan.addEventListener("click", bukaModalTambah);
btnCloseModal.addEventListener("click", tutupModal);
btnBatal.addEventListener("click", tutupModal);

// ============================================
// 7. FUNGSI: TAMBAH / EDIT (CREATE & UPDATE)
// ============================================

formKendaraan.addEventListener("submit", async function (event) {

    event.preventDefault();

    formError.textContent = "";

    // Mengambil semua nilai dari form
    const vehicleId = document.querySelector("#vehicleId").value;
    const plateNumber = document.querySelector("#inputPlatNomor").value.trim();
    const vehicleType = document.querySelector("#inputJenis").value;
    const brand = document.querySelector("#inputMerk").value.trim();
    const model = document.querySelector("#inputModel").value.trim();
    const year = document.querySelector("#inputTahun").value;
    const color = document.querySelector("#inputWarna").value.trim();
    const chassisNumber = document.querySelector("#inputNoRangka").value.trim();
    const engineNumber = document.querySelector("#inputNoMesin").value.trim();
    const odometer = document.querySelector("#inputOdometer").value;
    const department = document.querySelector("#inputDepartemen").value.trim();
    const status = document.querySelector("#inputStatus").value;
    const pajakTahunanExpiry = document.querySelector("#inputPajakTahunan").value;
    const stnk5TahunExpiry = document.querySelector("#inputStnk5Tahun").value;
    const kirExpiry = document.querySelector("#inputKir").value;
    const notes = document.querySelector("#inputKeterangan").value.trim();

    // Validasi dasar
    if (plateNumber === "" || vehicleType === "" || brand === "" || model === "") {
        formError.textContent = "Nomor polisi, jenis, merk, dan model wajib diisi.";
        return;
    }

    // Menyusun objek data sesuai nama kolom di database
    const vehicleData = {
        plate_number: plateNumber,
        vehicle_type: vehicleType,
        brand: brand,
        model: model,
        year: year ? parseInt(year) : null,
        color: color || null,
        chassis_number: chassisNumber || null,
        engine_number: engineNumber || null,
        last_odometer: odometer ? parseInt(odometer) : 0,
        department: department || null,
        status: status,
        pajak_tahunan_expiry: pajakTahunanExpiry || null,
        stnk_5tahun_expiry: stnk5TahunExpiry || null,
        kir_expiry: kirExpiry || null,
        notes: notes || null
    };

    let result;

    if (vehicleId) {
        // MODE EDIT — vehicleId ada isinya
        result = await supabaseClient
            .from("vehicles")
            .update(vehicleData)
            .eq("id", vehicleId);
    } else {
        // MODE TAMBAH BARU — vehicleId kosong
        result = await supabaseClient
            .from("vehicles")
            .insert([vehicleData]);
    }

    if (result.error) {
        console.log("Gagal menyimpan:", result.error.message);

        // Menangani error khusus: nomor polisi duplikat
        if (result.error.message.includes("duplicate key")) {
            formError.textContent = "Nomor polisi sudah terdaftar, gunakan nomor lain.";
        } else {
            formError.textContent = "Data gagal disimpan. Silakan coba kembali.";
        }
        return;
    }

    // Berhasil
    tutupModal();
    loadVehicles(); // muat ulang tabel supaya data terbaru muncul
    alert("Data kendaraan berhasil disimpan.");

});

// ============================================
// 8. FUNGSI: TOMBOL EDIT & HAPUS (dipanggil ulang setiap render tabel)
// ============================================

function pasangEventTombolAksi() {

    // Tombol EDIT
    const tombolEdit = document.querySelectorAll(".btn-edit");
    tombolEdit.forEach(function (tombol) {
        tombol.addEventListener("click", async function () {
            const id = tombol.getAttribute("data-id");
            await bukaModalEdit(id);
        });
    });

    // Tombol HAPUS
    const tombolHapus = document.querySelectorAll(".btn-delete");
    tombolHapus.forEach(function (tombol) {
        tombol.addEventListener("click", async function () {
            const id = tombol.getAttribute("data-id");
            hapusKendaraan(id);
        });
    });
}

// ============================================
// 9. FUNGSI: MEMBUKA MODAL DALAM MODE EDIT
// ============================================

async function bukaModalEdit(id) {

    // Mengambil data kendaraan spesifik berdasarkan id
    const { data, error } = await supabaseClient
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .single(); // .single() karena kita hanya butuh SATU baris, bukan array

    if (error) {
        alert("Gagal mengambil data kendaraan.");
        return;
    }

    modalTitle.textContent = "Edit Kendaraan";
    formError.textContent = "";

    // Mengisi form dengan data yang sudah ada
    document.querySelector("#vehicleId").value = data.id;
    document.querySelector("#inputPlatNomor").value = data.plate_number;
    document.querySelector("#inputJenis").value = data.vehicle_type;
    document.querySelector("#inputMerk").value = data.brand;
    document.querySelector("#inputModel").value = data.model;
    document.querySelector("#inputTahun").value = data.year || "";
    document.querySelector("#inputWarna").value = data.color || "";
    document.querySelector("#inputNoRangka").value = data.chassis_number || "";
    document.querySelector("#inputNoMesin").value = data.engine_number || "";
    document.querySelector("#inputOdometer").value = data.last_odometer || "";
    document.querySelector("#inputDepartemen").value = data.department || "";
    document.querySelector("#inputStatus").value = data.status;
    document.querySelector("#inputPajakTahunan").value = data.pajak_tahunan_expiry || "";
    document.querySelector("#inputStnk5Tahun").value = data.stnk_5tahun_expiry || "";
    document.querySelector("#inputKir").value = data.kir_expiry || "";
    document.querySelector("#inputKeterangan").value = data.notes || "";

    modalKendaraan.classList.add("show");
}

// ============================================
// 10. FUNGSI: HAPUS KENDARAAN (DELETE)
// ============================================

async function hapusKendaraan(id) {

    // Konfirmasi dulu sebelum benar-benar menghapus
    const konfirmasi = confirm("Yakin ingin menghapus data kendaraan ini? Tindakan ini tidak dapat dibatalkan.");

    if (!konfirmasi) {
        return; // user klik "Cancel", batalkan proses hapus
    }

    const { error } = await supabaseClient
        .from("vehicles")
        .delete()
        .eq("id", id);

    if (error) {
        console.log("Gagal menghapus:", error.message);
        alert("Data gagal dihapus. Silakan coba kembali.");
        return;
    }

    loadVehicles(); // muat ulang tabel
    alert("Data kendaraan berhasil dihapus.");
}

console.log("vehicles.js berhasil dimuat");