/**
 * checkban.js — Vérification de compte WhatsApp (Multi-méthodes)
 */

const axios = require('axios');

// =============================================
// 1. VÉRIFICATION VIA L'API EXTERNE
// =============================================
async function checkBanAPI(numero) {
    try {
        const cleanNumber = numero.replace(/[^0-9]/g, '');
        const url = `https://banchek-by-awais.kesug.com/bancheck.php?numero=${encodeURIComponent(cleanNumber)}`;
        
        const response = await axios.get(url, {
            timeout: 15000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/plain, */*'
            }
        });

        let data = response.data;

        // ✅ Si c'est un objet JSON standard (banned: false)
        if (typeof data === 'object' && data !== null) {
            if (data.banned === false) {
                return { status: 'active', method: 'API Externe', message: data.message || 'Compte actif' };
            }
            if (data.banned === true) {
                return { status: 'banned', method: 'API Externe', message: data.message || 'Compte banni' };
            }
        }

        // ✅ Si c'est du TEXTE (comme montré dans ta capture d'écran)
        if (typeof data === 'string') {
            // On cherche "banned: true" ou "banned: false" avec ou sans guillemets
            const isBanned = /"?banned"?\s*:\s*true/i.test(data);
            const isActive = /"?banned"?\s*:\s*false/i.test(data);

            // Extraire le message (ex: message: 'This number...')
            const msgMatch = data.match(/message\s*:\s*['"]([^'"]+)['"]/i);
            const apiMessage = msgMatch ? msgMatch[1] : 'Réceptionnée';

            if (isActive) {
                return { status: 'active', method: 'API Externe', message: apiMessage };
            }
            if (isBanned) {
                return { status: 'banned', method: 'API Externe', message: apiMessage };
            }

            // Vérifier si c'est une page HTML d'erreur (Cloudflare, etc.)
            if (data.includes('<html') || data.includes('<!DOCTYPE') || data.length > 500) {
                console.log('⚠️ L\'API a renvoyé une page HTML d\'erreur.');
                return { status: 'unknown', message: 'API externe bloquée (HTML)' };
            }
        }

        console.log('⚠️ Réponse de l'API non reconnue:', data);
        return { status: 'unknown', message: 'Réponse non reconnue' };

    } catch (error) {
        console.error('❌ Erreur checkBanAPI:', error.message);
        return { status: 'unknown', message: 'Erreur API externe' };
    }
}

// =============================================
// 2. VÉRIFICATION NATIVE WHATSAPP (Fallback)
// =============================================
async function checkAccountNative(socket, jid) {
    try {
        const [result] = await socket.onWhatsApp(jid);
        
        if (result && result.exists) {
            return { 
                status: 'active', 
                method: 'Serveur WhatsApp', 
                message: 'Le compte est enregistré sur WhatsApp. (⚠️ L\'API de ban-check est en panne, impossible de vérifier s\'il s\'agit d\'un ban temporaire).' 
            };
        } else {
            return { 
                status: 'banned', 
                method: 'Serveur WhatsApp', 
                message: 'Le compte n\'existe plus (Supprimé ou Banni définitivement).' 
            };
        }
    } catch (error) {
        console.error('❌ Erreur Native:', error.message);
        return { status: 'unknown', message: 'Erreur serveur WhatsApp.' };
    }
}

// =============================================
// 3. FORMATAGE DES MESSAGES
// =============================================
function formaterMessage(status, numero, resultat, dateStr, timeStr) {
    if (status === 'banned') {
        return `
╭─✧「 🚫 *COMPTE BANNI* 🚫 」✧─╮
│
│ 👤 *Numéro :* ${numero}
│ 📌 *Statut :* ❌ Banni
│
│ ═══════════════════════
│
│ 🔒 *Ce compte a été banni par WhatsApp*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ 📋 *Détail :* ${resultat.message || 'Non spécifiée'}
│ 📡 *Vérifié via :* ${resultat.method || 'API'}
│
╰──────────✧──────────╯`;
    }

    if (status === 'active') {
        return `
╭─✧「 ✅ *COMPTE ACTIF* ✅ 」✧─╮
│
│ 👤 *Numéro :* ${numero}
│ 📌 *Statut :* ✅ Actif
│
│ ═══════════════════════
│
│ 🟢 *Ce compte est actif et accessible !*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ 📋 *Détail :* ${resultat.message || 'Tout est en ordre'}
│ 📡 *Vérifié via :* ${resultat.method || 'API'}
│
╰──────────✧──────────╯`;
    }

    return `
╭─✧「 ❓ *ERREUR DE VÉRIFICATION* ❓ 」✧─╮
│
│ 👤 *Numéro :* ${numero}
│ 📌 *Statut :* ❓ Inconnu
│
│ ═══════════════════════
│
│ ❌ *Impossible de vérifier ce numéro.*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ 📋 *Raison :* ${resultat.message || 'Les serveurs de l\'API et WhatsApp ne répondent pas.'}
│
╰──────────✧──────────╯`;
}

// =============================================
// 4. COMMANDE PRINCIPALE .checkban
// =============================================
async function handleCheckban(socket, msg, sender, args, prefix, fakevCard, isOwner) {
    try {
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }).catch(() => {});

        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire peut utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        if (args.length === 0) {
            await socket.sendMessage(sender, {
                text: `🔍 *VÉRIFICATION DE COMPTE*\n\n📌 *Utilisation :*\n${prefix}checkban [numéro]\n\n📝 *Exemple :*\n${prefix}checkban 2250161465103`
            }, { quoted: fakevCard || msg });
            return true;
        }

        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const targetJid = `${targetNumber}@s.whatsapp.net`;

        await socket.sendMessage(sender, {
            text: `⏳ *VÉRIFICATION EN COURS...*\n\n👤 Numéro : ${targetNumber}\n📡 Connexion à l'API externe...`
        }, { quoted: fakevCard || msg });

        // 🔥 ÉTAPE 1 : API EXTERNE EN PRIORITÉ
        let resultat = await checkBanAPI(targetNumber);
        let status = resultat.status;

        // 🔥 ÉTAPE 2 : SI L'API EXTERNE EST EN PANNE (unknown), FALLBACK NATIF
        if (status === 'unknown') {
            console.log('🔄 API externe en panne, fallback sur serveur WhatsApp...');
            const nativeResult = await checkAccountNative(socket, targetJid);
            if (nativeResult.status !== 'unknown') {
                resultat = nativeResult;
                status = nativeResult.status;
            }
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const timeStr = now.toLocaleTimeString('fr-FR');

        const message = formaterMessage(status, targetNumber, resultat, dateStr, timeStr);
        await socket.sendMessage(sender, { text: message }, { quoted: fakevCard || msg });

        const emoji = status === 'banned' ? '🚫' : status === 'active' ? '✅' : '❓';
        await socket.sendMessage(sender, { react: { text: emoji, key: msg.key } }).catch(() => {});

        return true;

    } catch (error) {
        console.error('❌ Erreur handleCheckban:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur interne :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleCheckban, checkBanAPI, checkAccountNative };
