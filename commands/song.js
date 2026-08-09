const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const TEMP_DIR = path.join(__dirname, 'temp');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB maximum

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function sanitizeFileName(title) {
    return title.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_').substring(0, 50) || 'audio';
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

/**
 * Supprime un fichier sans planter si l'opération échoue.
 * (corrige le bug de l'ancienne version : unlinkSync() n'a pas de .catch())
 */
function supprimerSansPlanter(filePath) {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
        console.error('Erreur suppression fichier:', e.message);
    }
}

// =============================================
// FOURNISSEURS (recherche + lien direct de téléchargement)
// Chacun renvoie { title, url (mp3 direct), duration, thumbnail, author }
// =============================================

async function viaDavidCyrilTech(query) {
    const { data } = await axios.get('https://apis.davidcyriltech.my.id/download/song', {
        params: { title: query },
        timeout: 20000
    });
    const r = data?.result || data;
    if (!r?.download_url && !r?.url) throw new Error('DavidCyrilTech: pas de lien audio');
    return {
        title: r.title || query,
        url: r.download_url || r.url,
        duration: r.duration || null,
        thumbnail: r.thumbnail || r.image || null,
        author: r.author || r.channel || 'Inconnu'
    };
}

async function viaGiftedTech(query) {
    const { data } = await axios.get('https://api.giftedtech.web.id/api/download/play', {
        params: { apikey: 'gifted', query },
        timeout: 20000
    });
    const r = data?.result || data;
    if (!r?.download_url && !r?.audio) throw new Error('GiftedTech: pas de lien audio');
    return {
        title: r.title || query,
        url: r.download_url || r.audio,
        duration: r.duration || null,
        thumbnail: r.thumbnail || null,
        author: r.author || 'Inconnu'
    };
}

async function viaDreadedSite(query) {
    const { data } = await axios.get('https://api.dreaded.site/api/ytmp3', {
        params: { text: query },
        timeout: 20000
    });
    const r = data?.result || data;
    if (!r?.downloadUrl && !r?.url) throw new Error('DreadedSite: pas de lien audio');
    return {
        title: r.title || query,
        url: r.downloadUrl || r.url,
        duration: r.duration || null,
        thumbnail: r.thumbnail || null,
        author: r.author || 'Inconnu'
    };
}

/**
 * Essaie chaque fournisseur dans l'ordre jusqu'à ce qu'un fonctionne.
 */
async function rechercherEtObtenirLien(query) {
    const fournisseurs = [
        { nom: 'DavidCyrilTech', fn: viaDavidCyrilTech },
        { nom: 'GiftedTech', fn: viaGiftedTech },
        { nom: 'DreadedSite', fn: viaDreadedSite },
    ];

    const erreurs = [];
    for (const { nom, fn } of fournisseurs) {
        try {
            const resultat = await fn(query);
            console.log(`✅ Chanson trouvée via ${nom}: ${resultat.title}`);
            return resultat;
        } catch (error) {
            const status = error.response?.status;
            erreurs.push(`${nom}${status ? ` (HTTP ${status})` : ''}: ${error.message}`);
            console.error(`❌ Échec ${nom}:`, error.message);
        }
    }

    throw new Error(`Tous les services de recherche ont échoué.\n${erreurs.join('\n')}`);
}

/**
 * Télécharge le fichier audio depuis son URL directe.
 */
async function telechargerDepuisUrl(url, titre) {
    const fileName = `${sanitizeFileName(titre)}_${Date.now()}.mp3`;
    const filePath = path.join(TEMP_DIR, fileName);

    const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 60000,
        maxContentLength: MAX_FILE_SIZE
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
    });

    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
        supprimerSansPlanter(filePath);
        throw new Error(`Fichier trop volumineux (${(stats.size / 1024 / 1024).toFixed(1)}MB > 50MB)`);
    }
    if (stats.size === 0) {
        supprimerSansPlanter(filePath);
        throw new Error('Fichier téléchargé vide (lien audio invalide)');
    }

    return filePath;
}

// =============================================
// COMMANDE PRINCIPALE .song
// =============================================
async function handleSong(socket, msg, sender, isGroup, nowsender, args, fakevCard) {
    let filePath = null;
    try {
        if (!args || args.length === 0) {
            await socket.sendMessage(sender, {
                text: '🎵 *Utilisation de la commande .song*\n\nExemple : `.song Adele Hello`\n\n📌 Le bot recherchera la chanson et te l\'enverra en audio.'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const query = args.join(' ');

        await socket.sendMessage(sender, { react: { text: '🔎', key: msg.key } }).catch(() => {});

        let songInfo;
        try {
            songInfo = await rechercherEtObtenirLien(query);
        } catch (error) {
            await socket.sendMessage(sender, {
                text: `❌ *Erreur de recherche :*\n${error.message}`
            }, { quoted: fakevCard || msg });
            return false;
        }

        await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }).catch(() => {});

        try {
            filePath = await telechargerDepuisUrl(songInfo.url, songInfo.title);
        } catch (error) {
            await socket.sendMessage(sender, {
                text: `❌ *Erreur de téléchargement :*\n${error.message}`
            }, { quoted: fakevCard || msg });
            return false;
        }

        const fileName = path.basename(filePath);
        const stats = fs.statSync(filePath);
        console.log(`📤 Envoi de l'audio: ${fileName} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);

        await socket.sendMessage(sender, {
            audio: { url: filePath },
            mimetype: 'audio/mp4',
            fileName: `${songInfo.title}.mp3`,
            caption: `🎵 *${songInfo.title}*\n👤 ${songInfo.author}\n\n📥 Téléchargé via Diwate-bot`
        }, { quoted: fakevCard || msg });

        return true;

    } catch (error) {
        console.error('❌ Erreur handleSong:', error);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur inattendue :*\n${error.message}\n\nVeuillez réessayer plus tard.`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return false;
    } finally {
        if (filePath) supprimerSansPlanter(filePath);
    }
}

module.exports = { handleSong };

cleanupTempFiles();
    
