/**
 * song.js — .song <recherche> : cherche et envoie une chanson (YouTube via play-dl).
 * npm install play-dl fs-extra axios
 * pair.js : const { handleSong } = require('./commands/song.js');
 *   case 'song': { await handleSong(socket, msg, sender, args, fakevCard); break; }
 */
const play = require('play-dl');
const fs = require('fs-extra');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function sanitize(t) {
    return t.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_').substring(0, 50) || 'audio';
}
function supprimerSansPlanter(p) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
}

async function handleSong(socket, msg, sender, args, fakevCard) {
    let filePath = null;
    try {
        if (!args || args.length === 0) {
            await socket.sendMessage(sender, { text: '🎵 Exemple : `.song Adele Hello`' }, { quoted: fakevCard || msg });
            return true;
        }
        const query = args.join(' ');
        await socket.sendMessage(sender, { react: { text: '🔎', key: msg.key } }).catch(() => {});

        const resultats = await play.search(query, { limit: 1, source: { youtube: 'video' } });
        if (!resultats || resultats.length === 0) {
            await socket.sendMessage(sender, { text: `❌ *Aucun résultat pour "${query}".*` }, { quoted: fakevCard || msg });
            return false;
        }
        const video = resultats[0];

        await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }).catch(() => {});

        const streamInfo = await play.stream(video.url);
        const fileName = `${sanitize(video.title)}_${Date.now()}.mp3`;
        filePath = path.join(TEMP_DIR, fileName);

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(filePath);
            streamInfo.stream.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
            streamInfo.stream.on('error', reject);
        });

        const stats = fs.statSync(filePath);
        if (stats.size === 0) throw new Error('Fichier audio vide');

        await socket.sendMessage(sender, {
            audio: { url: filePath },
            mimetype: 'audio/mp4',
            fileName: `${video.title}.mp3`,
            caption: `🎵 *${video.title}*\n👤 ${video.channel?.name || 'Inconnu'}`
        }, { quoted: fakevCard || msg });

        return true;
    } catch (error) {
        console.error('Erreur handleSong:', error.message);
        await socket.sendMessage(sender, { text: `❌ *Erreur :*\n${error.message}` }, { quoted: fakevCard || msg }).catch(() => {});
        return false;
    } finally {
        if (filePath) supprimerSansPlanter(filePath);
    }
}

module.exports = { handleSong };
        
