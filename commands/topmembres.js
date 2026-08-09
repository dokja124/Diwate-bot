const fs = require('fs-extra');
const path = require('path');

const RANKS_FILE = path.join(__dirname, 'ranks.json');

// =============================================
// 1. CHARGEMENT DES DONNÉES
// =============================================
function loadRanks() {
    try {
        if (!fs.existsSync(RANKS_FILE)) return {};
        return fs.readJsonSync(RANKS_FILE);
    } catch (error) {
        console.error('Erreur lecture ranks.json:', error.message);
        return {};
    }
}

// =============================================
// 2. FONCTION PRINCIPALE
// =============================================
async function handleTopmembers(socket, msg, sender, isGroup, args, fakevCard) {
    try {
        // ✅ Réaction
        await socket.sendMessage(sender, { react: { text: '🏆', key: msg.key } }).catch(() => {});

        // 1. Vérifier que c'est un groupe
        if (!isGroup) {
            await socket.sendMessage(sender, {
                text: '❌ *Cette commande ne peut être utilisée que dans un groupe.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const groupId = msg.key.remoteJid;

        // 2. Récupérer les membres du groupe
        let groupMeta;
        try {
            groupMeta = await socket.groupMetadata(groupId);
        } catch (error) {
            await socket.sendMessage(sender, {
                text: '❌ *Impossible de récupérer les informations du groupe.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        const groupMembers = groupMeta.participants.map(p => p.id);
        const ranks = loadRanks();

        // 3. Filtrer les membres présents dans le groupe et avec des messages
        const filteredRanks = {};
        for (const [jid, data] of Object.entries(ranks)) {
            const memberJid = jid.includes('@s.whatsapp.net') ? jid : jid + '@s.whatsapp.net';
            if (groupMembers.includes(memberJid)) {
                filteredRanks[jid] = data;
            }
        }

        // 4. Trier par nombre de messages (du plus élevé au plus bas)
        const sorted = Object.entries(filteredRanks)
            .sort((a, b) => (b[1]?.messages || 0) - (a[1]?.messages || 0));

        if (sorted.length === 0) {
            await socket.sendMessage(sender, {
                text: '📊 *Aucun message enregistré dans ce groupe.*\n\n💬 Envoyez des messages pour apparaître dans le classement !'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // 5. Déterminer combien afficher (par défaut 10)
        let limit = parseInt(args[0]) || 10;
        if (limit > 20) limit = 20;
        if (limit < 1) limit = 1;

        const topMembers = sorted.slice(0, limit);

        // 6. Construction du message
        const medals = ['🥇', '🥈', '🥉'];
        const emojis = ['💎', '⭐', '🌟', '🔥', '💫', '✨', '⚡', '🎯', '🏅', '🎖️'];

        let message = `🏆 *CLASSEMENT DES MEMBRES ACTIFS*\n`;
        message += `═══════════════════════\n\n`;

        // Ajouter le total de messages
        const totalMessages = sorted.reduce((sum, [_, data]) => sum + (data?.messages || 0), 0);
        message += `📊 *Total messages :* ${totalMessages.toLocaleString()}\n`;
        message += `👥 *Membres actifs :* ${sorted.length}\n\n`;
        message += `──────────────\n\n`;

        topMembers.forEach(([jid, data], index) => {
            const rank = index + 1;
            const medal = rank <= 3 ? medals[rank - 1] : `${rank}.`;
            const emoji = rank <= 10 ? emojis[rank - 1] : '▪️';
            const messages = data?.messages || 0;
            
            // Extraire le numéro de téléphone
            const phone = jid.split('@')[0];
            
            // Formater le nom (si disponible via le groupe)
            const participant = groupMeta.participants.find(p => {
                const pClean = p.id.split('@')[0];
                const jidClean = jid.split('@')[0];
                return pClean === jidClean;
            });
            
            let displayName = participant?.name || participant?.notify || phone;
            if (displayName.length > 20) displayName = displayName.substring(0, 20) + '...';
            
            // Ajouter le rôle si admin
            let role = '';
            if (participant?.admin === 'superadmin') role = ' 👑';
            else if (participant?.admin === 'admin') role = ' 🛡️';
            
            message += `${medal} ${emoji} *${displayName}*${role}\n`;
            message += `   💬 ${messages.toLocaleString()} messages\n`;
            
            // Barre de progression (10 blocs)
            const maxMessages = topMembers[0]?.[1]?.messages || 1;
            const progress = Math.floor((messages / maxMessages) * 10);
            const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);
            message += `   ${bar}\n\n`;
        });

        // Ajouter le bot si l'utilisateur le demande
        if (args.includes('bot')) {
            const botJid = socket.user.id.split(':')[0] + '@s.whatsapp.net';
            const botData = ranks[botJid] || { messages: 0 };
            message += `──────────────\n\n`;
            message += `🤖 *Diwate-bot*\n`;
            message += `   💬 ${(botData?.messages || 0).toLocaleString()} messages\n\n`;
        }

        message += `═══════════════════════\n`;
        message += `📌 *Utilisation :* .topmembres [nombre]\n`;
        message += `📌 *Exemple :* .topmembres 5 (affiche les 5 premiers)`;

        // 7. Envoyer le message
        await socket.sendMessage(sender, {
            text: message
        }, { quoted: fakevCard || msg });

        return true;

    } catch (error) {
        console.error('Erreur handleTopmembers:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

module.exports = { handleTopmembers };
