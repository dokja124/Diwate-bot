/**
 * song.js — Commande .song : recherche et envoie une chanson depuis YouTube
 * 
 * Installation des dépendances :
 * npm install ytdl-core @distube/ytdl-core yt-search fs-extra
 */

const fs = require('fs-extra');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

// =============================================
// 1. CONFIGURATION
// =============================================
const TEMP_DIR = path.join(__dirname, 'temp');
const MAX_DURATION = 600; // 10 minutes maximum
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB maximum

// Créer le dossier temp s'il n'existe pas
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// =============================================
// 2. FONCTIONS UTILITAIRES
// =============================================

/**
 * Nettoie le nom de la chanson pour le nom de fichier
 */
function sanitizeFileName(title) {
    return title.replace(/[^\w\s-]/gi, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);
}

/**
 * Formate la durée en minutes:secondes
 */
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Nettoyer les fichiers temporaires
 */
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

// Nettoyer les fichiers temporaires toutes les heures
setInterval(cleanupTempFiles, 3600000);

// =============================================
// 3. RECHERCHE DE CHANSON
// =============================================

/**
 * Recherche une chanson sur YouTube
 */
async function searchSong(query) {
    try {
        console.log(`🔍 Recherche de: ${query}`);
        
        const result = await ytSearch(query);
        
        if (!result || !result.videos || result.videos.length === 0) {
            throw new Error('Aucune chanson trouvée');
        }

        // Filtrer les vidéos trop longues
        const video = result.videos.find(v => v.duration.seconds <= MAX_DURATION);
        
        if (!video) {
            throw new Error(`Aucune chanson de moins de ${MAX_DURATION/60} minutes trouvée`);
        }

        console.log(`✅ Chanson trouvée: ${video.title}`);
        console.log(`⏱️ Durée: ${formatDuration(video.duration.seconds)}`);
        console.log(`👁️ Vues: ${video.views}`);

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

// =============================================
// 4. TÉLÉCHARGEMENT DE LA CHANSON
// =============================================

/**
 * Télécharge une chanson depuis YouTube
 */
async function downloadSong(url, title) {
    try {
        console.log(`📥 Téléchargement de: ${title}`);

        const fileName = `${sanitizeFileName(title)}.mp3`;
        const filePath = path.join(TEMP_DIR, fileName);

        // Vérifier si le fichier existe déjà
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size < MAX_FILE_SIZE) {
                console.log(`✅ Fichier déjà existant: ${fileName}`);
                return filePath;
            }
        }

        // Télécharger la chanson avec ytdl
        const stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'lowestaudio',
            highWaterMark: 1 << 25
        });

        // Écrire le fichier
        const writeStream = fs.createWriteStream(filePath);
        
        return new Promise((resolve, reject) => {
            stream.pipe(writeStream);
            
            let downloadedSize = 0;
            stream.on('progress', (chunkLength, downloaded, total) => {
                downloadedSize = downloaded;
                const progress = (downloaded / total * 100).toFixed(1);
                if (downloaded % (1024 * 1024) < 1024) {
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
                reject(new Error(`Erreur de téléchargement: ${error.message}`));
            });
        });

    } catch (error) {
        console.error('❌ Erreur téléchargement:', error.message);
        throw error;
    }
}

// =============================================
// 5. COMMANDE PRINCIPALE .song
// =============================================

async function handleSong(socket, msg, sender, isGroup, nowsender, args, fakevCard) {
    try {
        // ✅ EMOJI : Réaction sur la commande
        await socket.sendMessage(sender, {
            react: { text: '🎵', key: msg.key }
        }).catch(() => {});

        // Vérifier si une recherche est fournie
        if (!args || args.length === 0) {
            await socket.sendMessage(sender, {
                text: '🎵 *Utilisation de la commande .song*\n\n' +
                      'Exemple : `.song Adele Hello`\n\n' +
                      '📌 Le bot recherchera la chanson sur YouTube et vous l\'enverra en audio.'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Construire la requête de recherche
        const query = args.join(' ');
        
        // Envoyer un message de traitement
        await socket.sendMessage(sender, {
            text: `🔍 *Recherche en cours...*\n\n🎵 *${query}*\n\n⏳ Veuillez patienter, le téléchargement peut prendre quelques instants.`
        }, { quoted: fakevCard || msg });

        // Rechercher la chanson
        let songInfo;
        try {
            songInfo = await searchSong(query);
        } catch (error) {
            await socket.sendMessage(sender, {
                text: `❌ *Erreur de recherche :*\n${error.message}\n\nEssayez avec un autre titre.`
            }, { quoted: fakevCard || msg });
            return false;
        }

        // Envoyer un message de progression
        await socket.sendMessage(sender, {
            text: `📥 *Téléchargement en cours...*\n\n` +
                  `🎵 *Titre :* ${songInfo.title}\n` +
                  `👤 *Artiste :* ${songInfo.author}\n` +
                  `⏱️ *Durée :* ${songInfo.durationFormatted}\n` +
                  `👁️ *Vues :* ${songInfo.views.toLocaleString()}\n\n` +
                  `⏳ Préparation du fichier audio...`
        }, { quoted: fakevCard || msg });

        // Télécharger la chanson
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

        // 🔥 Lire le fichier en buffer (méthode fiable)
        const audioBuffer = await fs.readFile(filePath);
        const fileName = path.basename(filePath);
        const stats = fs.statSync(filePath);
        
        console.log(`📤 Envoi de l'audio: ${fileName} (${(stats.size/1024/1024).toFixed(1)}MB)`);

        // 🔥 Essayer 2 méthodes d'envoi différentes
        let sent = false;
        
        // Méthode 1: Envoi direct avec buffer
        try {
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
            sent = true;
        } catch (error) {
            console.log('⚠️ Méthode 1 échouée, tentative méthode 2...');
        }

        // Méthode 2: Envoi avec URL si la méthode 1 a échoué
        if (!sent) {
            try {
                await socket.sendMessage(sender, {
                    audio: { url: filePath },
                    mimetype: 'audio/mpeg',
                    fileName: `${songInfo.title}.mp3`,
                    caption: `🎵 *${songInfo.title}*\n` +
                             `👤 ${songInfo.author}\n` +
                             `⏱️ ${songInfo.durationFormatted}\n` +
                             `👁️ ${songInfo.views.toLocaleString()} vues\n\n` +
                             `📥 Téléchargé via Diwate-bot`
                }, { quoted: fakevCard || msg });
                sent = true;
            } catch (error) {
                console.log('⚠️ Méthode 2 échouée, tentative méthode 3...');
            }
        }

        // Méthode 3: Envoi avec stream si les 2 premières ont échoué
        if (!sent) {
            try {
                const readStream = fs.createReadStream(filePath);
                await socket.sendMessage(sender, {
                    audio: readStream,
                    mimetype: 'audio/mpeg',
                    fileName: `${songInfo.title}.mp3`,
                    caption: `🎵 *${songInfo.title}*\n` +
                             `👤 ${songInfo.author}\n` +
                             `⏱️ ${songInfo.durationFormatted}\n` +
                             `👁️ ${songInfo.views.toLocaleString()} vues\n\n` +
                             `📥 Téléchargé via Diwate-bot`
                }, { quoted: fakevCard || msg });
                sent = true;
            } catch (error) {
                console.log('⚠️ Méthode 3 échouée...');
            }
        }

        if (!sent) {
            await socket.sendMessage(sender, {
                text: `❌ *Erreur :* Impossible d'envoyer le fichier audio.\n\n` +
                      `🎵 *${songInfo.title}*\n` +
                      `👤 ${songInfo.author}\n\n` +
                      `⚠️ Essayez avec un autre titre.`
            }, { quoted: fakevCard || msg });
            
            try { fs.unlinkSync(filePath); } catch (e) {}
            return false;
        }

        // Supprimer le fichier temporaire après envoi
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
            text: `❌ *Erreur inattendue :*\n${error.message}\n\nVeuillez réessayer plus tard.`
        }, { quoted: fakevCard || msg }).catch(() => {});
        
        return false;
    }
}

// =============================================
// 6. EXPORTS
// =============================================
module.exports = { handleSong };

// Nettoyage initial
cleanupTempFiles();
