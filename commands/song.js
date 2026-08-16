/**
 * song.js — Commande .song : télécharge des chansons depuis YouTube
 * Utilise plusieurs APIs de fallback (EliteProTech, Yupra, Okatsu)
 * Conversion automatique en MP3 via @ffmpeg-installer/ffmpeg
 */

const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Utilisation du chemin ffmpeg installé via npm
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// =============================================
// 1. CONFIGURATION
// =============================================

const TEMP_DIR = path.join(__dirname, '../temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

// =============================================
// 2. CONVERSION AUDIO (ffmpeg)
// =============================================

async function toAudio(inputBuffer, inputExt = 'm4a') {
    const sessionId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const inputPath = path.join(TEMP_DIR, `${sessionId}_in.${inputExt}`);
    const outputPath = path.join(TEMP_DIR, `${sessionId}_out.mp3`);

    try {
        // Écrire le fichier temporaire
        await fs.writeFile(inputPath, inputBuffer);

        // Commande ffmpeg
        await execAsync(
            `"${ffmpegPath}" -y -i "${inputPath}" -vn -acodec libmp3lame -ab 128k -ar 44100 "${outputPath}"`,
            { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
        );

        // Lire le résultat
        const outputBuffer = await fs.readFile(outputPath);
        if (!outputBuffer || outputBuffer.length === 0) {
            throw new Error('ffmpeg a produit un fichier vide');
        }
        return outputBuffer;
    } finally {
        // Nettoyer les fichiers temporaires
        try { await fs.unlink(inputPath); } catch (_) {}
        try { await fs.unlink(outputPath); } catch (_) {}
    }
}

// =============================================
// 3. APIs DE TÉLÉCHARGEMENT
// =============================================

async function getEliteProTechDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return { download: res.data.downloadURL, title: res.data.title };
    }
    throw new Error('EliteProTech ytdown returned no download');
}

async function getYupraDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title,
            thumbnail: res.data.data.thumbnail
        };
    }
    throw new Error('Yupra returned no download');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.dl) {
        return {
            download: res.data.dl,
            title: res.data.title,
            thumbnail: res.data.thumb
        };
    }
    throw new Error('Okatsu ytmp3 returned no download');
}

// =============================================
// 4. TÉLÉCHARGEMENT DU BUFFER AUDIO
// =============================================

async function downloadAudioBuffer(audioUrl) {
    // Tentative 1 : arraybuffer
    try {
        const response = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            timeout: 90000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            decompress: true,
            validateStatus: s => s >= 200 && s < 400,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'identity'
            }
        });
        const buf = Buffer.from(response.data);
        if (buf && buf.length > 0) return buf;
    } catch (err) {
        console.log('   ↳ Échec arraybuffer:', err.message);
    }

    // Tentative 2 : stream
    try {
        const response = await axios.get(audioUrl, {
            responseType: 'stream',
            timeout: 90000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: s => s >= 200 && s < 400,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'identity'
            }
        });
        const chunks = [];
        await new Promise((resolve, reject) => {
            response.data.on('data', c => chunks.push(c));
            response.data.on('end', resolve);
            response.data.on('error', reject);
        });
        const buf = Buffer.concat(chunks);
        if (buf && buf.length > 0) return buf;
    } catch (err) {
        console.log('   ↳ Échec stream:', err.message);
    }

    throw new Error('Échec du téléchargement du buffer audio');
}

// =============================================
// 5. DÉTECTION DU FORMAT
// =============================================

function detectAudioFormat(buffer) {
    if (buffer.length < 12) return { ext: 'mp3', mime: 'audio/mpeg', format: 'unknown' };

    const ascii = (start, len) => buffer.toString('ascii', start, start + len);

    if (ascii(4, 4) === 'ftyp') {
        return { ext: 'm4a', mime: 'audio/mp4', format: 'M4A/MP4' };
    }
    if (ascii(0, 3) === 'ID3' || (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)) {
        return { ext: 'mp3', mime: 'audio/mpeg', format: 'MP3' };
    }
    if (ascii(0, 4) === 'OggS') {
        return { ext: 'ogg', mime: 'audio/ogg; codecs=opus', format: 'OGG/Opus' };
    }
    if (ascii(0, 4) === 'RIFF') {
        return { ext: 'wav', mime: 'audio/wav', format: 'WAV' };
    }
    if (ascii(0, 4) === 'fLaC') {
        return { ext: 'flac', mime: 'audio/flac', format: 'FLAC' };
    }
    if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
        return { ext: 'webm', mime: 'audio/webm', format: 'WebM' };
    }

    return { ext: 'm4a', mime: 'audio/mp4', format: 'Unknown (defaulting to M4A)' };
}

// =============================================
// 6. FONCTION PRINCIPALE
// =============================================

async function handleSong(socket, msg, sender, nowsender, args, fakevCard) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '🎵', key: msg.key } }).catch(() => {});
        console.log(`🎵 Commande .song utilisée par: ${nowsender}`);

        // Vérifier les arguments
        if (!args || args.length === 0) {
            await socket.sendMessage(sender, {
                text: '🎵 *Téléchargement de chanson*\n\n' +
                      '📌 *Utilisation :*\n.song [titre ou lien YouTube]\n\n' +
                      '📌 *Exemples :*\n.song Adele Hello\n.song https://youtube.com/watch?v=...'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const query = args.join(' ');

        // Rechercher la chanson
        let video;
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            video = { url: query, title: 'Lien YouTube', timestamp: 'N/A', thumbnail: undefined };
            try {
                const ytsResult = await yts({ videoId: query.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1] });
                if (ytsResult) {
                    video.title = ytsResult.title;
                    video.timestamp = ytsResult.timestamp;
                    video.thumbnail = ytsResult.thumbnail;
                }
            } catch (_) {}
        } else {
            const search = await yts(query);
            if (!search || !search.videos.length) {
                await socket.sendMessage(sender, {
                    text: '❌ *Aucun résultat trouvé.*'
                }, { quoted: fakevCard || msg });
                return false;
            }
            video = search.videos[0];
        }

        // Message d'information
        const infoMsg = video.thumbnail
            ? { image: { url: video.thumbnail }, caption: `🎵 *Téléchargement :*\n\n📌 *Titre :* ${video.title}\n⏱️ *Durée :* ${video.timestamp}` }
            : { text: `🎵 *Téléchargement :*\n\n📌 *Titre :* ${video.title}\n⏱️ *Durée :* ${video.timestamp}` };

        await socket.sendMessage(sender, infoMsg, { quoted: fakevCard || msg });

        // Télécharger via les APIs
        let audioData = null;
        let audioBuffer = null;
        let usedApi = null;

        const apiMethods = [
            { name: 'EliteProTech', method: () => getEliteProTechDownloadByUrl(video.url) },
            { name: 'Yupra',        method: () => getYupraDownloadByUrl(video.url) },
            { name: 'Okatsu',       method: () => getOkatsuDownloadByUrl(video.url) }
        ];

        for (const apiMethod of apiMethods) {
            try {
                console.log(`➡️ Essai API: ${apiMethod.name}`);
                audioData = await apiMethod.method();
                const audioUrl = audioData.download || audioData.dl || audioData.url;

                if (!audioUrl) {
                    console.log(`   ${apiMethod.name}: pas d'URL de download`);
                    continue;
                }

                audioBuffer = await downloadAudioBuffer(audioUrl);

                if (audioBuffer && audioBuffer.length > 0) {
                    usedApi = apiMethod.name;
                    console.log(`✅ Téléchargement réussi via ${usedApi} (${(audioBuffer.length/1024/1024).toFixed(2)} MB)`);
                    break;
                }
            } catch (apiErr) {
                console.log(`❌ ${apiMethod.name} failed:`, apiErr.message);
                continue;
            }
        }

        if (!audioBuffer) {
            throw new Error('All download sources failed');
        }

        // Détecter le format
        const detected = detectAudioFormat(audioBuffer);
        console.log(`🎼 Format détecté: ${detected.format} (.${detected.ext})`);

        // Convertir en MP3 si nécessaire
        let finalBuffer = audioBuffer;
        let finalMimetype = 'audio/mpeg';
        let finalExtension = 'mp3';

        if (detected.ext !== 'mp3') {
            try {
                finalBuffer = await toAudio(audioBuffer, detected.ext);
                if (!finalBuffer || finalBuffer.length === 0) {
                    throw new Error('Conversion a retourné un buffer vide');
                }
                console.log(`✅ Conversion MP3 réussie (${(finalBuffer.length/1024/1024).toFixed(2)} MB)`);
            } catch (convErr) {
                console.error('❌ Conversion échouée:', convErr.message);
                // Fallback : envoyer l'audio dans son format original
                finalBuffer = audioBuffer;
                finalMimetype = detected.mime;
                finalExtension = detected.ext;
                console.log(`⚠️ Envoi en format original: ${detected.format}`);
            }
        }

        // Nettoyer le titre pour le nom de fichier
        const cleanTitle = (audioData.title || video.title || 'song')
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .slice(0, 64);

        // Envoyer l'audio
        await socket.sendMessage(sender, {
            audio: finalBuffer,
            mimetype: finalMimetype,
            fileName: `${cleanTitle}.${finalExtension}`,
            ptt: false,
            caption: `🎵 *${audioData.title || video.title}*\n📥 Source: ${usedApi}`
        }, { quoted: fakevCard || msg });

        // ✅ Réaction de succès
        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }).catch(() => {});

        return true;

    } catch (error) {
        console.error('❌ Erreur song:', error);

        let errorMessage = '❌ *Erreur de téléchargement*\n\n';
        if (error.message && error.message.includes('blocked')) {
            errorMessage += 'Le contenu est peut-être indisponible dans votre région.';
        } else if (error.response?.status === 451 || error.status === 451) {
            errorMessage += 'Contenu indisponible (451) : restrictions légales ou régionales.';
        } else if (error.message && error.message.includes('All download sources failed')) {
            errorMessage += 'Toutes les sources ont échoué. Réessaie plus tard.';
        } else {
            errorMessage += 'Détail : ' + (error.message || 'erreur inconnue');
        }

        await socket.sendMessage(sender, {
            text: errorMessage
        }, { quoted: fakevCard || msg }).catch(() => {});

        // ❌ Réaction d'erreur
        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }).catch(() => {});

        return false;
    }
}

module.exports = { handleSong };
