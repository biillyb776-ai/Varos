const path = require('path');

// bot.js dosyasındaki ana motoru çağırıyoruz
const startMyBot = require('./bot.js'); 

// Senin verdiğin 6b6t giriş bilgileri ve şifren kanka:
startMyBot({
  host: '6b6t.org',
  port: 25565,
  username: 'VuadasTpaBot1',
  password: 'Ewdry3NgAF6h9', 
  reconnectDelay: 60000       // Bağlantı koparsa 1 dakika bekleyip otomatik bağlanır
});

console.log("[SYSTEM] Bot ayarları yüklendi, index.js tetiklendi.");
