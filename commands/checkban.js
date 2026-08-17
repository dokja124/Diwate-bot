/**
 * checkban.js — Vérification de compte WhatsApp (multi-méthodes)
 */

const axios = require('axios');

// =============================================
// 1. VÉRIFICATION VIA L'API (Méthode secondaire)
// =============================================
async function checkBanAPI(numero) {
    try {
        const cleanNumber = numero.replace(/[^0-9]/g, '');
        const url = `https://banchek-by-awais.kesug.com/bancheck.php?numero=${encodeURIComponent(cleanNumber)}`;
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        // 🔥 Protection: Si l'API est morte et renvoie une page HTML au lieu de JSON
        if (typeof response.data === 'string') {
            console.log('⚠️ L\'API a renvoyé du texte (HTML) au lieu de JSON. API probablement morte.');
            return { status: 'unknown', message: 'API externe indisponible' };
        }

        const data = response.data;

        if (data && data.banned === false) {
            return { status: 'active', data: data, message: data.message || 'Compte actif (API)' };
        }
        if (data && data.banned === true) {
            return { status: 'banned', data: data, message: data.reason || data.message || 'Compte banni (API)' };
        }

        return { status: 'unknown', message: 'Réponse inattendue de l\'API' };

    } catch (error) {
        console.error('❌ Erreur checkBanAPI:', error.message);
        return { status: 'unknown', message: 'Erreur API externe' };
    }
}

// =============================================
// 2. VÉRIFICATION NATIVE WHATSAPP (Fiable à 100%)
// =============================================
async function checkAccountNative(socket, jid) {
    try {
        // socket.onWhatsApp demande directement aux serveurs de WhatsApp 
        // si le numéro est enregistré et actif.
        const [result] = await socket.onWhatsApp(jid);
        
        if (result && result.exists) {
            return { status: 'active', method: 'Serveur WhatsApp', message: 'Le numéro est actif et enregistré sur WhatsApp.' };
        } else {
            // Si WhatsApp dit que le numéro n'existe pas, c'est qu'il est banni ou supprimé
            return { status: 'banned', method: 'Serveur WhatsApp', message: 'Numéro introuvable. Le compte est banni, supprimé ou n\'a jamais existé sur WhatsApp.' };
        }
    } catch (error) {
        console.error('❌ Erreur Native:', error.message);
        return { status: 'unknown', message: 'Erreur de communication avec les serveurs WhatsApp.' };
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
│ 📌 *Statut :* ❌ Banni / Introuvable
│
│ ═══════════════════════
│
│ 🔒 *Ce compte n'existe pas sur WhatsApp*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ 📋 *Détail :* ${resultat.message || 'Non spécifiée'}
│ 📡 *Vérifié via :* ${resultat.method || 'API'}
│
│ ⚠️ *Raisons possibles :*
│ • Spam ou comportement abusif
│ • Violation des conditions d'utilisation
│ • Le compte a été supprimé par l'utilisateur
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
│ 📡 *Vérifié via :* ${resultat.method || 'API'}
│
│ 💚 *Tout est en ordre !*
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
async function handleCheckban(socket, msg, sender, args, fakevCard, isOwner) {
    try {
        // Accusé de réception
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }).catch(() => {});

        // Vérification des permissions
        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire peut utiliser cette commande.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Vérification des arguments
        if (args.length === 0) {
            await socket.sendMessage(sender, {
                text: `🔍 *VÉRIFICATION DE COMPTE*\n\n📌 *Utilisation :*\n${prefix}checkban [numéro]\n\n📝 *Exemple :*\n${prefix}checkban 2250576991050`
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Nettoyer le numéro
        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const targetJid = `${targetNumber}@s.whatsapp.net`;

        // Message de traitement
        await socket.sendMessage(sender, {
            text: `⏳ *VÉRIFICATION EN COURS...*\n\n👤 Numéro : ${targetNumber}\n📡 Contact des serveurs WhatsApp...`
        }, { quoted: fakevCard || msg });

        // 🔥 Étape 1: Utiliser la méthode Native (100% fiable)
        let resultat = await checkAccountNative(socket, targetJid);
        let status = resultat.status;

        // 🔥 Étape 2: Si la méthode native échoue (rare), essayer l'API externe
        if (status === 'unknown') {
            console.log('🔄 Méthode native inconnue, essai via API externe...');
            const apiResult = await checkBanAPI(targetNumber);
            if (apiResult.status !== 'unknown') {
                resultat = apiResult;
                status = apiResult.status;
            }
        }

        // Date et heure
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const timeStr = now.toLocaleTimeString('fr-FR');

        // 🔥 Étape 3: Générer et envoyer le message
        const message = formaterMessage(status, targetNumber, resultat, dateStr, timeStr);
        await socket.sendMessage(sender, { text: message }, { quoted: fakevCard || msg });

        // Réaction finale
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

// =============================================
// 5. EXPORTS
// =============================================
module.exports = { handleCheckban, checkBanAPI, checkAccountNative };
