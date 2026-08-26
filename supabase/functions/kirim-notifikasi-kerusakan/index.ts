// ============================================
// kirim-notifikasi-kerusakan/index.ts
// Edge Function untuk mengirim email notifikasi
// saat ada laporan kerusakan tingkat "Critical"
// ============================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {

    try {
        // Data yang dikirim oleh Database Webhook, berisi baris baru yang masuk
        const payload = await req.json();
        const laporanBaru = payload.record;

        // Hanya kirim email jika tingkat kerusakan adalah "Critical"
        if (laporanBaru.severity !== "Critical") {
            return new Response(
                JSON.stringify({ message: "Bukan Critical, email tidak dikirim." }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        // Mengambil API Key Resend dari Secrets (aman, tidak terlihat di kode)
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const EMAIL_ADMIN_TUJUAN = Deno.env.get("EMAIL_ADMIN_TUJUAN");

        // Menyusun isi email
        const isiEmail = `
            <h2>⚠️ Laporan Kerusakan Critical</h2>
            <p>Ada laporan kerusakan baru dengan tingkat <strong>Critical</strong> yang memerlukan perhatian segera.</p>
            <table style="border-collapse: collapse; width: 100%;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Nomor Laporan</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${laporanBaru.report_number}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Deskripsi</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${laporanBaru.damage_description}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Lokasi Kerusakan</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${laporanBaru.damage_location || "-"}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Status</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${laporanBaru.status}</td></tr>
            </table>
            <p>Silakan buka aplikasi VINS untuk menindaklanjuti laporan ini.</p>
        `;

        // Mengirim email lewat Resend API
        const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: "VINS Notifikasi <onboarding@resend.dev>",
                to: [EMAIL_ADMIN_TUJUAN],
                subject: `[CRITICAL] Laporan Kerusakan Baru - ${laporanBaru.report_number}`,
                html: isiEmail
            })
        });

        const resendResult = await resendResponse.json();

        return new Response(
            JSON.stringify({ message: "Email berhasil dikirim.", resendResult }),
            { headers: { "Content-Type": "application/json" } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});