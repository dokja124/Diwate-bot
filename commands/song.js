/**
 * song.js — Commande .song : télécharge des chansons COMPLÈTES
 * Utilise yt-dlp avec cookies intégrés pour contourner le blocage YouTube
 * 
 * Installation : npm install yt-dlp-exec yt-search fs-extra
 * 
 * pair.js : const { handleSong } = require('./song');
 *   case 'song': { await handleSong(socket, msg, sender, isGroup, nowsender, args, fakevCard); break; }
 */

const fs = require('fs-extra');
const path = require('path');
const ytSearch = require('yt-search');
const { exec } = require('yt-dlp-exec');

const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// =============================================
// 🔥 COOKIES YOUTUBE (intégrés directement)
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
// 1. FONCTIONS UTILITAIRES
// =============================================

function sanitizeFileName(title) {
    return title.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_').substring(0, 50);
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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

// =============================================
// 2. RECHERCHE DE LA CHANSON
// =============================================

async function searchSong(query) {
    try {
        console.log(`🔍 Recherche: ${query}`);
        const result = await ytSearch(query);
        
        if (!result || !result.videos || result.videos.length === 0) {
            throw new Error('Aucune chanson trouvée');
        }

        const video = result.videos[0];
        
        console.log(`✅ Trouvé: ${video.title} - ${video.author.name}`);
        console.log(`⏱️ Durée: ${formatDuration(video.duration.seconds)}`);

        return {
            title: video.title,
            url: video.url,
            duration: video.duration.seconds,
            durationFormatted: formatDuration(video.duration.seconds),
            views: video.views,
            author: video.author.name
        };

    } catch (error) {
        console.error('❌ Erreur recherche:', error.message);
        throw error;
    }
}

// =============================================
// 3. TÉLÉCHARGEMENT COMPLET (avec cookies)
// =============================================

async function downloadSong(url, title) {
    try {
        const fileName = `${sanitizeFileName(title)}.mp3`;
        const filePath = path.join(TEMP_DIR, fileName);

        // Vérifier si le fichier existe déjà
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 1024 * 1024) {
                console.log(`✅ Fichier déjà existant: ${fileName}`);
                return filePath;
            }
        }

        console.log(`📥 Téléchargement complet: ${title}`);

        // 🔥 Construire la chaîne de cookies
        const cookieString = buildCookieString();
        console.log('🍪 Cookies chargés avec succès');

        // 🔥 TÉLÉCHARGEMENT AVEC COOKIES
        await exec(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: 0,
            output: filePath,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                `cookie: ${cookieString}`
            ],
            cookies: cookieString
        });

        if (!fs.existsSync(filePath)) {
            throw new Error('Le fichier n\'a pas été créé');
        }

        const stats = fs.statSync(filePath);
        console.log(`✅ Téléchargement terminé: ${fileName} (${(stats.size/1024/1024).toFixed(1)}MB)`);
        return filePath;

    } catch (error) {
        console.error('❌ Erreur téléchargement:', error.message);
        throw error;
    }
}

// =============================================
// 4. COMMANDE PRINCIPALE .song
// =============================================

async function handleSong(socket, msg, sender, nowsender, args, fakevCard) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '🎵', key: msg.key } }).catch(() => {});

        // Log avec nowsender
        console.log(`🎵 Commande .song utilisée par: ${nowsender}`);

        if (!args || args.length === 0) {
            await socket.sendMessage(sender, {
                text: '🎵 *Téléchargement de chanson complète*\n\n' +
                      '📌 *Utilisation :*\n.song [titre]\n\n' +
                      '📌 *Exemples :*\n.song Adele Hello\n.song Daft Punk Get Lucky\n\n' +
                      '⚡ *Qualité :* 320kbps (max)'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const query = args.join(' ');
        
        await socket.sendMessage(sender, {
            text: `🔍 *Recherche :* ${query}`
        }, { quoted: fakevCard || msg });

        // 1. Rechercher la chanson
        let songInfo;
        try {
            songInfo = await searchSong(query);
        } catch (error) {
            await socket.sendMessage(sender, {
                text: `❌ *Erreur de recherche :*\n${error.message}`
            }, { quoted: fakevCard || msg });
            return false;
        }

        // Message de téléchargement
        await socket.sendMessage(sender, {
            text: `📥 *Téléchargement complet...*\n\n` +
                  `🎵 *${songInfo.title}*\n` +
                  `👤 *${songInfo.author}*\n` +
                  `⏱️ *${songInfo.durationFormatted}*\n` +
                  `👁️ *${songInfo.views.toLocaleString()} vues*\n\n` +
                  `⏳ Peut prendre 10-30 secondes...`
        }, { quoted: fakevCard || msg });

        // 2. Télécharger la chanson
        let filePath;
        try {
            filePath = await downloadSong(songInfo.url, songInfo.title);
        } catch (error) {
            await socket.sendMessage(sender, {
                text: `❌ *Erreur de téléchargement :*\n${error.message}`
            }, { quoted: fakevCard || msg });
            return false;
        }

        // Vérifier que le fichier existe
        if (!fs.existsSync(filePath)) {
            await socket.sendMessage(sender, {
                text: '❌ *Erreur :* Le fichier audio n\'a pas pu être généré.'
            }, { quoted: fakevCard || msg });
            return false;
        }

        // 3. Lire le fichier
        const audioBuffer = await fs.readFile(filePath);
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        
        console.log(`📤 Envoi: ${fileName} (${(stats.size/1024/1024).toFixed(1)}MB)`);

        // 4. Envoyer l'audio
        await socket.sendMessage(sender, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${songInfo.title} - ${songInfo.author}.mp3`,
            caption: `🎵 *${songInfo.title}*\n` +
                     `👤 *${songInfo.author}*\n` +
                     `⏱️ *${songInfo.durationFormatted}*\n` +
                     `👁️ *${songInfo.views.toLocaleString()} vues*\n` +
                     `📥 *Chanson complète 320kbps*`
        }, { quoted: fakevCard || msg });

        // 5. Supprimer le fichier temporaire
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
