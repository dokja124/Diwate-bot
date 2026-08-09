/**
 * song.js — Commande .song : recherche et envoie une chanson depuis YouTube
 */

const fs = require('fs-extra');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

const TEMP_DIR = path.join(__dirname, 'temp');
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

        // 🔥 OPTIONS POUR CONTOURNER LE BLOCAGE YOUTUBE
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
                    'Upgrade-Insecure-Requests': '1'
                }
            },
            // 🔥 AJOUT : Options supplémentaires pour éviter le blocage
            agent: null,
            dlChunkSize: 0, // Désactive le chunking (parfois cause des problèmes)
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
                    reject(new Error('YouTube demande une vérification. Réessayez dans 5-10 minutes.'));
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
                      '📌 Le bot recherchera la chanson sur YouTube et vous l\'enverra en audio.'
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
            // 🔥 ATTENTE DE 2 SECONDES POUR ÉVITER LE BLOCAGE
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

        // 🔥 LECTURE DU FICHIER EN BUFFER
        const audioBuffer = await fs.readFile(filePath);
        const fileName = path.basename(filePath);
        const stats = fs.statSync(filePath);
        
        console.log(`📤 Envoi de l'audio: ${fileName} (${(stats.size/1024/1024).toFixed(1)}MB)`);

        // 🔥 ENVOI DU FICHIER AUDIO
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

        // Supprimer le fichier temporaire
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
