const {
    proto,
    downloadContentFromMessage,
    getContentType
} = require('@whiskeysockets/baileys')
const fs = require('fs')
const os = require('os')
const path = require('path')

// WhatsApp utilise plusieurs formats de "vue unique" selon la version du client.
// 'viewOnceMessage' est l'ancien format (rarement utilisé aujourd'hui).
// 'viewOnceMessageV2' et 'viewOnceMessageV2Extension' sont les formats actuels.
const VIEW_ONCE_TYPES = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']

const downloadMediaMessage = async (m, filename) => {
    try {
        if (VIEW_ONCE_TYPES.includes(m.type) && m.msg?.type) {
            m.type = m.msg.type
        }

        // Écrit dans le dossier temporaire du système plutôt que le dossier courant,
        // avec un suffixe unique pour éviter toute collision entre téléchargements simultanés.
        const uniqueSuffix = `_${Date.now()}_${Math.floor(Math.random() * 10000)}`
        const base = path.join(os.tmpdir(), (filename || 'undefined') + uniqueSuffix)

        const saveAndRead = async (streamType, extension) => {
            const fullPath = base + extension
            const stream = await downloadContentFromMessage(m.msg, streamType)
            let buffer = Buffer.from([])
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }
            fs.writeFileSync(fullPath, buffer)
            const result = fs.readFileSync(fullPath)
            fs.unlink(fullPath, () => {}) // nettoyage silencieux, ne bloque pas le retour
            return result
        }

        if (m.type === 'imageMessage') {
            return await saveAndRead('image', '.jpg')
        } else if (m.type === 'videoMessage') {
            return await saveAndRead('video', '.mp4')
        } else if (m.type === 'audioMessage') {
            return await saveAndRead('audio', '.mp3')
        } else if (m.type === 'stickerMessage') {
            return await saveAndRead('sticker', '.webp')
        } else if (m.type === 'documentMessage') {
            // Protège contre un nom de fichier absent ou sans extension (sinon: crash)
            const rawName = m.msg?.fileName || 'document.bin'
            const parts = rawName.split('.')
            let ext = parts.length > 1 ? parts.pop().toLowerCase() : 'bin'
            ext = ext.replace('jpeg', 'jpg').replace('png', 'jpg').replace('m4a', 'mp3')
            return await saveAndRead('document', '.' + ext)
        }

        return null // type de média non supporté — pas d'erreur, juste rien à télécharger
    } catch (error) {
        console.error('downloadMediaMessage error:', error.message || error)
        throw error
    }
}

const sms = (conn, m) => {
    try {
        if (m.key) {
            m.id = m.key.id
            m.chat = m.key.remoteJid
            m.fromMe = m.key.fromMe
            m.isGroup = m.chat.endsWith('@g.us')
            m.sender = m.fromMe ? conn.user.id.split(':')[0] + '@s.whatsapp.net' : m.isGroup ? m.key.participant : m.key.remoteJid
        }
        if (m.message) {
            m.type = getContentType(m.message)

            if (VIEW_ONCE_TYPES.includes(m.type)) {
                const inner = m.message[m.type]?.message
                m.msg = inner ? inner[getContentType(inner)] : undefined
            } else {
                m.msg = m.message[m.type]
            }

            if (m.msg) {
                if (VIEW_ONCE_TYPES.includes(m.type)) {
                    const inner = m.message[m.type]?.message
                    m.msg.type = inner ? getContentType(inner) : undefined
                }

                var quotedMention = m.msg.contextInfo != null ? m.msg.contextInfo.participant : ''
                var tagMention = m.msg.contextInfo != null ? m.msg.contextInfo.mentionedJid : []
                var mention = typeof (tagMention) == 'string' ? [tagMention] : tagMention
                mention != undefined ? mention.push(quotedMention) : []
                m.mentionUser = mention != undefined ? mention.filter(x => x) : []
                m.body = (m.type === 'conversation') ? m.msg : (m.type === 'extendedTextMessage') ? m.msg.text : (m.type == 'imageMessage') && m.msg.caption ? m.msg.caption : (m.type == 'videoMessage') && m.msg.caption ? m.msg.caption : (m.type == 'templateButtonReplyMessage') && m.msg.selectedId ? m.msg.selectedId : (m.type == 'buttonsResponseMessage') && m.msg.selectedButtonId ? m.msg.selectedButtonId : ''
                m.quoted = m.msg.contextInfo != undefined ? m.msg.contextInfo.quotedMessage : null

                if (m.quoted) {
                    try {
                        m.quoted.type = getContentType(m.quoted)
                        m.quoted.id = m.msg.contextInfo.stanzaId
                        m.quoted.sender = m.msg.contextInfo.participant
                        m.quoted.fromMe = m.quoted.sender ? m.quoted.sender.split('@')[0].includes(conn.user.id.split(':')[0]) : false

                        if (VIEW_ONCE_TYPES.includes(m.quoted.type)) {
                            const qInner = m.quoted[m.quoted.type]?.message
                            m.quoted.msg = qInner ? qInner[getContentType(qInner)] : undefined
                            if (m.quoted.msg) m.quoted.msg.type = qInner ? getContentType(qInner) : undefined
                        } else {
                            m.quoted.msg = m.quoted[m.quoted.type]
                        }

                        if (m.quoted.msg) {
                            var quoted_quotedMention = m.quoted.msg.contextInfo != null ? m.quoted.msg.contextInfo.participant : ''
                            var quoted_tagMention = m.quoted.msg.contextInfo != null ? m.quoted.msg.contextInfo.mentionedJid : []
                            var quoted_mention = typeof (quoted_tagMention) == 'string' ? [quoted_tagMention] : quoted_tagMention
                            quoted_mention != undefined ? quoted_mention.push(quoted_quotedMention) : []
                            m.quoted.mentionUser = quoted_mention != undefined ? quoted_mention.filter(x => x) : []
                        }

                        m.quoted.fakeObj = proto.WebMessageInfo.fromObject({
                            key: {
                                remoteJid: m.chat,
                                fromMe: m.quoted.fromMe,
                                id: m.quoted.id,
                                participant: m.quoted.sender
                            },
                            message: m.quoted
                        })
                        m.quoted.download = (filename) => downloadMediaMessage(m.quoted, filename)
                        m.quoted.delete = () => conn.sendMessage(m.chat, {
                            delete: m.quoted.fakeObj.key
                        })
                        m.quoted.react = (emoji) => conn.sendMessage(m.chat, {
                            react: {
                                text: emoji,
                                key: m.quoted.fakeObj.key
                            }
                        })
                    } catch (quotedError) {
                        console.error('sms() erreur parsing message cité:', quotedError.message || quotedError)
                        m.quoted = null
                    }
                }
            }
            m.download = (filename) => downloadMediaMessage(m, filename)
        }
    } catch (error) {
        // On ne relance jamais l'erreur ici : un message malformé ou d'un type exotique
        // (réaction, sondage, message protocole...) ne doit jamais faire planter le traitement.
        console.error('sms() erreur générale (message ignoré en partie):', error.message || error)
    }

    m.reply = (teks, id = m.chat, option = {
        mentions: [m.sender]
    }) => conn.sendMessage(id, {
        text: teks,
        contextInfo: {
            mentionedJid: option.mentions
        }
    }, {
        quoted: m
    })
    m.replyS = (stik, id = m.chat, option = {
        mentions: [m.sender]
    }) => conn.sendMessage(id, {
        sticker: stik,
        contextInfo: {
            mentionedJid: option.mentions
        }
    }, {
        quoted: m
    })
    m.replyImg = (img, teks, id = m.chat, option = {
        mentions: [m.sender]
    }) => conn.sendMessage(id, {
        image: img,
        caption: teks,
        contextInfo: {
            mentionedJid: option.mentions
        }
    }, {
        quoted: m
    })
    m.replyVid = (vid, teks, id = m.chat, option = {
        mentions: [m.sender],
        gif: false
    }) => conn.sendMessage(id, {
        video: vid,
        caption: teks,
        gifPlayback: option.gif,
        contextInfo: {
            mentionedJid: option.mentions
        }
    }, {
        quoted: m
    })
    m.replyAud = (aud, id = m.chat, option = {
        mentions: [m.sender],
        ptt: false
    }) => conn.sendMessage(id, {
        audio: aud,
        ptt: option.ptt,
        mimetype: 'audio/mpeg',
        contextInfo: {
            mentionedJid: option.mentions
        }
    }, {
        quoted: m
    })
    m.replyDoc = (doc, id = m.chat, option = {
        mentions: [m.sender],
        filename: 'undefined.pdf',
        mimetype: 'application/pdf'
    }) => conn.sendMessage(id, {
        document: doc,
        mimetype: option.mimetype,
        fileName: option.filename,
        contextInfo: {
            mentionedJid: option.mentions
        }
    }, {
        quoted: m
    })
    m.replyContact = (name, info, number) => {
        var vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + 'FN:' + name + '\n' + 'ORG:' + info + ';\n' + 'TEL;type=CELL;type=VOICE;waid=' + number + ':+' + number + '\n' + 'END:VCARD'
        conn.sendMessage(m.chat, {
            contacts: {
                displayName: name,
                contacts: [{
                    vcard
                }]
            }
        }, {
            quoted: m
        })
    }
    m.react = (emoji) => conn.sendMessage(m.chat, {
        react: {
            text: emoji,
            key: m.key
        }
    })

    return m
}

module.exports = {
    sms,
    downloadMediaMessage
    }                             
                                     
