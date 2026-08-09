/**
 * song.js — Commande .song : recherche et envoie une chanson depuis YouTube
 */

const fs = require('fs-extra');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

const TEMP_DIR = path.join(__dirname, 'temp');

// =============================================
// 🔥 TOUS LES COOKIES YOUTUBE
// =============================================
const YT_COOKIES = {
    "VISITOR_PRIVACY_METADATA": "CgJDSRIEGgAgZg%3D%3D",
    "__Secure-3PSID": "g.a000BAl3DFOosgOWkEpeJ7A46cGeG4lB1ckbBCKLekeMDEIWopFppgMZImakmEIcZg3fzi4PvwACgYKAd4SARASFQHGX2Mi4tqPTKRKu2dG6htcOnlryBoVAUF8yKqzD3DgljXk_d3TYkZP0uUd0076",
    "GPS": "1",
    "SIDCC": "AKEyXzU0gsh9I6Jjb-HoqI3an4TldD5V8uhr26MVZAOaeRX-zn0vyiK_S0bIKUFXqiHOJ7VC7g",
    "YSC": "bl3sLkdQ010",
    "SID": "g.a000BAl3DFOosgOWkEpeJ7A46cGeG4lB1ckbBCKLekeMDEIWopFpZ4dml1ztvW-xIQgcrH4tkAACgYKAYoSARASFQHGX2MiTnyvaSrG13w7lOlcF66sNxoVAUF8yKqMM82F8z1OEHdjRNwB2gei0076",
    "ST-1kjowt2": "csn=UOMde_KuY-ivGCVM&itct=CGUQh_YEGAMiEwj3is3ZqZSWAxUDPboAHVONNh1aD0ZFd2hhdF90b193YXRjaJoBBQgkEI4eygEEqqYN7g%3D%3D",
    "__Secure-1PSIDTS": "sidts-CjQBPWEu2bgCh2dIuAt92jYMhypY628uB3XVHZuVHyp6KioezfwlLFwOskWYeLGLYI7rRtNMEAA",
    "SAPISID": "nc1s83XAjhDf1C0t/AT0fOySyeShQA1GpV",
    "__Secure-1PSIDCC": "AKEyXzUatFA0gVeY59GXpSBXkVWGU5kVqdb83gz8OK-vaIG63Wp0vub5hBWzBBwuD998dVK6",
    "SSID": "AELXsbfOuBBxLDyro",
    "__Secure-1PAPISID": "nc1s83XAjhDf1C0t/AT0fOySyeShQA1GpV",
    "__Secure-1PSID": "g.a000BAl3DFOosgOWkEpeJ7A46cGeG4lB1ckbBCKLekeMDEIWopFpthphZnCHPQEPfbKE0MBYYAACgYKAXcSARASFQHGX2MiTAJyOAlKAFZmqImGtUTP5RoVAUF8yKqqbWoRhfsWjhDYegnJlS4e0076",
    "__Secure-3PAPISID": "nc1s83XAjhDf1C0t/AT0fOySyeShQA1GpV",
    "__Secure-3PSIDCC": "AKEyXzXo3hvH8mOP-Se1gNtqWC7zXVzMkddOfjovWvM_CbXn59UflzIdw7IZW0_qCe_O7ckUVA",
    "__Secure-3PSIDTS": "sidts-CjQBPWEu2bgCh2dIuAt92jYMhypY628uB3XVHZuVHyp6KioezfwlLFwOskWYeLGLYI7rRtNMEAA",
    "__Secure-YNID": "20.YT=nXfA4RpyBFf7OXHuae3r0yehCwWeqsK3JPSPHHjjE2arIgwGYULvH1pO2g5webIbDVd9YVPA0rVw3nJehyjMnszRxmPBx4g0w4LBOu7DPh4UjUt340gfTgcE129u1afUZ33XfusqrBqHsr4mVTYc4wmFKcolPKfcY8WrsB24pTxYmCBAiqQxtjFZY-rIhTyOBUSZnmsD5fe_PyxPCII90WOzg8PWYhO4IT9ZrWsAeYmQQEbQhhyhkmEfsL0oUAKkx-ZlBdiXH8LyFqyoYywuZdXjiFzW3gB7WKijDNxP-CB5TF1SPQKg26B_zIyQnDzHXNbsKr0GYQE67nMz8S9bQQ",
    "APISID": "yvFTStR7k4hwXa0-/AP82T8dRK_G2T82yX",
    "HSID": "AmsgGQ8Q5y59yUKo7",
    "LOGIN_INFO": "AFmmF2swRAIgaGPEk6Jkch-kd7F0zwl_PwDZBnJupVeYcnIXVbO-kAYCIHbhPiLtERYwvIJ5g7LQqYYpRSNqtFzPAzhe0iT_o03v:QUQ3MjNmeFZKTGZYYWp1cktMYlllY21hQWtmX0E1UUJNckNfb3dZUzJnbHN6SGl6TWRmMTd4LV9EQXh6b0F2a05xUkVVQjg2MkJQNGlVQU5vRm1NMGdmTk1YUFFaZXdfREZ0S1FzbWtvUWlpeHo4N3VFR0FpcVBWaXlVWXhZMDdLMUtGTldpU0dDVzNtaExDNE9mVW54dnRTOURFRDkyV1JB",
    "PREF": "tz=Africa.Abidjan",
    "ST-oetbn2": "csn=UOMde_KuY-ivGCVM&itct=CG0Qh_YEGAEiEwj3is3ZqZSWAxUDPboAHVONNh1aD0ZFd2hhdF90b193YXRjaJoBBQgkEI4eygEEqqYN7g%3D%3D",
    "VISITOR_INFO1_LIVE": "W-6FQ_zaAY8"
};

// Construire la chaîne de cookies
function buildCookieString() {
    return Object.entries(YT_COOKIES)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
}

// =============================================
// CONFIGURATION
// =============================================
const MAX_DURATION = 600;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function sanitizeFileName(title) {
    return title.replace(/[^\w\s-]/gi, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);
}

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanupTempFiles() {
    try {
        const files = fs.readdirSync(TEMP_DIR);
        const now = Date.now();
        const MAX_AGE = 3600000;
        files.forEach(file => {
            const filePath = path.join(TEMP_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > MAX_AGE) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Fichier temporaire supprimé: ${file}`);
            }
        });
    } catch (error) {
        console.error('Erreur nettoyage temp:', error.message);
    }
}

setInterval(cleanupTempFiles, 3600000);

async function searchSong(query) {
    try {
        console.log(`🔍 Recherche de: ${query}`);
        const result = await ytSearch(query);
        
        if (!result || !result.videos || result.videos.length === 0) {
            throw new Error('Aucune chanson trouvée');
        }

        const video = result.videos.find(v => v.duration.seconds <= MAX_DURATION);
        if (!video) {
            throw new Error(`Aucune chanson de moins de ${MAX_DURATION/60} minutes trouvée`);
        }

        return {
            title: video.title,
            url: video.url,
            duration: video.duration.seconds,
            durationFormatted: formatDuration(video.duration.seconds),
            views: video.views,
            thumbnail: video.thumbnail,
            author: video.author.name
        };

    } catch (error) {
        console.error('❌ Erreur recherche:', error.message);
        throw error;
    }
}

async function downloadSong(url, title) {
    try {
        console.log(`📥 Téléchargement de: ${title}`);

        const fileName = `${sanitizeFileName(title)}.mp3`;
        const filePath = path.join(TEMP_DIR, fileName);

        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size < MAX_FILE_SIZE) {
                console.log(`✅ Fichier déjà existant: ${fileName}`);
                return filePath;
            }
        }

        const cookieString = buildCookieString();
        console.log('🍪 Cookies chargés:', cookieString ? '✅ Oui' : '❌ Non');

        const stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'lowestaudio',
            highWaterMark: 1 << 25,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    'Cookie': cookieString
                }
            },
            agent: null,
            dlChunkSize: 0,
            liveBuffer: 0
        });

        const writeStream = fs.createWriteStream(filePath);
        
        return new Promise((resolve, reject) => {
            stream.pipe(writeStream);
            
            let lastProgress = 0;
            stream.on('progress', (chunkLength, downloaded, total) => {
                const progress = Math.floor(downloaded / total * 100);
                if (progress >= lastProgress + 10) {
                    lastProgress = progress;
                    console.log(`📊 Téléchargement: ${progress}% (${(downloaded/1024/1024).toFixed(1)}MB)`);
                }
            });

            writeStream.on('finish', () => {
                const stats = fs.statSync(filePath);
                if (stats.size > MAX_FILE_SIZE) {
                    fs.unlinkSync(filePath);
                    reject(new Error(`Fichier trop volumineux (${(stats.size/1024/1024).toFixed(1)}MB > 50MB)`));
                } else {
                    console.log(`✅ Téléchargement terminé: ${fileName} (${(stats.size/1024/1024).toFixed(1)}MB)`);
                    resolve(filePath);
                }
            });

            writeStream.on('error', (error) => {
                try { fs.unlinkSync(filePath); } catch (e) {}
                reject(new Error(`Erreur d'écriture: ${error.message}`));
            });

            stream.on('error', (error) => {
                try { fs.unlinkSync(filePath); } catch (e) {}
                if (error.message.includes('Sign in') || error.message.includes('bot')) {
                    reject(new Error('YouTube demande une vérification. Les cookies sont peut-être expirés.'));
                } else if (error.message.includes('429')) {
                    reject(new Error('Trop de requêtes. Attendez quelques minutes.'));
                } else {
                    reject(new Error(`Erreur de téléchargement: ${error.message}`));
                }
            });
        });

    } catch (error) {
        console.error('❌ Erreur téléchargement:', error.message);
        throw error;
    }
}

async function handleSong(socket, msg, sender, isGroup, nowsender, args, fakevCard) {
    try {
        // ✅ EMOJI : Réaction sur la commande
        await socket.sendMessage(sender, {
            react: { text: '🎵', key: msg.key }
        }).catch(() => {});

        if (!args || args.length === 0) {
            await socket.sendMessage(sender, {
                text: '🎵 *Utilisation de la commande .song*\n\n' +
                      'Exemple : `.song Adele Hello`\n\n' +
                      '📌 Le bot recherchera la chanson sur YouTube.'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const query = args.join(' ');
        
        await socket.sendMessage(sender, {
            text: `🔍 *Recherche en cours...*\n\n🎵 *${query}*\n\n⏳ Veuillez patienter...`
        }, { quoted: fakevCard || msg });

        let songInfo;
        try {
            songInfo = await searchSong(query);
        } catch (error) {
            await socket.sendMessage(sender, {
                text: `❌ *Erreur de recherche :*\n${error.message}`
            }, { quoted: fakevCard || msg });
            return false;
        }

        await socket.sendMessage(sender, {
            text: `📥 *Téléchargement en cours...*\n\n` +
                  `🎵 *Titre :* ${songInfo.title}\n` +
                  `👤 *Artiste :* ${songInfo.author}\n` +
                  `⏱️ *Durée :* ${songInfo.durationFormatted}\n` +
                  `👁️ *Vues :* ${songInfo.views.toLocaleString()}\n\n` +
                  `⏳ Préparation du fichier audio...`
        }, { quoted: fakevCard || msg });

        let filePath;
        try {
            await delay(2000);
            filePath = await downloadSong(songInfo.url, songInfo.title);
        } catch (error) {
            await socket.sendMessage(sender, {
                text: `❌ *Erreur de téléchargement :*\n${error.message}`
            }, { quoted: fakevCard || msg });
            return false;
        }

        if (!fs.existsSync(filePath)) {
            await socket.sendMessage(sender, {
                text: '❌ *Erreur :* Le fichier audio n\'a pas pu être généré.'
            }, { quoted: fakevCard || msg });
            return false;
        }

        const audioBuffer = await fs.readFile(filePath);
        const fileName = path.basename(filePath);
        const stats = fs.statSync(filePath);
        
        console.log(`📤 Envoi de l'audio: ${fileName} (${(stats.size/1024/1024).toFixed(1)}MB)`);

        await socket.sendMessage(sender, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${songInfo.title}.mp3`,
            caption: `🎵 *${songInfo.title}*\n` +
                     `👤 ${songInfo.author}\n` +
                     `⏱️ ${songInfo.durationFormatted}\n` +
                     `👁️ ${songInfo.views.toLocaleString()} vues\n\n` +
                     `📥 Téléchargé via Diwate-bot`
        }, { quoted: fakevCard || msg });

        try {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Fichier supprimé: ${fileName}`);
        } catch (error) {
            console.error('Erreur suppression fichier:', error.message);
        }

        return true;

    } catch (error) {
        console.error('❌ Erreur handleSong:', error);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur inattendue :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return false;
    }
}

module.exports = { handleSong };

cleanupTempFiles();
