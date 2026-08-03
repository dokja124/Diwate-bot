const axios = require('axios');

module.exports = async function waifuCommand({ sock, chatId }) {
  try {
    const res = await axios.get('https://api.waifu.pics/sfw/waifu');
    const imageUrl = res.data.url;

    await sock.sendMessage(chatId, {
      image: { url: imageUrl },
      caption: '🌸 Voici ta waifu !',
    });
  } catch (err) {
    console.error('Erreur waifu:', err);
    await sock.sendMessage(chatId, {
      text: '❌ Impossible de récupérer une image pour le moment.',
    });
  }
};
      
