/**
 * image.js — Commande .image <recherche> : cherche une image sur Pinterest
 * et l'envoie.
 * ---------------------------------------------------------------
 * Utilise le point d'accès interne (non-officiel) de Pinterest pour la
 * recherche de "pins" — aucune clé API nécessaire, mais peut casser si
 * Pinterest change sa structure interne (dans ce cas, message d'erreur
 * clair plutôt qu'un plantage).
 *
 * Comment l'intégrer dans pair.js :
 * ----------------------------------
 * 1. En haut de pair.js, ajoute :
 *      const { handleImage } = require('./image');
 *
 * 2. Dans le switch(command), ajoute :
 *      case 'image': {
 *          await handleImage(socket, msg, sender, args, fakevCard);
 *          break;
 *      }
 */

const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*, q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Pinterest-PWS-Handler': 'www/search/[scope].js',
    'Referer': 'https://www.pinterest.com/'
};

/**
 * Recherche des images sur Pinterest pour une requête donnée.
 * Retourne un tableau d'URLs d'images (haute résolution quand possible).
 */
async function rechercherPinterest(requete, limite = 15) {
    const dataParam = JSON.stringify({
        options: { query: requete, scope: 'pins', page_size: limite },
        context: {}
    });
    const sourceUrl = `/search/pins/?q=${encodeURIComponent(requete)}`;
    const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(dataParam)}`;

    const { data } = await axios.get(url, { headers: HEADERS, timeout: 12000 });

    const resultats = data?.resource_response?.data?.results || [];
    const urls = [];

    for (const item of resultats) {
        const images = item?.images;
        if (!images) continue;
        const meilleureImage = images.orig?.url || images['736x']?.url || images['474x']?.url || images['236x']?.url;
        if (meilleureImage) urls.push(meilleureImage);
    }

    return urls;
}

async function handleImage(socket, msg, sender, args, fakevCard) {
    try {
        if (!args || args.length === 0) {
            await socket.sendMessage(sender, {
                text: '❌ *Indique ce que tu cherches.*\n\n📌 Exemple : .image chat mignon'
            }, { quoted: fakevCard || msg }).catch(() => {});
            return true;
        }

        const requete = args.join(' ');
        await socket.sendMessage(sender, { react: { text: '🔎', key: msg.key } }).catch(() => {});

        const urls = await rechercherPinterest(requete);

        if (!urls || urls.length === 0) {
            await socket.sendMessage(sender, {
                text: `❌ *Aucune image trouvée pour "${requete}".*`
            }, { quoted: fakevCard || msg }).catch(() => {});
            return true;
        }

        const imageChoisie = urls[Math.floor(Math.random() * urls.length)];

        await socket.sendMessage(sender, {
            image: { url: imageChoisie },
            caption: `📌 *Résultat Pinterest pour :* ${requete}`
        }, { quoted: fakevCard || msg });

        return true;
    } catch (error) {
        console.error('Erreur handleImage:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur lors de la recherche Pinterest :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleImage, rechercherPinterest };
  
