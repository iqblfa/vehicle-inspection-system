// ============================================
// inspection.js
// Logika untuk Form Pengecekan Kendaraan
// ============================================

// 1. AUTH GUARD, HAMBURGER MENU, LOGOUT (pola sama seperti halaman lain)
checkAuthGuard();
sesuaikanSidebarSesuaiRole();


// ============================================
// PHASE 21: DETEKSI STATUS KONEKSI ONLINE/OFFLINE
// ============================================

function updateStatusKoneksi() {

    const statusEl = document.querySelector("#statusKoneksi");

    if (navigator.onLine) {
        statusEl.textContent = "🟢 Online";
        statusEl.classList.remove("status-offline");
        statusEl.classList.add("status-online");
    } else {
        statusEl.textContent = "🔴 Offline - Data akan disimpan sementara di perangkat ini";
        statusEl.classList.remove("status-online");
        statusEl.classList.add("status-offline");
    }
}

// Cek status saat halaman pertama kali dimuat
updateStatusKoneksi();

// Cek ulang setiap kali status berubah (browser otomatis memberi tahu lewat event ini)
window.addEventListener("online", function () {
    updateStatusKoneksi();
    sinkronkanDataTertunda(); // langsung coba sinkronisasi begitu online kembali
});

window.addEventListener("offline", updateStatusKoneksi);

// ============================================
// PHASE 21: MENAMPILKAN JUMLAH DATA YANG TERTUNDA
// ============================================

async function updateJumlahTertunda() {

    const jumlah = await hitungInspeksiTertunda();
    const statusTertundaEl = document.querySelector("#statusTertunda");
    const jumlahEl = document.querySelector("#jumlahTertunda");

    if (jumlah > 0) {
        jumlahEl.textContent = jumlah;
        statusTertundaEl.style.display = "block";
    } else {
        statusTertundaEl.style.display = "none";
    }
}

updateJumlahTertunda();

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
// 2. DATA CHECKLIST (7 kategori, 48 item total)
//    Ini BUKAN data dari database, murni data JavaScript
//    yang kita tulis sendiri untuk "cetakan" form.
// ============================================

const CHECKLIST_DATA = [
    {
        category: "Mesin",
        items: [
            "Oli mesin", "Air radiator", "Air aki", "Kondisi mesin",
            "Kebocoran oli", "Kebocoran coolant", "Suara mesin abnormal"
        ]
    },
    {
        category: "Ban",
        items: [
            "Ban depan kiri", "Ban depan kanan", "Ban belakang kiri",
            "Ban belakang kanan", "Ban serep", "Tekanan ban", "Kondisi tapak ban"
        ]
    },
    {
        category: "Rem",
        items: [
            "Rem kaki", "Rem tangan", "Kondisi minyak rem", "Suara rem"
        ]
    },
    {
        category: "Lampu",
        items: [
            "Lampu utama", "Lampu jauh", "Lampu dekat", "Lampu sein kiri",
            "Lampu sein kanan", "Lampu rem", "Lampu mundur", "Lampu hazard"
        ]
    },
    {
        category: "Body",
        items: [
            "Body depan", "Body belakang", "Body kiri", "Body kanan",
            "Kap mesin", "Pintu", "Kaca", "Spion", "Wiper"
        ]
    },
    {
        category: "Interior",
        items: [
            "Dashboard", "AC", "Seat belt", "Jok", "Klakson", "Audio", "Panel indikator"
        ]
    },
    {
        category: "Perlengkapan",
        items: [
            "Dongkrak", "Kunci roda", "Segitiga pengaman", "APAR", "Kotak P3K", "Ban serep cadangan"
        ]
    }
];

// Daftar pilihan status yang akan dipakai di setiap dropdown item
const STATUS_OPTIONS = ["Baik", "Perlu Perhatian", "Rusak", "Tidak Ada/Tidak Berlaku"];

// ============================================
// DATA FOTO WAJIB (5 sudut kendaraan)
// ============================================

const PHOTO_TYPES = [
    { key: "Depan", label: "Foto Depan" },
    { key: "Belakang", label: "Foto Belakang" },
    { key: "Kiri", label: "Foto Sisi Kiri" },
    { key: "Kanan", label: "Foto Sisi Kanan" },
    { key: "Odometer", label: "Foto Odometer" }
];

// Objek untuk menyimpan file foto yang dipilih user, sebelum diupload
// Contoh isi setelah user pilih foto: { Depan: File, Belakang: File, ... }
const selectedPhotos = {};

// Objek untuk menyimpan file foto kerusakan per item, key-nya idUnik item
const selectedDamagePhotos = {};

// ============================================
// FUNGSI: MENGGAMBAR 5 KOTAK FOTO WAJIB
// ============================================

function renderPhotoGrid() {

    const photoGrid = document.querySelector("#photoGrid");
    photoGrid.innerHTML = "";

    PHOTO_TYPES.forEach(function (jenisFoto) {

        const kotak = document.createElement("div");
        kotak.className = "photo-box";
        kotak.id = "photobox-" + jenisFoto.key;

        kotak.innerHTML = `
            <div class="photo-box-label">${jenisFoto.label} *</div>
            <div class="photo-box-preview" id="preview-${jenisFoto.key}">Belum ada foto</div>
            <input type="file" accept="image/*" capture="environment" id="file-${jenisFoto.key}">
            <div class="photo-upload-status" id="filestatus-${jenisFoto.key}"></div>
        `;

        photoGrid.appendChild(kotak);
    });

    // Pasang event listener untuk setiap input file yang baru dibuat
    PHOTO_TYPES.forEach(function (jenisFoto) {
        const inputFile = document.querySelector("#file-" + jenisFoto.key);

        inputFile.addEventListener("change", function () {
            handlePilihFoto(jenisFoto.key, inputFile);
        });
    });
}

// ============================================
// FUNGSI: SAAT USER MEMILIH FOTO (belum upload, baru preview)
// ============================================

function handlePilihFoto(jenisKey, inputFile) {

    const file = inputFile.files[0]; // ambil file pertama yang dipilih

    if (!file) {
        return;
    }

    // ============================================
// FUNGSI: SAAT USER MEMILIH FOTO KERUSAKAN (per item)
// ============================================

function handlePilihFotoKerusakan(idUnik, inputFile) {

    const file = inputFile.files[0];

    if (!file) {
        return;
    }

    const maksimalUkuran = 5 * 1024 * 1024;
    if (file.size > maksimalUkuran) {
        alert("Ukuran foto terlalu besar. Maksimal 5 MB.");
        inputFile.value = "";
        return;
    }

    selectedDamagePhotos[idUnik] = file;

    const reader = new FileReader();
    reader.onload = function (event) {
        const preview = document.querySelector("#damage-preview-" + idUnik);
        preview.innerHTML = `<img src="${event.target.result}" alt="Foto kerusakan">`;
    };
    reader.readAsDataURL(file);
}

    // Validasi ukuran file, maksimal 5 MB
    const maksimalUkuran = 5 * 1024 * 1024; // 5 MB dalam byte
    if (file.size > maksimalUkuran) {
        alert("Ukuran foto terlalu besar. Maksimal 5 MB.");
        inputFile.value = ""; // kosongkan input
        return;
    }

    // Simpan file ke objek selectedPhotos, supaya bisa diupload nanti saat submit
    selectedPhotos[jenisKey] = file;

    // Menampilkan preview foto memakai FileReader
    const reader = new FileReader();
    reader.onload = function (event) {
        const preview = document.querySelector("#preview-" + jenisKey);
        preview.innerHTML = `<img src="${event.target.result}" alt="${jenisKey}">`;

        const kotak = document.querySelector("#photobox-" + jenisKey);
        kotak.classList.add("filled");
    };
    reader.readAsDataURL(file);
}

renderPhotoGrid();

// ============================================
// 3. FUNGSI: MENGGAMBAR CHECKLIST KE HALAMAN
// ============================================

let itemCounter = 0; // penghitung untuk membuat id unik tiap item

function renderChecklist() {

    const container = document.querySelector("#checklistContainer");
    container.innerHTML = "";
    itemCounter = 0;

    CHECKLIST_DATA.forEach(function (kategori) {

        const kartuKategori = document.createElement("div");
        kartuKategori.className = "checklist-category";

        const judulKategori = document.createElement("div");
        judulKategori.className = "checklist-category-title";
        judulKategori.textContent = kategori.category;
        kartuKategori.appendChild(judulKategori);

        kategori.items.forEach(function (namaItem) {

            const idUnik = "item-" + itemCounter;
            itemCounter = itemCounter + 1;

            const baris = document.createElement("div");
            baris.className = "checklist-item";

            let optionsHTML = `<option value="">-- Pilih Status --</option>`;
            STATUS_OPTIONS.forEach(function (statusOpsi) {
                optionsHTML += `<option value="${statusOpsi}">${statusOpsi}</option>`;
            });

            // Sekarang setiap baris berisi 2 bagian:
            // 1. Nama item + dropdown status (selalu terlihat)
            // 2. Blok kerusakan (tersembunyi, muncul jika status = "Rusak")
            baris.innerHTML = `
                <span class="checklist-item-name">${namaItem}</span>
                <select class="checklist-item-status item-status"
                        id="status-${idUnik}"
                        data-category="${kategori.category}"
                        data-item="${namaItem}"
                        data-id="${idUnik}">
                    ${optionsHTML}
                </select>
                <div class="damage-detail" id="damage-${idUnik}">
                    <div>
                        <label for="desc-${idUnik}">Deskripsi Kerusakan *</label>
                        <textarea id="desc-${idUnik}" rows="2" placeholder="Jelaskan kerusakan yang ditemukan..."></textarea>
                    </div>
                    <div>
                        <label for="severity-${idUnik}">Tingkat Kerusakan *</label>
                        <select id="severity-${idUnik}">
                            <option value="">-- Pilih Tingkat --</option>
                            <option value="Minor">Minor</option>
                            <option value="Moderate">Moderate</option>
                            <option value="Major">Major</option>
                            <option value="Critical">Critical</option>
                        </select>
                    </div>
                    <div class="photo-box damage-photo-box">
                        <div class="photo-box-label">Foto Kerusakan (opsional)</div>
                        <div class="photo-box-preview" id="damage-preview-${idUnik}">Belum ada foto</div>
                        <input type="file" accept="image/*" capture="environment" id="damage-file-${idUnik}">
                    </div>
                </div>
            `;

            kartuKategori.appendChild(baris);

            // Pasang event listener untuk kotak foto kerusakan item ini
            const inputFileKerusakan = baris.querySelector("#damage-file-" + idUnik);
            inputFileKerusakan.addEventListener("change", function () {
                handlePilihFotoKerusakan(idUnik, inputFileKerusakan);
            });
        });

        container.appendChild(kartuKategori);
    });

    pasangWarnaStatus();
}

// ============================================
// 4. FUNGSI: MENGUBAH WARNA DROPDOWN + TAMPILKAN/SEMBUNYIKAN FIELD KERUSAKAN
// ============================================

function pasangWarnaStatus() {
    const semuaDropdownStatus = document.querySelectorAll(".item-status");

    semuaDropdownStatus.forEach(function (dropdown) {
        dropdown.addEventListener("change", function () {

            dropdown.classList.remove("status-baik", "status-perhatian", "status-rusak");

            const idUnik = dropdown.getAttribute("data-id");
            const blokKerusakan = document.querySelector("#damage-" + idUnik);

            if (dropdown.value === "Baik") {
                dropdown.classList.add("status-baik");
                blokKerusakan.classList.remove("show");
            } else if (dropdown.value === "Perlu Perhatian") {
                dropdown.classList.add("status-perhatian");
                blokKerusakan.classList.remove("show");
            } else if (dropdown.value === "Rusak") {
                dropdown.classList.add("status-rusak");
                blokKerusakan.classList.add("show"); // MUNCULKAN blok kerusakan
            } else {
                blokKerusakan.classList.remove("show");
            }
        });
    });
}

// Panggil fungsi render saat halaman pertama kali dimuat
renderChecklist();

// ============================================
// 5. MENGISI TANGGAL & JAM OTOMATIS DENGAN WAKTU SEKARANG
// ============================================

function isiTanggalJamSekarang() {
    const sekarang = new Date();

    // Format tanggal jadi YYYY-MM-DD (format yang diminta input type="date")
    const tahun = sekarang.getFullYear();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
    const tanggal = String(sekarang.getDate()).padStart(2, "0");
    document.querySelector("#inputTanggal").value = `${tahun}-${bulan}-${tanggal}`;

    // Format jam jadi HH:MM (format yang diminta input type="time")
    const jam = String(sekarang.getHours()).padStart(2, "0");
    const menit = String(sekarang.getMinutes()).padStart(2, "0");
    document.querySelector("#inputJam").value = `${jam}:${menit}`;
}

isiTanggalJamSekarang();

// ============================================
// 6. MENGISI NAMA PEMERIKSA OTOMATIS (dari profil user yang login)
// ============================================

async function isiNamaPemeriksa() {

    const { data: userData } = await supabaseClient.auth.getUser();

    if (!userData.user) {
        return; // Seharusnya tidak terjadi karena sudah ada auth guard, tapi jaga-jaga
    }

    const { data: profileData, error } = await supabaseClient
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user.id)
        .single();

    if (error) {
        console.log("Gagal mengambil nama profil:", error.message);
        return;
    }

    document.querySelector("#inputPemeriksa").value = profileData.full_name;
}

isiNamaPemeriksa();

// ============================================
// 7. MENGISI DROPDOWN KENDARAAN (dari tabel vehicles)
// ============================================

async function isiDropdownKendaraan() {

    const dropdownKendaraan = document.querySelector("#inputKendaraan");

    const { data, error } = await supabaseClient
        .from("vehicles")
        .select("id, plate_number, brand, model")
        .order("plate_number", { ascending: true });

    if (error) {
        console.log("Gagal memuat data kendaraan:", error.message);
        dropdownKendaraan.innerHTML = `<option value="">-- Gagal memuat data --</option>`;
        return;
    }

    if (data.length === 0) {
        dropdownKendaraan.innerHTML = `<option value="">-- Belum ada data kendaraan --</option>`;
        return;
    }

    dropdownKendaraan.innerHTML = `<option value="">-- Pilih Kendaraan --</option>`;

    data.forEach(function (kendaraan) {
        const opsi = document.createElement("option");
        opsi.value = kendaraan.id;
        opsi.textContent = `${kendaraan.plate_number} - ${kendaraan.brand} ${kendaraan.model}`;
        dropdownKendaraan.appendChild(opsi);
    });
}

isiDropdownKendaraan();

// ============================================
// 8. FUNGSI: MENGHITUNG HASIL EVALUASI OTOMATIS
// ============================================

function hitungHasilEvaluasi(hasilChecklist) {

    let adaRusak = false;
    let adaPerhatian = false;
    let jumlahTemuan = 0;

    hasilChecklist.forEach(function (item) {
        if (item.status === "Rusak") {
            adaRusak = true;
            jumlahTemuan = jumlahTemuan + 1;
        } else if (item.status === "Perlu Perhatian") {
            adaPerhatian = true;
            jumlahTemuan = jumlahTemuan + 1;
        }
        // status "Baik" dan "Tidak Ada/Tidak Berlaku" tidak dihitung sebagai temuan
    });

    let hasilAkhir;

    if (adaRusak) {
        hasilAkhir = "TIDAK LAYAK DIGUNAKAN";
    } else if (adaPerhatian) {
        hasilAkhir = "PERLU PERHATIAN";
    } else {
        hasilAkhir = "LAYAK DIGUNAKAN";
    }

    return {
        hasil: hasilAkhir,
        jumlahTemuan: jumlahTemuan
    };
}

// ============================================
// 9. VALIDASI & SUBMIT FORM (simpan sungguhan ke database)
// ============================================

const formInspeksi = document.querySelector("#formInspeksi");
const formInspeksiError = document.querySelector("#formInspeksiError");
const btnSubmitInspeksi = document.querySelector("#btnSubmitInspeksi");

// ============================================
// FUNGSI: UPLOAD SATU FILE FOTO KE SUPABASE STORAGE
// Mengembalikan URL publik jika berhasil, atau null jika gagal
// ============================================

async function uploadFoto(file, namaFile) {

    const { data, error } = await supabaseClient
        .storage
        .from("inspection-photos")
        .upload(namaFile, file);

    if (error) {
        console.log("Gagal upload foto (" + namaFile + "):", error.message);
        return null;
    }

    // Mengambil URL publik dari file yang baru diupload
    const { data: urlData } = supabaseClient
        .storage
        .from("inspection-photos")
        .getPublicUrl(namaFile);

    return urlData.publicUrl;
}

// ============================================
// FUNGSI: MEMBUAT NOMOR LAPORAN UNIK
// Format: DMG-20260815-143022-0 (tanggal-jam-urutan)
// ============================================

function generateNomorLaporan(urutan) {
    const sekarang = new Date();
    const tahun = sekarang.getFullYear();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
    const tanggal = String(sekarang.getDate()).padStart(2, "0");
    const jam = String(sekarang.getHours()).padStart(2, "0");
    const menit = String(sekarang.getMinutes()).padStart(2, "0");
    const detik = String(sekarang.getSeconds()).padStart(2, "0");
    return `DMG-${tahun}${bulan}${tanggal}-${jam}${menit}${detik}-${urutan}`;
}

// ============================================
// FUNGSI: MEMBUAT LAPORAN KERUSAKAN OTOMATIS
// Dipanggil setelah inspeksi berhasil disimpan.
// Mengambil semua item berstatus "Rusak", masing-masing dijadikan 1 laporan.
// ============================================

async function buatLaporanKerusakanOtomatis(hasilChecklist, vehicleId, inspectionId, reporterId) {

    // Saring hanya item yang berstatus "Rusak"
    const itemRusak = hasilChecklist.filter(function (item) {
        return item.status === "Rusak";
    });

    if (itemRusak.length === 0) {
        return; // tidak ada kerusakan, tidak perlu buat laporan apapun
    }

    // Menyusun 1 baris laporan untuk setiap item rusak
    const laporanUntukDisimpan = itemRusak.map(function (item, index) {
        return {
            report_number: generateNomorLaporan(index),
            inspection_id: inspectionId,
            vehicle_id: vehicleId,
            reporter_id: reporterId,
            damage_description: `[${item.category} - ${item.item_name}] ${item.notes}`,
            damage_location: item.category,
            severity: item.severity,
            status: "Open"
        };
    });

    const { error } = await supabaseClient
        .from("damage_reports")
        .insert(laporanUntukDisimpan);

    if (error) {
        console.log("Gagal membuat laporan kerusakan otomatis:", error.message);
        // Tidak menghentikan proses utama, cukup dicatat di Console
    } else {
        console.log(`${laporanUntukDisimpan.length} laporan kerusakan berhasil dibuat otomatis.`);
    }
}

formInspeksi.addEventListener("submit", async function (event) {

    event.preventDefault();

    formInspeksiError.textContent = "";

    // --- Validasi field header ---
    const tanggal = document.querySelector("#inputTanggal").value;
    const jam = document.querySelector("#inputJam").value;
    const kendaraanId = document.querySelector("#inputKendaraan").value;
    const odometer = document.querySelector("#inputOdometer").value;
    const lokasi = document.querySelector("#inputLokasi").value;

    if (tanggal === "" || jam === "" || kendaraanId === "" || odometer === "") {
        formInspeksiError.textContent = "Tanggal, jam, kendaraan, dan odometer wajib diisi.";
        window.scrollTo(0, 0);
        return;
    }

    // --- Validasi semua checklist harus terisi ---
    const semuaDropdownStatus = document.querySelectorAll(".item-status");
    let semuaTerisi = true;
    let jumlahBelumDiisi = 0;

    semuaDropdownStatus.forEach(function (dropdown) {
        if (dropdown.value === "") {
            semuaTerisi = false;
            jumlahBelumDiisi = jumlahBelumDiisi + 1;
            dropdown.style.borderColor = "#dc2626";
        }
    });

    if (!semuaTerisi) {
        formInspeksiError.textContent = `Masih ada ${jumlahBelumDiisi} item checklist yang belum diisi statusnya.`;
        return;
    }

    // --- Mengumpulkan data checklist, SEKALIGUS validasi field kerusakan ---
    const hasilChecklist = [];
    let deskripsiKerusakanKosong = false;
    let tingkatKerusakanKosong = false;

    semuaDropdownStatus.forEach(function (dropdown) {

        const idUnik = dropdown.getAttribute("data-id");
        const status = dropdown.value;

        let deskripsi = null;
        let tingkat = null;

        // Jika statusnya "Rusak", ambil dan validasi field deskripsi + tingkat
        if (status === "Rusak") {
            const inputDeskripsi = document.querySelector("#desc-" + idUnik);
            const inputTingkat = document.querySelector("#severity-" + idUnik);

            deskripsi = inputDeskripsi.value.trim();
            tingkat = inputTingkat.value;

            if (deskripsi === "") {
                deskripsiKerusakanKosong = true;
                inputDeskripsi.style.borderColor = "#dc2626";
            }
            if (tingkat === "") {
                tingkatKerusakanKosong = true;
                inputTingkat.style.borderColor = "#dc2626";
            }
        }

        hasilChecklist.push({
            category: dropdown.getAttribute("data-category"),
            item_name: dropdown.getAttribute("data-item"),
            status: status,
            notes: deskripsi,
            severity: tingkat
        });
    });

    if (deskripsiKerusakanKosong || tingkatKerusakanKosong) {
        formInspeksiError.textContent = "Untuk setiap item berstatus 'Rusak', deskripsi dan tingkat kerusakan wajib diisi.";
        return;
    }

    // --- Validasi 5 foto wajib sudah dipilih ---
    let fotoLengkap = true;
    PHOTO_TYPES.forEach(function (jenisFoto) {
        if (!selectedPhotos[jenisFoto.key]) {
            fotoLengkap = false;
        }
    });

    if (!fotoLengkap) {
        formInspeksiError.textContent = "Semua foto wajib (Depan, Belakang, Kiri, Kanan, Odometer) harus diisi.";
        return;
    }

    // --- Menghitung hasil evaluasi otomatis ---
    const evaluasi = hitungHasilEvaluasi(hasilChecklist);

    // --- Ambil id user yang sedang login (untuk kolom inspector_id) ---
    const { data: userData } = await supabaseClient.auth.getUser();
    const inspectorId = userData.user.id;

    // --- Loading state ---
    btnSubmitInspeksi.disabled = true;
    btnSubmitInspeksi.textContent = "Menyimpan...";

    // --- PHASE 21: Jika sedang OFFLINE, simpan ke IndexedDB, JANGAN lanjut ke Supabase ---
    if (!navigator.onLine) {

        const dataUntukOffline = {
            vehicle_id: kendaraanId,
            inspector_id: inspectorId,
            inspection_date: tanggal,
            inspection_time: jam,
            odometer: parseInt(odometer),
            location: lokasi || null,
            overall_result: evaluasi.hasil,
            findings_count: evaluasi.jumlahTemuan,
            checklist: hasilChecklist,
            // Catatan: foto TIDAK disimpan offline pada versi ini (keterbatasan disebutkan di awal Phase),
            // karena file foto berukuran besar kurang cocok untuk IndexedDB versi dasar ini.
            // Untuk sementara, field foto akan kosong jika inspeksi ini disinkronkan nanti.
            disimpan_pada: new Date().toISOString()
        };

        await simpanInspeksiOffline(dataUntukOffline);

        btnSubmitInspeksi.disabled = false;
        btnSubmitInspeksi.textContent = "Simpan Pengecekan";

        await updateJumlahTertunda();

        alert("Tidak ada koneksi internet. Data pengecekan disimpan sementara di perangkat ini, dan akan otomatis dikirim saat internet kembali tersedia.");

        formInspeksi.reset();
        window.location.reload(); // muat ulang form supaya siap dipakai lagi

        return; // hentikan di sini, tidak lanjut ke proses Supabase di bawah
    }

    // --- LANGKAH A: Insert ke tabel "inspections" (header) ---
    const { data: inspeksiBaru, error: errorInspeksi } = await supabaseClient
        .from("inspections")
        .insert([{
            vehicle_id: kendaraanId,
            inspector_id: inspectorId,
            inspection_date: tanggal,
            inspection_time: jam,
            odometer: parseInt(odometer),
            location: lokasi || null,
            overall_result: evaluasi.hasil,
            findings_count: evaluasi.jumlahTemuan
        }])
        .select() // supaya kita dapat kembali data yang baru dibuat, termasuk id-nya
        .single();

    if (errorInspeksi) {
        console.log("Gagal menyimpan header inspeksi:", errorInspeksi.message);
        formInspeksiError.textContent = "Data gagal disimpan. Silakan coba kembali.";
        btnSubmitInspeksi.disabled = false;
        btnSubmitInspeksi.textContent = "Simpan Pengecekan";
        return;
    }

    // --- LANGKAH B: Upload 5 foto wajib ke Storage, lalu simpan URL ke inspection_photos ---
    btnSubmitInspeksi.textContent = "Mengupload foto...";

    const dataFotoUntukDisimpan = [];

    for (const jenisFoto of PHOTO_TYPES) {

        const file = selectedPhotos[jenisFoto.key];
        // Membuat nama file unik: id-inspeksi + jenis-foto + waktu upload
        const namaFileUnik = inspeksiBaru.id + "-" + jenisFoto.key + "-" + Date.now() + ".jpg";

        const urlFoto = await uploadFoto(file, namaFileUnik);

        if (urlFoto) {
            dataFotoUntukDisimpan.push({
                inspection_id: inspeksiBaru.id,
                photo_type: jenisFoto.key,
                photo_url: urlFoto
            });
        }
    }

    // --- Upload foto kerusakan (jika ada) ---
    for (const idUnik in selectedDamagePhotos) {
        const file = selectedDamagePhotos[idUnik];
        const namaFileUnik = inspeksiBaru.id + "-Kerusakan-" + idUnik + "-" + Date.now() + ".jpg";

        const urlFoto = await uploadFoto(file, namaFileUnik);

        if (urlFoto) {
            dataFotoUntukDisimpan.push({
                inspection_id: inspeksiBaru.id,
                photo_type: "Kerusakan",
                photo_url: urlFoto
            });
        }
    }

    // Menyimpan semua record foto ke tabel inspection_photos (jika ada yang berhasil diupload)
    if (dataFotoUntukDisimpan.length > 0) {
        const { error: errorFoto } = await supabaseClient
            .from("inspection_photos")
            .insert(dataFotoUntukDisimpan);

        if (errorFoto) {
            console.log("Sebagian/semua foto gagal disimpan ke database:", errorFoto.message);
            // Kita TIDAK menghentikan proses di sini, karena data inspeksi utama
            // sudah lebih penting untuk tetap tersimpan. Foto yang gagal bisa
            // ditambahkan manual nanti (fitur ini bisa dikembangkan di masa depan).
        }
    }

    btnSubmitInspeksi.textContent = "Menyimpan data...";

    // --- LANGKAH C: Menyiapkan 48 baris untuk tabel "inspection_items" ---
    // Setiap item checklist diberi tambahan inspection_id yang baru saja kita dapat
    const itemsUntukDisimpan = hasilChecklist.map(function (item) {
        return {
            inspection_id: inspeksiBaru.id,
            category: item.category,
            item_name: item.item_name,
            status: item.status,
            notes: item.notes,
            severity: item.severity
        };
    });

    // --- LANGKAH C: Insert semua 48 item sekaligus ---
    const { error: errorItems } = await supabaseClient
        .from("inspection_items")
        .insert(itemsUntukDisimpan);

    btnSubmitInspeksi.disabled = false;
    btnSubmitInspeksi.textContent = "Simpan Pengecekan";

    if (errorItems) {
        console.log("Gagal menyimpan detail checklist:", errorItems.message);
        formInspeksiError.textContent = "Header tersimpan, tetapi detail checklist gagal disimpan. Hubungi admin.";
        return;
    }

    // --- LANGKAH TAMBAHAN: Membuat laporan kerusakan otomatis (jika ada item "Rusak") ---
    await buatLaporanKerusakanOtomatis(hasilChecklist, kendaraanId, inspeksiBaru.id, inspectorId);

    // --- BERHASIL: tampilkan banner hasil evaluasi ---
    tampilkanHasilEvaluasi(evaluasi.hasil, evaluasi.jumlahTemuan);

});

// ============================================
// 10. FUNGSI: MENAMPILKAN BANNER HASIL EVALUASI
// ============================================

function tampilkanHasilEvaluasi(hasil, jumlahTemuan) {

    // Sembunyikan form, tampilkan banner
    formInspeksi.style.display = "none";

    const resultBanner = document.querySelector("#resultBanner");
    const resultIcon = document.querySelector("#resultIcon");
    const resultTitle = document.querySelector("#resultTitle");
    const resultSubtitle = document.querySelector("#resultSubtitle");

    resultBanner.classList.remove("result-layak", "result-perhatian", "result-tidaklayak");

    if (hasil === "LAYAK DIGUNAKAN") {
        resultIcon.textContent = "🟢";
        resultBanner.classList.add("result-layak");
    } else if (hasil === "PERLU PERHATIAN") {
        resultIcon.textContent = "🟡";
        resultBanner.classList.add("result-perhatian");
    } else {
        resultIcon.textContent = "🔴";
        resultBanner.classList.add("result-tidaklayak");
    }

    resultTitle.textContent = hasil;
    resultSubtitle.textContent = "Data pengecekan berhasil disimpan. Ditemukan " + jumlahTemuan + " item yang memerlukan perhatian/perbaikan.";

    resultBanner.classList.add("show");
    window.scrollTo(0, 0);
}

// ============================================
// 11. TOMBOL "BUAT PENGECEKAN BARU" (reset halaman)
// ============================================

document.querySelector("#btnInspeksiBaru").addEventListener("click", function () {
    window.location.reload(); // cara paling sederhana: muat ulang halaman dari awal
});

console.log("inspection.js berhasil dimuat");


// ============================================
// PHASE 21: SINKRONISASI DATA TERTUNDA KE SUPABASE
// ============================================

async function sinkronkanDataTertunda() {

    if (!navigator.onLine) {
        return; // jaga-jaga, jangan coba sinkron kalau ternyata masih offline
    }

    const semuaDataTertunda = await ambilSemuaInspeksiOffline();

    if (semuaDataTertunda.length === 0) {
        return; // tidak ada yang perlu disinkronkan
    }

    console.log(`Menyinkronkan ${semuaDataTertunda.length} data pengecekan tertunda...`);

    for (const dataTertunda of semuaDataTertunda) {

        try {
            // LANGKAH A: Insert header ke tabel inspections
            const { data: inspeksiBaru, error: errorInspeksi } = await supabaseClient
                .from("inspections")
                .insert([{
                    vehicle_id: dataTertunda.vehicle_id,
                    inspector_id: dataTertunda.inspector_id,
                    inspection_date: dataTertunda.inspection_date,
                    inspection_time: dataTertunda.inspection_time,
                    odometer: dataTertunda.odometer,
                    location: dataTertunda.location,
                    overall_result: dataTertunda.overall_result,
                    findings_count: dataTertunda.findings_count
                }])
                .select()
                .single();

            if (errorInspeksi) {
                console.log("Gagal sinkron header (akan dicoba lagi nanti):", errorInspeksi.message);
                continue; // lewati data ini, coba yang lain, jangan hapus dari IndexedDB
            }

            // LANGKAH B: Insert detail checklist
            const itemsUntukDisimpan = dataTertunda.checklist.map(function (item) {
                return {
                    inspection_id: inspeksiBaru.id,
                    category: item.category,
                    item_name: item.item_name,
                    status: item.status,
                    notes: item.notes,
                    severity: item.severity
                };
            });

            await supabaseClient.from("inspection_items").insert(itemsUntukDisimpan);

            // LANGKAH C: Buat laporan kerusakan otomatis (jika ada)
            await buatLaporanKerusakanOtomatis(
                dataTertunda.checklist,
                dataTertunda.vehicle_id,
                inspeksiBaru.id,
                dataTertunda.inspector_id
            );

            // BERHASIL: hapus dari IndexedDB karena sudah tidak tertunda lagi
            await hapusInspeksiOffline(dataTertunda.localId);

            console.log("Berhasil menyinkronkan 1 data pengecekan (dibuat pada:", dataTertunda.disimpan_pada, ")");

        } catch (error) {
            console.log("Terjadi kesalahan saat sinkronisasi:", error);
            // Data TETAP di IndexedDB, akan dicoba lagi di kesempatan berikutnya
        }
    }

    await updateJumlahTertunda();

    if (semuaDataTertunda.length > 0) {
        alert(`Sinkronisasi selesai. Data pengecekan yang tertunda telah dikirim ke server.`);
    }
}

// Coba sinkronisasi juga saat halaman pertama kali dimuat (jaga-jaga ada data tertunda dari sesi sebelumnya)
if (navigator.onLine) {
    sinkronkanDataTertunda();
}