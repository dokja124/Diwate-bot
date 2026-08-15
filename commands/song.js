/**
 * song.js — Téléchargement et envoi de chansons/musiques
 * Utilisation : .song <titre> ou .song <lien YouTube>
 * 
 * 📦 Utilise bebytdl pour le téléchargement (stable et fiable)
 * Installation : npm install bebytdl yt-search axios fs-extra
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const bebytdl = require('bebytdl');
const ytSearch = require('yt-search');

// =============================================
// 1. RECHERCHER UNE CHANSON SUR YOUTUBE
// =============================================
async function searchSong(query) {
    try {
        const result = await ytSearch(query);
        const videos = result.videos;
        
        if (!videos || videos.length === 0) {
            throw new Error('Aucune chanson trouvée.');
        }

        const video = videos[0];
        return {
            title: video.title,
            url: video.url,
            duration: video.duration,
            thumbnail: video.thumbnail,
            author: video.author.name
        };
    } catch (error) {
        console.error('❌ Erreur recherche:', error.message);
        throw new Error('Impossible de rechercher la chanson.');
    }
}

// =============================================
// 2. TÉLÉCHARGER UNE CHANSON AVEC BEBYTDL
// =============================================
async function downloadSong(url) {
    try {
        console.log(`🎵 Téléchargement avec bebytdl : ${url}`);

        const result = await bebytdl.downloadAudio(url, {
            quality: 'high',
            format: 'mp3'
        });

        if (!result.success) {
            throw new Error(result.error || 'Échec du téléchargement');
        }

        const data = result.data;
        const title = data.title.replace(/[^a-zA-Z0-9]/g, '_');
        
        if (!fs.existsSync('./temp')) {
            fs.mkdirSync('./temp', { recursive: true });
        }

        const outputPath = path.join('./temp', `${title}.mp3`);
        
        const response = await axios({
            method: 'get',
            url: data.downloadLinks[0].url,
            responseType: 'stream',
            timeout: 60000
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✅ Téléchargement terminé : ${outputPath}`);
                resolve({
                    path: outputPath,
                    title: data.title,
                    filename: path.basename(outputPath),
                    duration: data.duration,
                    author: data.author.name
                });
            });
            
            writer.on('error', (error) => {
                reject(error);
            });
            
            response.data.on('error', (error) => {
                reject(error);
            });
        });

    } catch (error) {
        console.error('❌ Erreur téléchargement bebytdl:', error.message);
        throw new Error(`Impossible de télécharger la chanson : ${error.message}`);
    }
}

// =============================================
// 3. TÉLÉCHARGER UNE CHANSON AVEC YT-DLP (FALLBACK)
// =============================================
async function downloadSongFallback(url) {
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
        const outputTemplate = './temp/%(title)s.%(ext)s';
        const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" ${url}`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            
            const files = fs.readdirSync('./temp');
            const mp3Files = files.filter(f => f.endsWith('.mp3'));
            
            if (mp3Files.length === 0) {
                reject(new Error('Aucun fichier MP3 trouvé'));
                return;
            }
            
            const latestFile = mp3Files[mp3Files.length - 1];
            const filePath = path.join('./temp', latestFile);
            
            resolve({
                path: filePath,
                title: path.basename(latestFile, '.mp3'),
                filename: latestFile
            });
        });
    });
}

// =============================================
// 4. FORMATER LA DURÉE
// =============================================
function formatDuration(seconds) {
    if (!seconds) return '00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// =============================================
// 5. ENVOYER LA CHANSON DANS WHATSAPP
// =============================================
async function sendSong(socket, sender, songPath, title, caption = '') {
    try {
        const audioBuffer = fs.readFileSync(songPath);
        
        await socket.sendMessage(sender, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            caption: caption || `🎵 *${title}*\n\n> *Diwate-bot*`
        });
        
        console.log(`✅ Chanson envoyée : ${title}`);
        return true;
    } catch (error) {
        console.error('❌ Erreur envoi audio:', error.message);
        throw new Error('Impossible d\'envoyer la chanson.');
    }
}

// =============================================
// 6. COMMANDE PRINCIPALE .song
// =============================================
async function handleSong(socket, msg, sender, args, prefix, fakevCard, isOwner) {
    try {
        // ✅ RÉACTION AVEC L'EMOJI 🎵 SUR LE MESSAGE
        await socket.sendMessage(sender, { react: { text: '🎵', key: msg.key } });

        // Vérifier les arguments
        if (args.length === 0) {
            await socket.sendMessage(sender, {
                text: `🎵 *COMMANDE .SONG*\n\n📌 *Utilisation :*\n.song <titre de la chanson>\n.song <lien YouTube>\n\n📝 *Exemples :*\n.song Never Gonna Give You Up\n.song https://youtu.be/dQw4w9WgXcQ\n\n⚡ *Téléchargement rapide et fiable*`
            }, { quoted: fakevCard || msg });
            return true;
        }

        const query = args.join(' ');
        let videoUrl = query;
        let videoInfo = null;

        // Vérifier si c'est un lien YouTube
        const isUrl = query.includes('youtu.be') || query.includes('youtube.com');
        
        if (isUrl) {
            videoInfo = {
                title: query,
                url: query,
                author: 'YouTube'
            };
        } else {
            try {
                await socket.sendMessage(sender, {
                    text: `🔍 *Recherche :* ${query}\n\n⏳ Recherche en cours...`
                }, { quoted: fakevCard || msg });

                videoInfo = await searchSong(query);
            } catch (error) {
                await socket.sendMessage(sender, {
                    text: `❌ *Aucune chanson trouvée pour :* "${query}"`
                }, { quoted: fakevCard || msg });
                return true;
            }
        }

        // Message de début de téléchargement
        await socket.sendMessage(sender, {
            text: `⏳ *Téléchargement en cours...*\n\n🎵 *Titre :* ${videoInfo.title}\n👤 *Artiste :* ${videoInfo.author || 'Inconnu'}\n\n⏰ Cela peut prendre quelques instants...`
        }, { quoted: fakevCard || msg });

        try {
            let song;
            
            try {
                song = await downloadSong(videoInfo.url);
            } catch (bebytdlError) {
                console.warn('⚠️ bebytdl a échoué, fallback vers yt-dlp...');
                song = await downloadSongFallback(videoInfo.url);
            }
            
            const caption = `🎵 *${song.title}*\n👤 *Artiste :* ${videoInfo.author || 'Inconnu'}\n⏱️ *Durée :* ${formatDuration(song.duration)}\n\n> *Diwate-bot*`;
            
            await sendSong(socket, sender, song.path, song.title, caption);
            
            if (fs.existsSync(song.path)) {
                fs.unlinkSync(song.path);
                console.log(`🗑️ Fichier temporaire supprimé : ${song.path}`);
            }

            // ✅ RÉACTION FINALE AVEC L'EMOJI ✅
            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            await socket.sendMessage(sender, {
                text: `❌ *Erreur lors du téléchargement :*\n${error.message}\n\n💡 Essayez un autre titre ou lien.`
            }, { quoted: fakevCard || msg });
            return true;
        }

        return true;

    } catch (error) {
        console.error('❌ Erreur handleSong:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg });
        return true;
    }
}

// =============================================
// 7. EXPORTS
// =============================================
module.exports = { 
    handleSong, 
    searchSong, 
    downloadSong, 
    downloadSongFallback,
    sendSong,
    formatDuration
};
