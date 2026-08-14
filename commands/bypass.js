const axios = require('axios');
const { URL } = require('url');

// =============================================
// 1. API "Unshort" (Résolution de raccourcis)
// =============================================
async function unshortLink(shortUrl) {
    try {
        const response = await axios.get(`https://unshort-api.vercel.app/api/unshort?url=${encodeURIComponent(shortUrl)}`, {
            timeout: 10000
        });

        if (response.data && response.data.destination) {
            return {
                success: true,
                originalUrl: response.data.destination,
                method: 'unshort-api'
            };
        }
        return { success: false };
    } catch (error) {
        console.error('Erreur unshort-api:', error.message);
        return { success: false };
    }
}

// =============================================
// 2. API "spoo.me" (Contournement de liens publicitaires)
// =============================================
async function bypassWithSpoo(link) {
    try {
        const response = await axios.post('https://spoo.me/',
            new URLSearchParams({ url: link }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 15000
            }
        );

        if (response.data && response.data.short_url) {
            const finalUrl = await followRedirects(response.data.short_url);
            if (finalUrl) {
                return {
                    success: true,
                    originalUrl: finalUrl,
                    method: 'spoo.me'
                };
            }
        }
        return { success: false };
    } catch (error) {
        console.error('Erreur spoo.me:', error.message);
        return { success: false };
    }
}

// =============================================
// 3. Suivi de redirection manuel (Fallback)
// =============================================
async function followRedirects(url, maxRedirects = 5) {
    let currentUrl = url;
    let redirectCount = 0;

    try {
        while (redirectCount < maxRedirects) {
            const response = await axios.get(currentUrl, {
                maxRedirects: 0,
                validateStatus: status => status >= 200 && status < 400,
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.headers.location) {
                const location = new URL(response.headers.location, currentUrl);
                currentUrl = location.toString();
                redirectCount++;
            } else {
                return currentUrl;
            }
        }
        return currentUrl;
    } catch (error) {
        console.error('Erreur followRedirects:', error.message);
        return null;
    }
}

// =============================================
// 4. Fonction principale de contournement
// =============================================
async function bypassLink(link) {
    console.log(`🔗 Tentative de contournement pour : ${link}`);

    // 1. Essayer unshort-api
    let result = await unshortLink(link);
    if (result.success) {
        console.log(`✅ Contournement réussi via unshort-api : ${result.originalUrl}`);
        return result;
    }

    // 2. Essayer spoo.me
    result = await bypassWithSpoo(link);
    if (result.success) {
        console.log(`✅ Contournement réussi via spoo.me : ${result.originalUrl}`);
        return result;
    }

    // 3. Fallback: suivre les redirections manuellement
    const finalUrl = await followRedirects(link);
    if (finalUrl && finalUrl !== link) {
        console.log(`✅ Contournement réussi via suivi manuel : ${finalUrl}`);
        return {
            success: true,
            originalUrl: finalUrl,
            method: 'manuel'
        };
    }

    console.log(`❌ Échec du contournement pour : ${link}`);
    return { success: false };
}

// =============================================
// 5. Formatage du résultat
// =============================================
function formaterResultat(resultat, lienOriginal, socket, sender) {
    if (resultat.success) {
        return {
            text: `🔓 *LIEN DÉBLOQUÉ !*\n\n` +
                  `📌 *Original :*\n${lienOriginal}\n\n` +
                  `✅ *Destination :*\n${resultat.originalUrl}\n\n` +
                  `📊 *Méthode :* ${resultat.method || 'inconnue'}\n` +
                  `> *Diwate-bot*`
        };
    } else {
        return {
            text: `❌ *ÉCHEC DU DÉBLOCAGE*\n\n` +
                  `📌 *Lien :*\n${lienOriginal}\n\n` +
                  `⚠️ *Raison :* Impossible de contourner ce lien.\n` +
                  `Il peut s'agir d'un lien protégé ou\n` +
                  `d'un service non supporté.\n\n` +
                  `> *Diwate-bot*`
        };
    }
}

// =============================================
// 6. Commande principale pour WhatsApp
// =============================================
async function handleBypass(socket, msg, sender, args, prefix, fakevCard) {
    try {
        // Accusé de réception
        await socket.sendMessage(sender, { react: { text: '🔄', key: msg.key } });

        // Vérifier les arguments
        if (args.length === 0) {
            await socket.sendMessage(sender, {
                text: `🔗 *COMMANDE .BYPASSE*\n\n` +
                      `📌 *Utilisation :*\n` +
                      `${prefix}bypasse <lien>\n\n` +
                      `📝 *Exemple :*\n` +
                      `${prefix}bypasse https://bit.ly/xxxxx\n\n` +
                      `> *Diwate-bot*`
            }, { quoted: fakevCard });
            return;
        }

        const lienOriginal = args[0];

        // Vérifier si c'est une URL valide
        try {
            new URL(lienOriginal);
        } catch (error) {
            await socket.sendMessage(sender, {
                text: `❌ *Lien invalide !*\n\n` +
                      `📌 Le lien que vous avez fourni n'est pas une URL valide.\n\n` +
                      `📝 *Exemple :*\n${prefix}bypasse https://bit.ly/xxxxx`
            }, { quoted: fakevCard });
            return;
        }

        // Message de traitement
        await socket.sendMessage(sender, {
            text: `⏳ *Déblocage en cours...*\n\n🔗 ${lienOriginal}\n\n> *Diwate-bot*`
        }, { quoted: fakevCard });

        // Tentative de déblocage
        const resultat = await bypassLink(lienOriginal);

        // Envoyer le résultat
        const message = formaterResultat(resultat, lienOriginal);
        await socket.sendMessage(sender, { text: message.text }, { quoted: fakevCard });

        // Réaction finale
        const emoji = resultat.success ? '✅' : '❌';
        await socket.sendMessage(sender, { react: { text: emoji, key: msg.key } });

    } catch (error) {
        console.error('Erreur handleBypass:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur lors du déblocage*\n\n` +
                  `⚠️ Une erreur s'est produite. Veuillez réessayer plus tard.`
        }, { quoted: fakevCard });
    }
}

// =============================================
// 7. Exports
// =============================================
module.exports = {
    handleBypass,
    bypassLink,
    unshortLink,
    bypassWithSpoo,
    followRedirects,
    formaterResultat
};
