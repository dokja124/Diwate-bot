/**
 * annonce.js — Envoi d'annonce dans tous les groupes
 * Utilisation : .annonce <message>
 */

const axios = require('axios');

// =============================================
// 1. IMAGE PAR DÉFAUT POUR LES ANNONCES
// =============================================
const ANNOUNCE_IMAGE_URL = 'https://files.catbox.moe/d62r21.jpg';

// =============================================
// 2. RÉCUPÉRER TOUS LES GROUPES
// =============================================
async function getAllGroups(socket) {
    try {
        const groups = await socket.groupFetchAllParticipating();
        const groupList = Object.values(groups);
        console.log(`📊 ${groupList.length} groupes trouvés`);
        return groupList;
    } catch (error) {
        console.error('❌ Erreur récupération groupes:', error.message);
        return [];
    }
}

// =============================================
// 3. TÉLÉCHARGER UNE IMAGE DEPUIS UNE URL
// =============================================
async function downloadImage(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return Buffer.from(response.data);
    } catch (error) {
        console.error('❌ Erreur téléchargement image:', error.message);
        return null;
    }
}

// =============================================
// 4. COMMANDE PRINCIPALE .annonce
// =============================================
async function handleAnnonce(socket, msg, sender, args, fakevCard, isOwner, nowsender) {
    try {
        // Accusé de réception
        await socket.sendMessage(sender, { react: { text: '📢', key: msg.key } }).catch(() => {});

        // Vérification des permissions (seul le propriétaire peut annoncer)
        if (!isOwner) {
            await socket.sendMessage(sender, {
                text: '❌ *Seul le propriétaire du bot peut faire des annonces.*'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // Vérifier s'il y a un message
        if (args.length === 0) {
            await socket.sendMessage(sender, {
                text: `📢 *COMMANDE .ANNONCE*\n\n📌 *Utilisation :*\n.annonce <message>\n\n📝 *Exemple :*\n.annonce Le serveur sera en maintenance ce soir.\n\n📌 *Fonctionnement :*\n• Le message sera envoyé dans TOUS les groupes\n• Avec une image personnalisée\n• Avec un délai entre chaque envoi`
            }, { quoted: fakevCard || msg });
            return true;
        }

        const message = args.join(' ');

        // Message de traitement
        await socket.sendMessage(sender, {
            text: `⏳ *PRÉPARATION DE L'ANNONCE...*\n\n📢 ${message}\n\n🔍 Récupération des groupes...`
        }, { quoted: fakevCard || msg });

        // Récupérer tous les groupes
        const groups = await getAllGroups(socket);

        if (groups.length === 0) {
            await socket.sendMessage(sender, {
                text: '❌ *Aucun groupe trouvé.*\nLe bot n\'est dans aucun groupe.'
            }, { quoted: fakevCard || msg });
            return true;
        }

        // =============================================
        // ✅ TÉLÉCHARGER L'IMAGE FIXE
        // =============================================
        const imageBuffer = await downloadImage(ANNOUNCE_IMAGE_URL);

        if (!imageBuffer) {
            await socket.sendMessage(sender, {
                text: '⚠️ *Image non disponible*\nL\'annonce sera envoyée sans image.'
            }, { quoted: fakevCard || msg });
        }

        // Envoyer le message de début
        await socket.sendMessage(sender, {
            text: `📢 *DÉBUT DE L'ANNONCE*\n\n📝 ${groups.length} groupes\n⏳ Envoi en cours...`
        }, { quoted: fakevCard || msg });

        // Variables de progression
        let envoyes = 0;
        let echecs = 0;
        let index = 0;

        // Envoyer dans chaque groupe avec délai
        for (const group of groups) {
            const groupJid = group.id;
            const groupName = group.subject || 'Sans nom';
            
            try {
                // Message de progression (dans le chat privé)
                await socket.sendMessage(sender, {
                    text: `📤 *${index + 1}/${groups.length}* → ${groupName}`
                }, { quoted: fakevCard || msg });

                // ✅ Construire l'annonce avec l'image fixe
                const caption = `📢 *ANNONCE IMPORTANTE*\n\n${message}\n\n> *Diwate-bot*`;

                if (imageBuffer) {
                    await socket.sendMessage(groupJid, {
                        image: imageBuffer,
                        caption: caption,
                        contextInfo: {
                            mentionedJid: [],
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363402708281380@newsletter',
                                newsletterName: 'Diwate-bot',
                                serverId: '428'
                            }
                        }
                    });
                } else {
                    await socket.sendMessage(groupJid, { text: caption });
                }

                envoyes++;
                console.log(`✅ Annonce envoyée à ${groupName} (${groupJid})`);

            } catch (error) {
                echecs++;
                console.error(`❌ Échec pour ${groupName}:`, error.message);
            }

            index++;

            // Délai de 2 secondes entre chaque groupe
            if (index < groups.length) {
                await delay(2000);
            }
        }

        // Message de fin
        const resultMessage = `✅ *ANNONCE TERMINÉE !*\n\n📢 *Message :*\n${message}\n\n📊 *Statistiques :*\n• Groupes : ${groups.length}\n• Envoyés : ✅ ${envoyes}\n• Échecs : ❌ ${echecs}\n• Durée : ~${Math.round((groups.length * 2) / 60)} minutes`;

        await socket.sendMessage(sender, { text: resultMessage }, { quoted: fakevCard || msg });

        // Réaction finale
        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }).catch(() => {});

        return true;

    } catch (error) {
        console.error('❌ Erreur handleAnnonce:', error.message);
        await socket.sendMessage(sender, {
            text: `❌ *Erreur :*\n${error.message}`
        }, { quoted: fakevCard || msg }).catch(() => {});
        return true;
    }
}

// =============================================
// 5. DELAY (attendre)
// =============================================
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================
// 6. EXPORTS
// =============================================
module.exports = { handleAnnonce, getAllGroups };
