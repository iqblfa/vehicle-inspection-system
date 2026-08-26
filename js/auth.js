// ============================================
// auth.js
// Logika login (login.html) dan cek status login (halaman lain).
// ============================================

const formLogin = document.querySelector("#formLogin");

// Kode di bawah ini HANYA berjalan jika elemen #formLogin ditemukan
// (artinya kita sedang berada di login.html)
if (formLogin) {

    const loginError = document.querySelector("#loginError");
    const btnLoginEl = document.querySelector(".btn-login");

    formLogin.addEventListener("submit", async function (event) {

        event.preventDefault();

        const email = document.querySelector("#inputEmail").value;
        const password = document.querySelector("#inputPassword").value;

        loginError.textContent = "";
        loginError.style.color = "#dc2626";

        if (email === "" || password === "") {
            loginError.textContent = "Email dan password wajib diisi.";
            return;
        }

        if (password.length < 6) {
            loginError.textContent = "Password minimal 6 karakter.";
            return;
        }

        btnLoginEl.disabled = true;
        btnLoginEl.textContent = "Memproses...";

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        btnLoginEl.disabled = false;
        btnLoginEl.textContent = "Masuk";

        if (error) {
            console.log("Login gagal:", error.message);
            loginError.textContent = "Email atau password salah.";
            return;
        }

        console.log("Login berhasil:", data.user.email);
        window.location.href = "dashboard.html";

    });

}


// ============================================
// PHASE 25: LOGIKA REGISTRASI AKUN BARU (register.html)
// ============================================

const formRegister = document.querySelector("#formRegister");

// Kode di bawah ini HANYA berjalan jika elemen #formRegister ditemukan
// (artinya kita sedang berada di register.html)
if (formRegister) {

    const registerError = document.querySelector("#registerError");
    const registerSuccess = document.querySelector("#registerSuccess");
    const btnRegister = document.querySelector(".btn-login");

    formRegister.addEventListener("submit", async function (event) {

        event.preventDefault();

        registerError.textContent = "";
        registerSuccess.classList.remove("show");

        // Mengambil semua nilai dari form
        const namaLengkap = document.querySelector("#inputNamaLengkap").value.trim();
        const email = document.querySelector("#inputEmailRegister").value.trim();
        const departemen = document.querySelector("#inputDepartemen").value.trim();
        const password = document.querySelector("#inputPasswordRegister").value;
        const konfirmasiPassword = document.querySelector("#inputKonfirmasiPassword").value;

        // --- Validasi dasar ---
        if (namaLengkap === "" || email === "" || password === "") {
            registerError.textContent = "Nama lengkap, email, dan password wajib diisi.";
            return;
        }

        if (password.length < 6) {
            registerError.textContent = "Password minimal 6 karakter.";
            return;
        }

        if (password !== konfirmasiPassword) {
            registerError.textContent = "Konfirmasi password tidak cocok dengan password.";
            return;
        }

        // --- Loading state ---
        btnRegister.disabled = true;
        btnRegister.textContent = "Mendaftarkan...";

        // --- LANGKAH A: Membuat akun lewat Supabase Authentication ---
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (error) {
            btnRegister.disabled = false;
            btnRegister.textContent = "Daftar";

            console.log("Gagal mendaftar:", error.message);

            // Menangani error khusus: email sudah terdaftar
            if (error.message.includes("already registered") || error.message.includes("already been registered")) {
                registerError.textContent = "Email ini sudah terdaftar. Silakan masuk lewat halaman login.";
            } else {
                registerError.textContent = "Pendaftaran gagal. Silakan coba kembali.";
            }
            return;
        }

        // --- LANGKAH B: Membuat baris profile terkait (role otomatis "driver") ---
        const { error: errorProfile } = await supabaseClient
            .from("profiles")
            .insert([{
                id: data.user.id,
                full_name: namaLengkap,
                role: "driver", // SELALU driver, tidak bisa dipilih user, demi keamanan
                department: departemen || null
            }]);

        btnRegister.disabled = false;
        btnRegister.textContent = "Daftar";

        if (errorProfile) {
            console.log("Gagal membuat profile:", errorProfile.message);
            registerError.textContent = "Akun berhasil dibuat, tetapi terjadi masalah pada data profil. Silakan hubungi admin.";
            return;
        }

        // --- BERHASIL ---
        formRegister.reset();

        // Cek apakah email confirmation dibutuhkan (session kosong = perlu konfirmasi dulu)
        if (data.session) {
            // Tidak perlu konfirmasi email, langsung bisa login
            registerSuccess.textContent = "Pendaftaran berhasil! Anda akan diarahkan ke halaman login...";
            registerSuccess.classList.add("show");
            setTimeout(function () {
                window.location.href = "login.html";
            }, 2000);
        } else {
            // Perlu konfirmasi email dulu
            registerSuccess.textContent = "Pendaftaran berhasil! Silakan cek email Anda (" + email + ") dan klik link konfirmasi sebelum bisa masuk.";
            registerSuccess.classList.add("show");
        }

    });

}

// ============================================
// FUNGSI CEK STATUS LOGIN (dipakai di halaman selain login.html)
// ============================================

async function checkAuthGuard() {
    const { data } = await supabaseClient.auth.getSession();

    if (!data.session) {
        window.location.href = "login.html";
    }
}

// ============================================
// FUNGSI: MENGAMBIL ROLE USER YANG SEDANG LOGIN
// Mengembalikan "admin" atau "driver", atau null jika gagal
// ============================================

async function getUserRole() {

    const { data: userData } = await supabaseClient.auth.getUser();

    if (!userData.user) {
        return null;
    }

    const { data: profileData, error } = await supabaseClient
        .from("profiles")
        .select("role, full_name")
        .eq("id", userData.user.id)
        .single();

    if (error) {
        console.log("Gagal mengambil role user:", error.message);
        return null;
    }

    return profileData; // mengembalikan { role: "admin"/"driver", full_name: "..." }
}

// ============================================
// FUNGSI: MEMBLOKIR HALAMAN KHUSUS ADMIN
// Dipanggil di halaman yang hanya boleh diakses admin (vehicles.html, damage-reports.html)
// ============================================

async function requireAdminGuard() {

    const profile = await getUserRole();

    if (!profile || profile.role !== "admin") {
        alert("Halaman ini hanya dapat diakses oleh Admin.");
        window.location.href = "dashboard.html";
        return false;
    }

    return true;
}

// ============================================
// FUNGSI: MENYESUAIKAN SIDEBAR MENU SESUAI ROLE
// Dipanggil di SEMUA halaman setelah login (dashboard, inspection, history, profile)
// ============================================

async function sesuaikanSidebarSesuaiRole() {

    const profile = await getUserRole();

    if (!profile) {
        return;
    }

    // Menampilkan nama user sungguhan di topbar (menggantikan teks statis "Halo, Admin")
    const userNameEl = document.querySelector(".user-name");
    if (userNameEl) {
        userNameEl.textContent = "Halo, " + profile.full_name;
    }

    // Jika role BUKAN admin, sembunyikan menu "Data Kendaraan" dan "Laporan Kerusakan"
    if (profile.role !== "admin") {
        const menuKendaraan = document.querySelector('a[href="vehicles.html"]');
        const menuLaporan = document.querySelector('a[href="damage-reports.html"]');

        if (menuKendaraan) {
            menuKendaraan.style.display = "none";
        }
        if (menuLaporan) {
            menuLaporan.style.display = "none";
        }
    }

    return profile;
}

// Fungsi logout, dipanggil dari tombol Logout di topbar
async function logoutUser() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

console.log("auth.js berhasil dimuat");