/**
 * rang.js — Commande .rang : envoie une carte de rang stylée avec 
 * les informations du contact (photo, numéro, statut, rôle)
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
function resolveTarget(msg, args, sender, isGroup, nowsender) {
    console.log('🔍 Résolution du target...');
    console.log('📝 Args:', args);
    console.log('👤 Sender:', sender);
    console.log('🏠 isGroup:', isGroup);
    console.log('👤 nowsender:', nowsender);

    try {
        // 1. Vérifier les mentions dans le message
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        
        if (contextInfo) {
            // Vérifier les mentions
            if (contextInfo.mentionedJid && contextInfo.mentionedJid.length > 0) {
                const jid = contextInfo.mentionedJid[0];
                // Ignorer les JID de groupe
                if (!jid.includes('@g.us')) {
                    console.log('✅ Mention trouvée:', jid);
                    return jid;
                }
            }

            // Vérifier si un message est cité (reply)
            if (contextInfo.participant) {
                const jid = contextInfo.participant;
                // Ignorer les JID de groupe
                if (!jid.includes('@g.us')) {
                    console.log('✅ Citation trouvée:', jid);
                    return jid;
                }
            }
        }

        // 2. Vérifier les arguments
        if (args && args.length > 0) {
            const arg = args[0];
            console.log('🔍 Argument reçu:', arg);

            // Si c'est une mention avec @
            if (arg.startsWith('@')) {
                const number = arg.replace('@', '').replace(/[^0-9]/g, '');
                if (number.length >= 8) {
                    const jid = number + '@s.whatsapp.net';
                    console.log('✅ Mention formatée:', jid);
                    return jid;
                }
            }

            // Nettoyer l'argument
            let cleanArg = arg.replace(/[^0-9]/g, '');
            
            if (cleanArg.length >= 8) {
                // Formater le numéro
                if (cleanArg.startsWith('0')) {
                    cleanArg = '33' + cleanArg.substring(1);
                }
                if (!cleanArg.startsWith('+')) {
                    cleanArg = '+' + cleanArg;
                }
                const jid = cleanArg + '@s.whatsapp.net';
                console.log('✅ Numéro formaté:', jid);
                return jid;
            }
        }

        // 3. Par défaut : utiliser l'expéditeur
        // Pour un groupe, utiliser nowsender (le participant)
        // Pour un privé, utiliser sender
        let target = isGroup ? nowsender : sender;
        
        // Si target est un JID de groupe, utiliser sender
        if (target && target.includes('@g.us')) {
            target = sender;
        }
        
        console.log('✅ Target par défaut:', target);
        return target;

    } catch (error) {
        console.error('❌ Erreur resolveTarget:', error);
        return isGroup ? (nowsender || sender) : sender;
    }
}

// =============================================
// 5. RÉCUPÉRATION DES INFOS CONTACT
// =============================================
async function getContactInfo(socket, target, isGroup, groupJid) {
    const info = {
        ppUrl: null,
        statut: 'Non disponible (privé ou non défini)',
        existeSurWhatsApp: 'Inconnu',
        nomAffichage: null,
        roleGroupe: null,
        numero: target.split('@')[0]
    };

    // Si c'est un JID de groupe, on ne peut pas récupérer les infos
    if (target.includes('@g.us')) {
        info.numero = 'Groupe';
        return info;
    }

    // --- Photo de profil de la personne ---
    try {
        info.ppUrl = await socket.profilePictureUrl(target, 'image');
        console.log('✅ Photo de profil trouvée pour', target);
    } catch (e) {
        info.ppUrl = null;
        console.log('ℹ️ Pas de photo de profil pour', target);
    }

    // --- Statut "à propos" ---
    try {
        const infosStatut = await socket.fetchStatus(target);
        if (infosStatut?.status) {
            info.statut = infosStatut.status;
        }
    } catch (e) {
        // statut privé ou indisponible
    }

    // --- Vérification WhatsApp ---
    try {
        const resultats = await socket.onWhatsApp(target);
        if (resultats && resultats.length > 0) {
            info.existeSurWhatsApp = resultats[0].exists ? '✅ Oui' : '❌ Non';
        }
    } catch (e) {
        // indisponible
    }

    // --- Rôle dans le groupe ---
    if (isGroup && groupJid) {
        try {
            const groupMeta = await socket.groupMetadata(groupJid);
            const participant = groupMeta.participants.find(p => p.id === target);
            if (participant) {
                info.nomAffichage = participant.name || null;
                if (participant.admin === 'superadmin') info.roleGroupe = '👑 Créateur';
                else if (participant.admin === 'admin') info.roleGroupe = '🛡️ Admin';
                else info.roleGroupe = '👤 Membre';
            }
        } catch (e) {
            console.log('ℹ️ Impossible de récupérer le rôle dans le groupe');
        }
    }

    return info;
}

// =============================================
// 6. COMMANDE PRINCIPALE .rang
// =============================================
async function handleRang(socket, msg, sender, isGroup, nowsender, args, fakevCard) {
    try {
        console.log('🚀 Début handleRang');

        // Résoudre la cible
        let target = resolveTarget(msg, args, sender, isGroup, nowsender);
        
        // Vérifier que target est valide
        if (!target || typeof target !== 'string') {
            await socket.sendMessage(sender, {
                text: '❌ *Impossible de trouver l\'utilisateur.*\nVeuillez mentionner ou citer le message de la personne.'
            }, { quoted: fakevCard || msg });
            return false;
        }

        // Si target est un JID de groupe, utiliser l'expéditeur
        if (target.includes('@g.us')) {
            console.log('⚠️ Target est un groupe, utilisation du sender');
            target = isGroup ? nowsender : sender;
        }

        // S'assurer que le JID est au bon format
        if (!target.includes('@s.whatsapp.net')) {
            const cleanNumber = target.replace(/[^0-9+]/g, '');
            if (cleanNumber.length >= 8) {
                if (cleanNumber.startsWith('0')) {
                    target = '33' + cleanNumber.substring(1) + '@s.whatsapp.net';
                } else if (!cleanNumber.startsWith('+')) {
                    target = '+' + cleanNumber + '@s.whatsapp.net';
                } else {
                    target = cleanNumber + '@s.whatsapp.net';
                }
            } else {
                target = isGroup ? nowsender : sender;
            }
        }

        console.log('🎯 Target final:', target);

        // Récupérer les informations du contact
        const contactInfo = await getContactInfo(socket, target, isGroup, isGroup ? sender : null);

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
        
        // Extraire le numéro pour l'affichage
        const numero = target.split('@')[0] || 'Inconnu';
        // Enlever le + pour l'affichage
        const displayNumber = numero.replace('+', '');
        const tag = `@${displayNumber}`;

        // Construire le message
        let caption = `╭───「 🏅 *CARTE DE RANG* 」───╮\n`;
        caption += `│\n`;
        caption += `│ 👤 *Utilisateur :* ${tag}\n`;
        
        if (contactInfo.nomAffichage) {
            caption += `│ 🏷️ *Nom :* ${contactInfo.nomAffichage}\n`;
        }
        
        caption += `│ 📱 *Numéro :* ${displayNumber}\n`;
        caption += `│ 📶 *WhatsApp :* ${contactInfo.existeSurWhatsApp}\n`;
        caption += `│ 💬 *À propos :* ${contactInfo.statut}\n`;
        
        if (contactInfo.roleGroupe) {
            caption += `│ 🏅 *Rôle :* ${contactInfo.roleGroupe}\n`;
        }
        
        caption += `│\n`;
        caption += `│ 🎖️ *Niveau :* ${rang.niveau}\n`;
        caption += `│ 🏷️ *Titre :* ${rang.titre}\n`;
        caption += `│ 💬 *Messages :* ${rang.totalMessages}\n`;
        caption += `│\n`;
        caption += `│ 📊 *Progression :*\n`;
        caption += `│ ${rang.barre} ${rang.messagesDansNiveau}/${MESSAGES_PAR_NIVEAU}\n`;
        caption += `│ ⏳ ${rang.messagesRestants} msg avant niveau ${rang.niveau + 1}\n`;
        caption += `│\n`;
        caption += `╰──────────────────────╯\n`;
        caption += `\nℹ️ _Informations publiquement visibles sur WhatsApp._`;

        // Utiliser la photo de profil du contact
        let ppUrl = contactInfo.ppUrl;
        
        // Si pas de photo, créer un avatar unique
        if (!ppUrl) {
            const hash = displayNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD', 'FF8A5C', 'A29BFE'];
            const color = colors[hash % colors.length];
            ppUrl = `https://ui-avatars.com/api/?name=${displayNumber.slice(-4)}&background=${color}&color=fff&size=256&font-size=0.5`;
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
// 7. EXPORTS
// =============================================
module.exports = { 
    handleRang, 
    incrementMessages, 
    getMessages, 
    calculerRang,
    resolveTarget 
};
