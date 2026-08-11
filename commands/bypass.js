/**
 * bypass.js — Commande .bypass : bypass les liens Linkvertise, Sub2Unlock, etc.
 * 
 * Utilise plusieurs APIs gratuites pour contourner les liens
 * 
 * pair.js : const { handleBypass } = require('./bypass');
 *   case 'bypass': { await handleBypass(socket, msg, sender, args, fakevCard, isOwner); break; }
 */

const axios = require('axios');

// =============================================
// 1. LISTE DES APIS DE BYPASS
// =============================================
const BYPASS_APIS = [
    {
        name: 'Bypass.vip',
        url: (url) => `https://api.bypass.vip/bypass?url=${encodeURIComponent(url)}`
    },
    {
        name: 'Bypass.bot.nu',
        url: (url) => `https://bypass.bot.nu/bypass2?url=${encodeURIComponent(url)}`
    },
    {
        name: 'Linkvertise.download',
        url: (url) => `https://linkvertise.download/api/bypass?url=${encodeURIComponent(url)}`
    },
    {
        name: 'Bypass.beauty',
        url: (url) => `https://bypass.beauty/api/bypass?url=${encodeURIComponent(url)}`
    },
    {
        name: 'Bypass.pm',
        url: (url) => `https://bypass.pm/api/v1/bypass?url=${encodeURIComponent(url)}`
    },
    {
        name: 'Sub2Unlock',
        url: (url) => `https://sub2unlock.com/api/bypass?url=${encodeURIComponent(url)}`
    }
];

// =============================================
// 2. FONCTION DE BYPASS
// =============================================
async function bypassLink(url) {
    // Détecter le type de lien
    const isLinkvertise = url.includes('linkvertise') || url.includes('link-to.net');
    const isSub2Unlock = url.includes('sub2unlock');
    const isAdfly = url.includes('adf.ly') || url.includes('adfoc.us');
    const isShorte = url.includes('shorte.st');

    console.log(`🔍 Détection: Linkvertise=${isLinkvertise}, Sub2Unlock=${isSub2Unlock}, Adfly=${isAdfly}`);

    // Essayer chaque API
    for (const api of BYPASS_APIS) {
        try {
            const apiUrl = api.url(url);
            console.log(`🔄 Tentative avec ${api.name}...`);

            const response = await axios.get(apiUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });

            console.log(`📊 Réponse ${api.name}:`, response.data);

            // Vérifier différents formats de réponse
            let destination = null;

            if (response.data) {
                if (response.data.destination) {
                    destination = response.data.destination;
                } else if (response.data.url) {
                    destination = response.data.url;
                } else if (response.data.result) {
                    destination = response.data.result;
                } else if (response.data.link) {
                    destination = response.data.link;
                } else if (typeof response.data === 'string' && response.data.startsWith('http')) {
                    destination = response.data;
                }
            }

            if (destination && destination !== url) {
                console.log(`✅ Bypass réussi avec ${api.name}: ${destination}`);
                return {
                    success: true,
                    url: destination,
                    source: api.name,
                    original: url
                };
            }

        } catch (error) {
            console.log(`❌ ${api.name} échoué:`, error.message);
            continue;
        }
    }

    return {
        success: false,
        error: 'Aucune API n\'a réussi à bypasser ce lien',
        original: url
    };
}

// =============================================
// 3. BYPASS AVEC SÉLECTION MANUELLE
// =============================================
async function bypassWithMethod(url, method) {
    const api = BYPASS_APIS.find(a => a.name.toLowerCase() === method.toLowerCase());
    if (!api) {
        return { success: false, error: `Méthode "${method}" non trouvée` };
    }

    try {
        const response = await axios.get(api.url(url), {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        let destination = null;
        if (response.data) {
            if (response.data.destination) destination = response.data.destination;
            else if (response.data.url) destination = response.data.url;
            else if (response.data.result) destination = response.data.result;
            else if (response.data.link) destination = response.data.link;
            else if (typeof response.data === 'string' && response.data.startsWith('http')) destination = response.data;
        }

        if (destination) {
            return { success: true, url: destination, source: api.name };
        }

        return { success: false, error: 'Aucune destination trouvée' };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// =============================================
// 4. COMMANDE PRINCIPALE .bypass
// =============================================
async function handleBypass(socket, msg, sender, args, fakevCard, isOwner) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '🔓', key: msg.key } }).catch(() => {});

        // 1. Vérifier que l'utilisateur est le propriétaire
        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire peut utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 2. Vérifier l'URL
        if (args.length === 0) {
            await socket.sendMessage(sender, {
                text: `🔓 *BYPASS DE LIENS*\n\n📌 *Utilisation :*\n.bypass [url]\n\n📌 *Exemple :*\n.bypass https://linkvertise.com/...\n\n📌 *Méthodes disponibles :*\n${BYPASS_APIS.map(a => `• ${a.name}`).join('\n')}\n\n📌 *Avec méthode spécifique :*\n.bypass [url] [méthode]\n.bypass https://linkvertise.com/... Bypass.vip`
            }, { quoted: fakevCard || msg });
            return true;
        }

        const url = args[0];
        const method = args[1] || null;

        await socket.sendMessage(sender, {
            text: `🔓 *BYPASS EN COURS...*\n\n🔗 ${url}`
        }, { quoted: fakevCard || msg });

        let result;

        // Si une méthode est spécifiée
        if (method) {
            result = await bypassWithMethod(url, method);
        } else {
            result = await bypassLink(url);
        }

        if (result.success) {
            await socket.sendMessage(sender, {
                text: `✅ *LIEN BYPASSÉ !*\n\n` +
                      `🔗 *Lien original :*\n${result.original || url}\n\n` +
                      `🔓 *Lien débloqué :*\n${result.url}\n\n` +
                      `📡 *Méthode :* ${result.source || 'Automatique'}\n\n` +
                      `📌 *Copie :* \`${result.url}\``
            }, { quoted: fakevCard || msg });
        } else {
            await socket.sendMessage(sender, {
                text: `❌ *ÉCHEC DU BYPASS*\n\n` +
                      `🔗 ${url}\n\n` +
                      `❌ *Erreur :*\n${result.error || 'Aucune méthode disponible'}\n\n` +
                      `📌 *Essayez avec une méthode spécifique :*\n.bypass ${url} Bypass.vip`
            }, { quoted: fakevCard || msg });
        }

        return true;

    } catch (error) {
        console.error('❌ Erreur handleBypass:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

// =============================================
// 5. EXPORTS
// =============================================
module.exports = { 
    handleBypass, 
    bypassLink, 
    BYPASS_APIS,
    bypassWithMethod 
};
