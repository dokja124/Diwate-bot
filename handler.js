const commands = require('./commands');

const PREFIX = '.';

module.exports = async function handleMessages(sock, { messages, type }) {
  if (type !== 'notify') return;

  const msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const chatId = msg.key.remoteJid;
  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    '';

  if (!text.startsWith(PREFIX)) return;

  const [cmdName, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = commands[cmdName.toLowerCase()];

  if (command) {
    await command({ sock, msg, chatId, args });
  }
};
