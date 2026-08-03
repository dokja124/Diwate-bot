const commands = require('./commands');

const PREFIX = '.';

module.exports = async function handleMessages(sock, { messages, type }) {
  console.log('📩 Event messages.upsert reçu, type:', type);

  if (type !== 'notify') return;

  const msg = messages[0];
  if (!msg.message) return;
  // Note: on ne filtre plus msg.key.fromMe car c'est un self-bot :
  // les commandes envoyées depuis ton propre numéro doivent être traitées.

  const chatId = msg.key.remoteJid;
  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    '';

  console.log('💬 Texte reçu:', JSON.stringify(text));

  if (!text.startsWith(PREFIX)) return;

  const [cmdName, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
  console.log('⚙️ Commande détectée:', cmdName);

  const command = commands[cmdName.toLowerCase()];

  if (command) {
    await command({ sock, msg, chatId, args });
  } else {
    console.log('❓ Commande inconnue:', cmdName);
  }
};
  
