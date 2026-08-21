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