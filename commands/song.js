/**
 * song.js — Commande .song avec Deezer (gratuit, sans clé API)
 * 
 * Installation : npm install axios fs-extra
 * 
 * pair.js : const { handleSong } = require('./song');
 *   case 'song': { await handleSong(socket, msg, sender, isGroup, nowsender, args, fakevCard); break; }
 */

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const TEMP_DIR = path.join(__dirname, 'temp');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// =============================================
// 1. FONCTIONS UTILITAIRES
// =============================================

function sanitizeFileName(title) {
    return title.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_').substring(0, 50);
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

// =============================================
// 2. RECHERCHE SUR DEEZER
// =============================================

async function searchDeezer(query) {
    try {
        console.log(`🔍 Recherche Deezer: ${query}`);
        
        const response = await axios.get('https://api.deezer.com/search', {
            params: {
                q: query,
                limit: 5
            },
            timeout: 10000
        });

        if (!response.data || !response.data.data || response.data.data.length === 0) {
            throw new Error('Aucune chanson trouvée sur Deezer');
        }

        const track = response.data.data[0];
        
        console.log(`✅ Trouvé: ${track.title} - ${track.artist.name}`);
        console.log(`⏱️ Durée: ${formatDuration(track.duration)}`);

        return {
            title: track.title,
            artist: track.artist.name,
            album: track.album.title,
            duration: track.duration,
            durationFormatted: formatDuration(track.duration),
            cover: track.album.cover_medium,
            id: track.id,
            preview: track.preview,
            link: track.link
        };

    } catch (error) {
        console.error('❌ Erreur recherche Deezer:', error.message);
        throw error;
    }
}

// =============================================
// 3. TÉLÉCHARGEMENT DEPUIS DEEZER
// =============================================

async function downloadDeezer(trackId, title, artist) {
    try {
        const fileName = `${sanitizeFileName(title)}_${sanitizeFileName(artist)}.mp3`;
        const filePath = path.join(TEMP_DIR, fileName);

        // Vérifier si le fichier existe déjà
        if (fs.existsSync(filePath)) {
            console.log(`✅ Fichier déjà existant: ${fileName}`);
            return filePath;
        }

        console.log(`📥 Téléchargement: ${title} - ${artist}`);

        // 🔥 Méthode 1 : Utiliser l'API Deezer pour obtenir le lien de téléchargement
        // Note: Deezer ne permet pas le téléchargement direct officiellement
        // On utilise une méthode alternative via un service tiers

        // Méthode alternative : Utiliser un service de téléchargement Deezer
        const downloadUrl = `https://api.deezer.com/track/${trackId}`;
        
        // Récupérer les infos du morceau
        const trackInfo = await axios.get(downloadUrl);
        
        if (!trackInfo.data) {
            throw new Error('Impossible de récupérer les informations du morceau');
        }

        // 🔥 Pour le téléchargement réel, on utilise une approche alternative
        // On va chercher le fichier audio via un service de téléchargement
        
        // Option: Utiliser un service de téléchargement tiers (exemple)
        // Note: Ces services peuvent changer, c'est un exemple
        const serviceUrl = `https://api.some-downloader.com/deezer/download/${trackId}`;
        
        try {
            const response = await axios.get(serviceUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
            });

            if (response.data) {
                await fs.writeFile(filePath, response.data);
                console.log(`✅ Téléchargement terminé: ${fileName}`);
                return filePath;
            }
        } catch (downloadError) {
            console.log('⚠️ Service de téléchargement indisponible, utilisation de la preview...');
        }

        // 🔥 Fallback : Utiliser le preview (extrait de 30s) si disponible
        try {
            const trackData = trackInfo.data;
            if (trackData.preview) {
                const previewResponse = await axios.get(trackData.preview, {
                    responseType: 'arraybuffer',
                    timeout: 15000
                });

                if (previewResponse.data) {
                    await fs.writeFile(filePath, previewResponse.data);
                    console.log(`✅ Preview téléchargé: ${fileName} (extrait 30s)`);
                    return filePath;
                }
            }
        } catch (previewError) {
            console.log('⚠️ Preview indisponible');
        }

        throw new Error('Impossible de télécharger le fichier audio');

    } catch (error) {
        console.error('❌ Erreur téléchargement Deezer:', error.message);
        throw error;
    }
}

// =============================================
// 4. TÉLÉCHARGEMENT VIA UN SERVICE EXTERNE (ALTERNATIVE)
// =============================================

async function downloadViaExternalService(query) {
    try {
        // Exemple avec un service de téléchargement
        // Note: Ces services peuvent changer, c'est un exemple
        const response = await axios.get('https://api.some-downloader.com/search', {
            params: {
                q: query,
                type: 'mp3'
            },
            timeout: 15000
        });

        if (response.data && response.data.url) {
            const audioResponse = await axios.get(response.data.url, {
                responseType: 'arraybuffer',
                timeout: 30000
            });

            const fileName = `${sanitizeFileName(response.data.title)}.mp3`;
            const filePath = path.join(TEMP_DIR, fileName);
            
            await fs.writeFile(filePath, audioResponse.data);
            return {
                filePath,
                title: response.data.title,
                artist: response.data.artist || 'Inconnu'
            };
        }

        throw new Error('Aucun résultat trouvé');

    } catch (error) {
        console.error('❌ Erreur service externe:', error.message);
        throw error;
    }
}

// =============================================
// 5. COMMANDE PRINCIPALE .song
// =============================================

async function handleSong(socket, msg, sender, isGroup, nowsender, args, fakevCard) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '🎵', key: msg.key } }).catch(() => {});

        if (!args || args.length === 0) {
            await socket.sendMessage(sender, {
                text: '🎵 *Utilisation :*\n.song [titre]\n\n📌 *Exemples :*\n.song Adele Hello\n.song Daft Punk Get Lucky'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const query = args.join(' ');
        
        // Message de recherche
        await socket.sendMessage(sender, {
            text: `🔍 *Recherche sur Deezer :* ${query}`
        }, { quoted: fakevCard || msg });

        // 1. Rechercher la chanson
        let songInfo;
        try {
            songInfo = await searchDeezer(query);
        } catch (error) {
            await socket.sendMessage(sender, {
                text: `❌ *Erreur de recherche :*\n${error.message}`
            }, { quoted: fakevCard || msg });
            return false;
        }

        // Message de téléchargement
        await socket.sendMessage(sender, {
            text: `📥 *Téléchargement...*\n\n🎵 *${songInfo.title}*\n👤 *${songInfo.artist}*\n💿 *${songInfo.album}*\n⏱️ *${songInfo.durationFormatted}*`
        }, { quoted: fakevCard || msg });

        // 2. Télécharger la chanson
        let filePath;
        try {
            filePath = await downloadDeezer(songInfo.id, songInfo.title, songInfo.artist);
        } catch (error) {
            // Si le téléchargement direct échoue, essayer via un service externe
            await socket.sendMessage(sender, {
                text: `🔄 *Tentative via service alternatif...*`
            }, { quoted: fakevCard || msg });

            try {
                const result = await downloadViaExternalService(`${songInfo.title} ${songInfo.artist}`);
                filePath = result.filePath;
                songInfo.title = result.title;
                songInfo.artist = result.artist;
            } catch (fallbackError) {
                await socket.sendMessage(sender, {
                    text: `❌ *Erreur de téléchargement :*\n${error.message}`
                }, { quoted: fakevCard || msg });
                return false;
            }
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
        
        console.log(`📤 Envoi de l'audio: ${fileName} (${(stats.size/1024/1024).toFixed(1)}MB)`);

        // 4. Envoyer l'audio
        await socket.sendMessage(sender, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${songInfo.title} - ${songInfo.artist}.mp3`,
            caption: `🎵 *${songInfo.title}*\n👤 *${songInfo.artist}*\n💿 *${songInfo.album}*\n⏱️ *${songInfo.durationFormatted}*\n\n📥 *Téléchargé via Deezer*`
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

cleanupTempFiles();
