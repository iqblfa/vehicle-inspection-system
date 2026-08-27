// ============================================
// tax-helper.js
// Fungsi bantu untuk menghitung status pajak/KIR kendaraan
// Dipakai bersama di vehicles.js, dashboard.js, pajak.js
// ============================================

// Menghitung selisih hari antara hari ini dan tanggal jatuh tempo
// Hasil NEGATIF = sudah lewat, POSITIF = masih ada waktu
function hitungSisaHari(tanggalJatuhTempo) {

    if (!tanggalJatuhTempo) {
        return null; // tidak ada data tanggal
    }

    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0); // buang jam/menit/detik, supaya perbandingan murni per-hari

    const tanggalTempo = new Date(tanggalJatuhTempo);
    tanggalTempo.setHours(0, 0, 0, 0);

    const selisihMs = tanggalTempo.getTime() - hariIni.getTime();
    const selisihHari = Math.round(selisihMs / (1000 * 60 * 60 * 24));

    return selisihHari;
}

// Mengubah selisih hari menjadi status + class badge
function getStatusPajak(tanggalJatuhTempo) {

    const sisaHari = hitungSisaHari(tanggalJatuhTempo);

    if (sisaHari === null) {
        return { label: "Tidak ada data", badgeClass: "badge-secondary", sisaHari: null };
    }

    if (sisaHari < 0) {
        return { label: `Lewat ${Math.abs(sisaHari)} hari`, badgeClass: "badge-status-open", sisaHari: sisaHari };
    }

    if (sisaHari <= 30) {
        return { label: `${sisaHari} hari lagi`, badgeClass: "badge-status-waiting", sisaHari: sisaHari };
    }

    return { label: "Aman", badgeClass: "badge-status-completed", sisaHari: sisaHari };
}