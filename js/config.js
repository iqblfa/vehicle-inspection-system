// ============================================
// config.js
// Konfigurasi koneksi ke Supabase.
// PENTING: Publishable Key ini AMAN ditaruh di frontend
// karena keamanan sesungguhnya diatur lewat Row Level Security (RLS)
// yang akan kita pelajari di Phase 18.
// ============================================

const SUPABASE_URL = "https://eegpxskshcrusqagkpyw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xZpGKKMvAzyu_92ah6RHWA_x2f7P2Bh";

// Membuat objek koneksi ke Supabase, akan dipakai file JS lain
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

console.log("config.js berhasil dimuat, koneksi Supabase siap.");