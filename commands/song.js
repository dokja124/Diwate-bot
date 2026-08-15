/**
 * song.js — Commande .song : télécharge des chansons COMPLÈTES
 * Utilise yt-dlp pour une qualité maximale (320kbps)
 * 
 * Installation : npm install yt-dlp-exec yt-search fs-extra
 * 
 * pair.js : const { handleSong } = require('./song');
 *   case 'song': { await handleSong(socket, msg, sender, args, fakevCard); break; }
 */

const fs = require('fs-extra');
const path = require('path');
const ytSearch = require('yt-search');
const { exec } = require('yt-dlp-exec');

const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

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
        const MAX_AGE = 3600000; // 1 heure
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

        // Prendre le premier résultat (le plus pertinent)
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
// 3. TÉLÉCHARGEMENT COMPLET
// =============================================

async function downloadSong(url, title) {
    try {
        const fileName = `${sanitizeFileName(title)}.mp3`;
        const filePath = path.join(TEMP_DIR, fileName);

        // Vérifier si le fichier existe déjà
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 1024 * 1024) { // > 1MB = complet
                console.log(`✅ Fichier déjà existant: ${fileName}`);
                return filePath;
            }
        }

        console.log(`📥 Téléchargement complet: ${title}`);

        // 🔥 TÉLÉCHARGEMENT COMPLET AVEC yt-dlp
        await exec(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: 0,           // Meilleure qualité (320kbps)
            output: filePath,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            ]
        });

        // Vérifier que le fichier a bien été créé
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
        
        // Message de recherche
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
