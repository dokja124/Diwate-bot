/**
 * checkban.js — Vérification de compte WhatsApp (multi-méthodes)
 */

const axios = require('axios');

// =============================================
// 1. VÉRIFICATION VIA L'API (avec différents formats)
// =============================================
async function checkBanAPI(numero) {
    // Essayer différents formats
    const formats = [
        numero,                          // 2250576991050
        `+${numero}`,                    // +2250576991050
        `${numero.substring(0, 3)} ${numero.substring(3)}`, // 225 0576991050
        `${numero.substring(0, 3)}-${numero.substring(3)}`  // 225-0576991050
    ];

    for (const format of formats) {
        try {
            const url = `https://banchek-by-awais.kesug.com/bancheck.php?numero=${encodeURIComponent(format)}`;
            console.log(`🔍 Test avec format: ${format}`);
            
            const response = await axios.get(url, {
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            console.log(`📊 Réponse:`, response.data);

            // Vérifier si la réponse indique un compte valide
            if (response.data && response.data.error === false) {
                return { status: 'active', data: response.data };
            }
            
            // Si le message contient "not" ou "invalid", c'est probablement inconnu
            const msg = response.data?.message || '';
            if (msg.toLowerCase().includes('not') || 
                msg.toLowerCase().includes('invalid') ||
                msg.toLowerCase().includes('no')) {
                continue; // Essayer le format suivant
            }

        } catch (error) {
            console.log(`❌ Erreur avec format ${format}:`, error.message);
            continue;
        }
    }

    return { status: 'unknown' };
}

// =============================================
// 2. VÉRIFICATION LOCALE (la plus fiable)
// =============================================
async function checkAccountLocal(socket, jid) {
    try {
        // Méthode 1: Vérifier la photo de profil
        try {
            await socket.profilePictureUrl(jid, 'image');
            return { status: 'active', method: 'photo' };
        } catch (e) {}

        // Méthode 2: Vérifier le statut "about"
        try {
            const status = await socket.fetchStatus(jid);
            if (status) {
                return { status: 'active', method: 'status' };
            }
        } catch (e) {}

        // Méthode 3: Envoyer un message test (le plus fiable)
        try {
            await socket.sendMessage(jid, { text: '🔍' });
            return { status: 'active', method: 'message' };
        } catch (error) {
            const errMsg = error.message || '';
            if (errMsg.includes('not-authorized') || 
                errMsg.includes('banned') ||
                errMsg.includes('blocked') ||
                errMsg.includes('403')) {
                return { status: 'banned' };
            }
        }

        // Si on arrive ici, le compte n'existe pas
        return { status: 'unknown' };

    } catch (error) {
        console.error('❌ Erreur locale:', error.message);
        return { status: 'unknown' };
    }
}

// =============================================
// 3. COMMANDE PRINCIPALE .checkban
// =============================================
async function handleCheckban(socket, msg, sender, args, fakevCard, isOwner) {
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
                text: `🔍 *VÉRIFICATION DE COMPTE*\n\n📌 *Utilisation :*\n.checkban +225xxxxxxxx\n\n📌 *Exemple :*\n.checkban +2250576991050`
            }, { quoted: fakevCard || msg });
            return true;
        }

        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const targetJid = `${targetNumber}@s.whatsapp.net`;

        await socket.sendMessage(sender, {
            text: `🔍 *VÉRIFICATION EN COURS...*`
        }, { quoted: fakevCard || msg });

        // 🔥 Étape 1: Essayer l'API
        let result = await checkBanAPI(targetNumber);

        // 🔥 Étape 2: Si l'API dit "unknown", utiliser la méthode locale
        if (result.status === 'unknown') {
            console.log('🔄 API = inconnu, vérification locale...');
            result = await checkAccountLocal(socket, targetJid);
        }

        // 🔥 Message stylé
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const timeStr = now.toLocaleTimeString('fr-FR');

        let message = '';

        if (result.status === 'banned') {
            message = `
╭─✧「 🚫 *COMPTE BANNI* 🚫 」✧─╮
│
│ 👤 *Numéro :* ${targetNumber}
│ 📌 *Statut :* ❌ Banni
│
│ ═══════════════════════
│
│ 🔒 *Ce compte a été banni par WhatsApp*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ ⚠️ *Raisons possibles :*
│ • Spam ou comportement abusif
│ • Violation des conditions d'utilisation
│ • Signalements multiples
│
│ 🛡️ *Recommandation :*
│ Contacter le support WhatsApp
│
╰──────────✧──────────╯
            `;
        } else if (result.status === 'active') {
            message = `
╭─✧「 ✅ *COMPTE ACTIF* ✅ 」✧─╮
│
│ 👤 *Numéro :* ${targetNumber}
│ 📌 *Statut :* ✅ Actif
│
│ ═══════════════════════
│
│ 🟢 *Ce compte est actif et accessible !*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ 📡 *${result.method ? `Vérifié via : ${result.method}` : 'Compte existant'}*
│
│ 💚 *Tout est en ordre !*
│
╰──────────✧──────────╯
            `;
        } else {
            message = `
╭─✧「 ❓ *COMPTE INCONNU* ❓ 」✧─╮
│
│ 👤 *Numéro :* ${targetNumber}
│ 📌 *Statut :* ❓ Introuvable
│
│ ═══════════════════════
│
│ ❓ *Ce numéro n'existe pas sur WhatsApp*
│ 📅 *Vérifié le :* ${dateStr}
│ ⏰ *Heure :* ${timeStr}
│
│ ⚠️ *Raisons possibles :*
│ • Le numéro n'est pas enregistré sur WhatsApp
│ • Le compte a été supprimé
│ • Le numéro est invalide
│ • Problème de réseau temporaire
│
╰──────────✧──────────╯
            `;
        }

        await socket.sendMessage(sender, { text: message }, { quoted: fakevCard || msg });

        return true;

    } catch (error) {
        console.error('❌ Erreur handleCheckban:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleCheckban };
