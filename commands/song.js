/**
 * song.js — Commande .song : télécharge des chansons depuis YouTube
 * Utilise plusieurs APIs de fallback (EliteProTech, Yupra, Okatsu)
 * 
 * pair.js : const { handleSong } = require('./song');
 *   case 'song': { await handleSong(socket, msg, sender, isGroup, nowsender, args, fakevCard); break; }
 */

const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs-extra');
const path = require('path');
const { toAudio } = require('../lib/converter');

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
// 2. APIs DE TÉLÉCHARGEMENT
// =============================================

// EliteProTech API
async function getEliteProTechDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return {
            download: res.data.downloadURL,
            title: res.data.title
        };
    }
    throw new Error('EliteProTech ytdown returned no download');
}

// Yupra API
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

// Okatsu API
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
// 3. FONCTION PRINCIPALE
// =============================================

async function handleSong(socket, msg, sender, nowsender, args, fakevCard) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '🎵', key: msg.key } }).catch(() => {});

        // Log
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
            video = { url: query };
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
        await socket.sendMessage(sender, {
            image: { url: video.thumbnail },
            caption: `🎵 *Téléchargement :*\n\n📌 *Titre :* ${video.title}\n⏱️ *Durée :* ${video.timestamp}`
        }, { quoted: fakevCard || msg });

        // Télécharger via les APIs
        let audioData;
        let audioBuffer;
        let downloadSuccess = false;

        const apiMethods = [
            { name: 'EliteProTech', method: () => getEliteProTechDownloadByUrl(video.url) },
            { name: 'Yupra', method: () => getYupraDownloadByUrl(video.url) },
            { name: 'Okatsu', method: () => getOkatsuDownloadByUrl(video.url) }
        ];

        for (const apiMethod of apiMethods) {
            try {
                audioData = await apiMethod.method();
                const audioUrl = audioData.download || audioData.dl || audioData.url;

                if (!audioUrl) {
                    console.log(`${apiMethod.name} returned no download URL, trying next API...`);
                    continue;
                }

                // Télécharger le fichier audio
                try {
                    const audioResponse = await axios.get(audioUrl, {
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
                    audioBuffer = Buffer.from(audioResponse.data);

                    if (audioBuffer && audioBuffer.length > 0) {
                        downloadSuccess = true;
                        break;
                    }
                } catch (downloadErr) {
                    const statusCode = downloadErr.response?.status || downloadErr.status;
                    if (statusCode === 451) {
                        console.log(`Download blocked (451) from ${apiMethod.name}, trying next API...`);
                        continue;
                    }

                    // Tentative en stream
                    try {
                        const audioResponse = await axios.get(audioUrl, {
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
                            audioResponse.data.on('data', c => chunks.push(c));
                            audioResponse.data.on('end', resolve);
                            audioResponse.data.on('error', reject);
                        });
                        audioBuffer = Buffer.concat(chunks);

                        if (audioBuffer && audioBuffer.length > 0) {
                            downloadSuccess = true;
                            break;
                        }
                    } catch (streamErr) {
                        console.log(`Stream download failed from ${apiMethod.name}:`, streamErr.message);
                        continue;
                    }
                }
            } catch (apiErr) {
                console.log(`${apiMethod.name} API failed:`, apiErr.message);
                continue;
            }
        }

        if (!downloadSuccess || !audioBuffer) {
            throw new Error('Toutes les sources de téléchargement ont échoué.');
        }

        // Détecter le format du fichier
        const firstBytes = audioBuffer.slice(0, 12);
        const hexSignature = firstBytes.toString('hex');
        const asciiSignature = firstBytes.toString('ascii', 4, 8);

        let actualMimetype = 'audio/mpeg';
        let fileExtension = 'mp3';
        let detectedFormat = 'unknown';

        if (asciiSignature === 'ftyp' || hexSignature.startsWith('000000')) {
            const ftypBox = audioBuffer.slice(4, 8).toString('ascii');
            if (ftypBox === 'ftyp') {
                detectedFormat = 'M4A/MP4';
                actualMimetype = 'audio/mp4';
                fileExtension = 'm4a';
            }
        } else if (audioBuffer.toString('ascii', 0, 3) === 'ID3' ||
                   (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0)) {
            detectedFormat = 'MP3';
            actualMimetype = 'audio/mpeg';
            fileExtension = 'mp3';
        } else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') {
            detectedFormat = 'OGG/Opus';
            actualMimetype = 'audio/ogg; codecs=opus';
            fileExtension = 'ogg';
        } else if (audioBuffer.toString('ascii', 0, 4) === 'RIFF') {
            detectedFormat = 'WAV';
            actualMimetype = 'audio/wav';
            fileExtension = 'wav';
        } else {
            actualMimetype = 'audio/mp4';
            fileExtension = 'm4a';
            detectedFormat = 'Unknown (defaulting to M4A)';
        }

        // Convertir en MP3 si nécessaire
        let finalBuffer = audioBuffer;
        let finalMimetype = 'audio/mpeg';
        let finalExtension = 'mp3';

        if (fileExtension !== 'mp3') {
            try {
                finalBuffer = await toAudio(audioBuffer, fileExtension);
                if (!finalBuffer || finalBuffer.length === 0) {
                    throw new Error('Conversion returned empty buffer');
                }
                finalMimetype = 'audio/mpeg';
                finalExtension = 'mp3';
            } catch (convErr) {
                throw new Error(`Failed to convert ${detectedFormat} to MP3: ${convErr.message}`);
            }
        }

        // Envoyer l'audio
        await socket.sendMessage(sender, {
            audio: finalBuffer,
            mimetype: finalMimetype,
            fileName: `${(audioData.title || video.title || 'song').replace(/[^\w\s-]/g, '')}.${finalExtension}`,
            ptt: false,
            caption: `🎵 *${audioData.title || video.title}*\n📥 *Téléchargé via Diwate-bot*`
        }, { quoted: fakevCard || msg });

        // Nettoyer les fichiers temporaires
        try {
            const files = fs.readdirSync(TEMP_DIR);
            const now = Date.now();
            files.forEach(file => {
                const filePath = path.join(TEMP_DIR, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > 10000) {
                        if (file.endsWith('.mp3') || file.endsWith('.m4a') || /^\d+\.(mp3|m4a)$/.test(file)) {
                            fs.unlinkSync(filePath);
                        }
                    }
                } catch (e) {}
            });
        } catch (cleanupErr) {}

        return true;

    } catch (error) {
        console.error('❌ Erreur song:', error);

        let errorMessage = '❌ *Erreur de téléchargement*';
        if (error.message && error.message.includes('blocked')) {
            errorMessage = '❌ *Téléchargement bloqué.* Le contenu est peut-être indisponible dans votre région.';
        } else if (error.response?.status === 451 || error.status === 451) {
            errorMessage = '❌ *Contenu indisponible (451).* Restrictions légales ou régionales.';
        } else if (error.message && error.message.includes('All download sources failed')) {
            errorMessage = '❌ *Toutes les sources ont échoué.* Le contenu est peut-être indisponible.';
        }

        await socket.sendMessage(sender, {
            text: errorMessage
        }, { quoted: fakevCard || msg }).catch(() => {});
        return false;
    }
}

module.exports = { handleSong };
