/**
 * rang.js — Commande .rang : envoie une carte de rang stylée
 */
const fs = require('fs-extra');
const path = require('path');

const RANKS_FILE = path.join(__dirname, 'ranks.json');

// =============================================
// 1. TITRES PAR PALIER DE NIVEAU
// =============================================
const TITRES = [
    { min: 1, max: 4, titre: '🌱 Débutant' },
    { min: 5, max: 9, titre: '⭐ Habitué' },
    { min: 10, max: 19, titre: '🔥 Actif' },
    { min: 20, max: 39, titre: '💎 Vétéran' },
    { min: 40, max: 69, titre: '👑 Légende' },
    { min: 70, max: Infinity, titre: '🏆 Mythique' },
];

const MESSAGES_PAR_NIVEAU = 20;

// =============================================
// 2. STOCKAGE PERSISTANT
// =============================================
function chargerRanks() {
    try {
        if (!fs.existsSync(RANKS_FILE)) return {};
        return fs.readJsonSync(RANKS_FILE);
    } catch (error) {
        console.error('Erreur lecture ranks.json:', error.message);
        return {};
    }
}

function sauvegarderRanks(data) {
    try {
        fs.writeJsonSync(RANKS_FILE, data, { spaces: 2 });
    } catch (error) {
        console.error('Erreur écriture ranks.json:', error.message);
    }
}

function incrementMessages(jid) {
    if (!jid) return;
    const data = chargerRanks();
    if (!data[jid]) data[jid] = { messages: 0 };
    data[jid].messages += 1;
    sauvegarderRanks(data);
}

function getMessages(jid) {
    const data = chargerRanks();
    return data[jid]?.messages || 0;
}

// =============================================
// 3. CALCUL DU RANG
// =============================================
function calculerRang(totalMessages) {
    const niveau = Math.floor(totalMessages / MESSAGES_PAR_NIVEAU) + 1;
    const messagesDansNiveau = totalMessages % MESSAGES_PAR_NIVEAU;
    const titreInfo = TITRES.find(t => niveau >= t.min && niveau <= t.max) || TITRES[TITRES.length - 1];

    const proportion = messagesDansNiveau / MESSAGES_PAR_NIVEAU;
    const blocsRemplis = Math.round(proportion * 10);
    const barre = '█'.repeat(blocsRemplis) + '░'.repeat(10 - blocsRemplis);

    return {
        niveau,
        titre: titreInfo.titre,
        messagesDansNiveau,
        messagesRestants: MESSAGES_PAR_NIVEAU - messagesDansNiveau,
        barre,
        totalMessages
    };
}

// =============================================
// 4. RÉSOLUTION DU TARGET (CORRIGÉE)
// =============================================
function resolveTarget(msg, args, sender) {
    console.log('🔍 Résolution du target...');
    console.log('📝 Args:', args);
    console.log('👤 Sender:', sender);

    try {
        // 1. Vérifier les mentions dans le message
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        
        if (contextInfo) {
            // Vérifier les mentions
            if (contextInfo.mentionedJid && contextInfo.mentionedJid.length > 0) {
                const jid = contextInfo.mentionedJid[0];
                console.log('✅ Mention trouvée:', jid);
                return jid;
            }

            // Vérifier si un message est cité
            if (contextInfo.participant) {
                console.log('✅ Citation trouvée:', contextInfo.participant);
                return contextInfo.participant;
            }
        }

        // 2. Vérifier les arguments
        if (args && args.length > 0) {
            const arg = args[0];
            console.log('🔍 Argument reçu:', arg);

            // Nettoyer l'argument
            let cleanArg = arg.replace(/[^0-9+]/g, '');
            
            // Si l'argument est un numéro de téléphone
            if (cleanArg.length >= 8) {
                // Si le numéro commence par 0, ajouter 33 (France)
                if (cleanArg.startsWith('0')) {
                    cleanArg = '33' + cleanArg.substring(1);
                }
                // Si le numéro ne commence pas par +, l'ajouter
                if (!cleanArg.startsWith('+')) {
                    cleanArg = '+' + cleanArg;
                }
                const jid = cleanArg + '@s.whatsapp.net';
                console.log('✅ Numéro formaté:', jid);
                return jid;
            }

            // Si l'argument est une mention (@nom)
            if (arg.startsWith('@')) {
                const number = arg.replace('@', '').replace(/[^0-9]/g, '');
                if (number.length >= 8) {
                    const jid = number + '@s.whatsapp.net';
                    console.log('✅ Mention formatée:', jid);
                    return jid;
                }
            }
        }

        // 3. Par défaut, retourner l'expéditeur
        console.log('✅ Target par défaut (sender):', sender);
        return sender;

    } catch (error) {
        console.error('❌ Erreur resolveTarget:', error);
        return sender; // Fallback sur le sender
    }
}

// =============================================
// 5. COMMANDE PRINCIPALE .rang (CORRIGÉE)
// =============================================
async function handleRang(socket, msg, sender, isGroup, nowsender, args, fakevCard) {
    try {
        console.log('🚀 Début handleRang');
        console.log('📝 Sender:', sender);
        console.log('📝 Args:', args);
        console.log('🏠 isGroup:', isGroup);

        // Résoudre la cible
        let target = resolveTarget(msg, args, sender);
        
        // Vérifier que target est valide
        if (!target || typeof target !== 'string') {
            console.error('❌ Target invalide:', target);
            await socket.sendMessage(sender, {
                text: '❌ *Impossible de trouver l\'utilisateur.*\nVeuillez mentionner ou citer le message de la personne.'
            }, { quoted: fakevCard || msg });
            return false;
        }

        // S'assurer que le JID est au bon format
        if (!target.includes('@s.whatsapp.net') && !target.includes('@g.us')) {
            // Si c'est un numéro seul, ajouter @s.whatsapp.net
            const cleanNumber = target.replace(/[^0-9+]/g, '');
            if (cleanNumber.length >= 8) {
                target = cleanNumber + '@s.whatsapp.net';
            } else {
                // Si toujours invalide, utiliser le sender
                target = sender;
            }
        }

        console.log('🎯 Target final:', target);

        // Récupérer le nombre de messages
        let totalMessages = 0;
        try {
            totalMessages = getMessages(target);
            console.log('💬 Messages:', totalMessages);
        } catch (error) {
            console.error('❌ Erreur getMessages:', error);
            totalMessages = 0;
        }

        // Si l'utilisateur n'existe pas, créer une entrée
        if (totalMessages === 0) {
            const data = chargerRanks();
            if (!data[target]) {
                data[target] = { messages: 0 };
                sauvegarderRanks(data);
                console.log('✅ Nouvel utilisateur créé:', target);
            }
        }

        // Calculer le rang
        const rang = calculerRang(totalMessages);
        
        // Extraire le nom d'utilisateur
        const username = target.split('@')[0] || 'Utilisateur';
        const tag = `@${username}`;

        // Construire le message
        const caption = `╭───「 🏅 *CARTE DE RANG* 」───╮\n` +
            `│\n` +
            `│ 👤 *Utilisateur :* ${tag}\n` +
            `│ 🎖️ *Niveau :* ${rang.niveau}\n` +
            `│ 🏷️ *Titre :* ${rang.titre}\n` +
            `│ 💬 *Messages :* ${rang.totalMessages}\n` +
            `│\n` +
            `│ 📊 *Progression :*\n` +
            `│ ${rang.barre} ${rang.messagesDansNiveau}/${MESSAGES_PAR_NIVEAU}\n` +
            `│ ⏳ ${rang.messagesRestants} msg avant niveau ${rang.niveau + 1}\n` +
            `│\n` +
            `╰──────────────────────╯`;

        // Récupérer la photo de profil
        let ppUrl = 'https://i.imgur.com/2wjP5D9.png'; // Image par défaut
        try {
            ppUrl = await socket.profilePictureUrl(target, 'image');
            console.log('✅ Photo de profil trouvée');
        } catch (e) {
            console.log('ℹ️ Pas de photo de profil, utilisation de l\'image par défaut');
        }

        // Envoyer le message
        await socket.sendMessage(
            sender, 
            {
                image: { url: ppUrl },
                caption: caption,
                mentions: [target]
            },
            { quoted: fakevCard || msg }
        );

        console.log('✅ Message envoyé avec succès');
        return true;

    } catch (error) {
        console.error('❌ Erreur handleRang:', error);
        
        let errorMsg = '❌ *Erreur lors de l\'affichage du rang :*\n';
        if (error.message) {
            errorMsg += `\`\`\`${error.message}\`\`\`\n\n`;
        }
        errorMsg += 'Vérifiez que vous utilisez bien la commande correctement.\n';
        errorMsg += 'Exemples :\n';
        errorMsg += '• `.rang` - votre rang\n';
        errorMsg += '• `.rang @nom` - rang d\'un membre\n';
        errorMsg += '• `.rang 0612345678` - rang d\'un numéro';

        await socket.sendMessage(
            sender,
            { text: errorMsg },
            { quoted: fakevCard || msg }
        ).catch(() => {});
        
        return false;
    }
}

// =============================================
// 6. EXPORTS
// =============================================
module.exports = { 
    handleRang, 
    incrementMessages, 
    getMessages, 
    calculerRang,
    resolveTarget 
};
