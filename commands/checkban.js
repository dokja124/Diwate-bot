/**
 * checkban.js — Vérification de compte WhatsApp (API prioritaire)
 */

const axios = require('axios');

// =============================================
// 1. VÉRIFICATION VIA L'API (Priorité absolue pour les bans)
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
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        // Si l'API renvoie du texte (HTML d'erreur Cloudflare ou texte simple)
        if (typeof response.data === 'string') {
            const text = response.data.toLowerCase();
            // On vérifie si le texte contient des mots-clés
            if (text.includes('not banned') || text.includes('active')) {
                return { status: 'active', method: 'API Externe', message: 'Compte actif' };
            }
            if (text.includes('banned') || text.includes('ban')) {
                return { status: 'banned', method: 'API Externe', message: 'Compte banni' };
            }
            console.log('⚠️ L\'API a renvoyé du texte inattendu:', response.data);
            return { status: 'unknown', message: 'API injoignable (HTML)' };
        }

        // Si l'API renvoie du JSON
        const data = response.data;

        if (data && data.banned === false) {
            return { status: 'active', method: 'API Externe', message: data.message || 'Compte actif' };
        }
        if (data && data.banned === true) {
            return { status: 'banned', method: 'API Externe', message: data.reason || data.message || 'Compte banni' };
        }
        if (data && data.error === false) {
            return { status: 'active', method: 'API Externe', message: data.message || 'Compte actif' };
        }

        return { status: 'unknown', message: 'Réponse inattendue de l\'API' };

    } catch (error) {
        console.error('❌ Erreur checkBanAPI:', error.message);
        return { status: 'unknown', message: 'Erreur API externe (injoignable)' };
    }
}

// =============================================
// 2. VÉRIFICATION NATIVE WHATSAPP (Fallback)
// =============================================
async function checkAccountNative(socket, jid) {
    try {
        const [result] = await socket.onWhatsApp(jid);
        
        if (result && result.exists) {
            return { status: 'active', method: 'Serveur WhatsApp', message: 'Le compte est enregistré.' };
        } else {
            return { status: 'banned', method: 'Serveur WhatsApp', message: 'Le compte n\'existe plus (Supprimé ou Banni définitif).' };
        }
    } catch (error) {
        console.error('❌ Erreur Native:', error.message);
        return { status: 'unknown', message: 'Erreur de communication serveur.' };
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
│ ⚠️ *Raisons possibles :*
│ • Spam ou comportement abusif
│ • Violation des conditions d'utilisation
│ • Signalements multiples
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
│ 📋 *Raison :* ${resultat.message || 'L\'API de ban-check est hors service ou bloque la connexion.'}
│
╰──────────✧──────────╯`;
}

// =============================================
// 4. COMMANDE PRINCIPALE .checkban
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
                text: `🔍 *VÉRIFICATION DE COMPTE*\n\n📌 *Utilisation :*\n${prefix}checkban [numéro]\n\n📝 *Exemple :*\n${prefix}checkban 2250161465103`
            }, { quoted: fakevCard || msg });
            return true;
        }

        const targetNumber = args[0].replace(/[^0-9]/g, '');
        const targetJid = `${targetNumber}@s.whatsapp.net`;

        await socket.sendMessage(sender, {
            text: `⏳ *VÉRIFICATION EN COURS...*\n\n👤 Numéro : ${targetNumber}\n📡 Connexion à l'API externe...`
        }, { quoted: fakevCard || msg });

        // 🔥 ÉTAPE 1 : UTILISER L'API EXTERNE EN PRIORITÉ (C'est elle qui détecte les bans)
        let resultat = await checkBanAPI(targetNumber);
        let status = resultat.status;

        // 🔥 ÉTAPE 2 : SI L'API EXTERNE EST EN PANNE (unknown), UTILISER LA MÉTHODE NATIVE
        if (status === 'unknown') {
            console.log('🔄 API externe en panne, fallback sur serveur WhatsApp...');
            const nativeResult = await checkAccountNative(socket, targetJid);
            if (nativeResult.status !== 'unknown') {
                resultat = nativeResult;
                status = nativeResult.status;
                // Si le compte existe mais que l'API a échoué, on ajoute un avertissement
                if (status === 'active') {
                    resultat.message = 'Le compte est enregistré sur WhatsApp. (⚠️ L\'API externe est hors service, impossible de vérifier s\'il est banni temporairement).';
                }
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
