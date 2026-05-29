const mineflayer = require("mineflayer");
const pathfinder = require('@miner-org/mineflayer-baritone').loader; 
const goals = require('@miner-org/mineflayer-baritone').goals;       
const { Vec3 } = require('vec3');                                   
const { randomInt } = require("crypto");
const color = require("colors");
const readline = require('readline'); 

const sleep = (toMs) => {
  return new Promise((r) => {
    setTimeout(r, toMs);
  });
};

function getRandomBoolean() {
  return randomInt(-1, 1) < 0;
}

const state = {
  offline: "offline",
  online: "online",
  reconnecting: "reconnecting",
  dead: "dead",
};

let loggingMsgs = false;
let sentPlayercount = false;

class BotInstance {
  constructor(botOptions) {
    this.botOptions = botOptions;
    
    this.spawned = 0;
    this.currentState = state.offline;
    this.verifyRequired = false; 
    this.portalTimeout = null;   

    this.startBot();
  }

  // GÜNCELLENDİ: 1.21.5 Sürümündeki iç bağlantı hatalarını (Internal Error) önleyen güvenli ayarlar eklendi
  startBot() {
    this.verifyRequired = false;
    
    const secureOptions = {
      ...this.botOptions,
      hideErrors: true,                // Konsolu gereksiz protokol uyarılarıyla doldurmaz
      checkTimeoutInterval: 90 * 1000, // Zaman aşımı süresini 90 saniyeye çıkararak sunucudan düşmeyi engeller
      respawn: true,                   // Lobiden ana dünyaya geçişteki doğma paketlerini otomatik onaylar
      physicsEnabled: true             // Fizik motorunu aktif tutarak sunucunun botu askıda görmesini engeller
    };

    this.bot = mineflayer.createBot(secureOptions);
    this.bot.loadPlugin(pathfinder); 
    this.registerEvents();
  }

  registerEvents() {
    this.bot.on("error", async (error) => {
      console.log(color.yellow(`[${this.botOptions.username}] Hata: `) + error.message);
      await this.reconnect();
    });

    this.bot.on("end", async (reason) => {
      console.log(color.yellow(`[${this.botOptions.username}] Bağlantı sonlandı: `) + reason);
      await this.reconnect();
    });

    this.bot.on("kicked", async (reason) => {
      const kickReason = typeof reason === 'object' ? JSON.stringify(reason) : reason;
      console.log(color.yellow(`[${this.botOptions.username}] Sunucudan Atıldı (Kick): `) + kickReason);
    });

    this.bot.on("death", () => {
      this.currentState = state.dead;
    });

    this.bot.on("spawn", async () => {
      this.spawned++;
      this.currentState = state.online;

      console.log(color.green(`[${this.botOptions.username}] Dünyaya giriş yaptı (Spawn: ${this.spawned})`));

      // ŞİFRE GİRİŞİ YAPMA (İlk Giriş - Lobi)
      if (this.spawned == 1) {
        await sleep(2000); 
        this.bot.chat(`/login ${this.botOptions.password}`);
        console.log(color.cyan(`[${this.botOptions.username}] Şifre otomatik olarak gönderildi.`));

        // Sunucunun haritayı tamamen yüklemesi için 10 saniye lobide sakin ve güvenli şekilde bekliyoruz
        this.portalTimeout = setTimeout(() => this.autoEnterPortal(), 10000);
      }

      // Ana Dünyaya Geçiş (Spawn 2 veya daha fazlası)
      if (this.spawned == 2) {
        if (!sentPlayercount && this.bot.players) {
          const players = Object.values(this.bot.players).filter(
            (p) => p.username !== this.botOptions.username
          );
          console.log(color.green(`${players.length} oyuncu çevrimiçi. Ana dünyaya geçildi.`));
          sentPlayercount = true;
        }
      }

      if (this.spawned >= 2) {
        this.movementLoop();
      }
    });

    this.bot.on("messagestr", (ansiMsg) => {
      const msg = ansiMsg.toString();

      if (!loggingMsgs) {
        console.log(ansiMsg);
      }

      // DOĞRULAMA (VERIFY) SİSTEMİ YAKALAYICI
      if (msg.includes('6b6t.org/verify') || msg.toLowerCase().includes('verify')) {
        this.verifyRequired = true;
        
        if (this.portalTimeout) {
          clearTimeout(this.portalTimeout);
        }
        if (this.bot.ashfinder) {
          this.bot.ashfinder.stop();
        }

        console.log(color.red("\n========================================"));
        console.log(`⚠️  [${this.botOptions.username}] DOĞRULAMA GEREKLİ! OTOMATİK PORTAL DURDURULDU.`);
        console.log("Bot şu an lobide güvenle bekliyor. Siteden doğrulamayı tamamla.");
        console.log("========================================\n");
      }

      if (msg.includes("/register") && this.spawned == 1) {
        console.log(color.red(`[HATA] ${this.botOptions.username} hesabı sunucuya kayıtlı değil veya şifre yanlış!`));
        process.exit();
      }
    });
  }

  // Baritone'un yumuşak yürüyüş modunu kullanan güvenli portal sistemi
  async autoEnterPortal() {
    if (this.verifyRequired || this.currentState !== state.online) {
      console.log(color.yellow(`[PORTAL] Doğrulama beklendiği için otomatik portal araması iptal edildi.`));
      return;
    }

    console.log(color.cyan(`[PORTAL] Çevredeki portal blokları taranıyor...`));

    try {
      const portalBlocks = this.bot.findBlocks({
        matching: (block) => block.name === 'nether_portal' || block.name === 'portal',
        maxDistance: 32,
        count: 1
      });

      if (portalBlocks.length > 0) {
        const portalPos = portalBlocks[0];
        console.log(color.green(`[PORTAL] Portal bulundu! Koordinat: X:${portalPos.x} Y:${portalPos.y} Z:${portalPos.z}`));
        console.log(color.cyan(`[PORTAL] Baritone yumuşak yürüyüş modunda portala gidiyor...`));
        
        if (this.bot.ashfinder) {
          const goal = new goals.GoalExact(portalPos);
          await this.bot.ashfinder.goto(goal);
        }
      } else {
        console.log(color.yellow(`[PORTAL] Yakında portal bloku tespit edilemedi! Yedek düz yürüme başlatılıyor...`));
        this.walkToPortalBackup();
      }
    } catch (err) {
      console.log(color.red(`[PORTAL HATA] Portal aranırken bir sorun oluştu, düz yürünüyor.`));
      this.walkToPortalBackup();
    }
  }

  // Yedek Düz Yürüme Sistemi (Korumaya takılmaması için sadece düz ileri gider)
  walkToPortalBackup() {
    if (this.verifyRequired || this.currentState !== state.online) return;
    
    this.bot.setControlState("forward", true);

    setTimeout(() => {
      this.bot.setControlState("forward", false);
      console.log(color.cyan(`[PORTAL] Yedek lobi hareketi bitti.`));
    }, 5000);
  }

  // Optimize Edilmiş Stabil Anti-AFK Döngüsü
  async movementLoop() {
    const maxMotionDelay = 1000;
    while (this.currentState === state.online && !this.verifyRequired) {
      try {
        if (getRandomBoolean()) {
          this.bot.setControlState("jump", true);
          await sleep(randomInt(50, maxMotionDelay));
          this.bot.setControlState("jump", false);
        }
        if (getRandomBoolean()) {
          this.bot.setControlState("forward", true);
          await sleep(randomInt(50, maxMotionDelay));
          this.bot.setControlState("forward", false);
        }
        this.bot.look(randomInt(-180, 180), randomInt(-90, 90));
      } catch (err) {
        break;
      }
      await sleep(3000); 
    }
  }

  async reconnect() {
    if (this.currentState === state.reconnecting) return;
    this.currentState = state.reconnecting;
    
    if (this.bot) {
      try { this.bot.end(); } catch (e) {}
    }

    this.spawned = 0;
    const delay = this.botOptions.reconnectDelay || 60000; 
    console.log(color.yellow(`[YENİDEN BAĞLANTI] Bot ${delay / 1000} saniye sonra tekrar bağlanacak...`));
    
    await sleep(delay);
    this.startBot();
  }
}

// KONSOLDAN EL İLE BARITONE VE SOHBET YÖNETİMİ
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let activeBotInstance = null; 

rl.on('line', async (line) => {
    const input = line.trim();
    if (!input || !activeBotInstance || !activeBotInstance.bot) return;

    if (input.startsWith('#')) {
        const args = input.substring(1).split(' ');
        const cmd = args[0].toLowerCase();
        console.log(color.cyan(`[BARITONE] Komut algılandı: ${input}`));

        try {
            if (cmd === 'goto' && args.length >= 4) {
                const x = parseInt(args[1]);
                const y = parseInt(args[2]);
                const z = parseInt(args[3]);
                const goal = new goals.GoalExact(new Vec3(x, y, z));
                await activeBotInstance.bot.ashfinder.goto(goal);
            } else if (cmd === 'stop') {
                activeBotInstance.bot.ashfinder.stop();
                console.log(color.cyan('[BARITONE] Hareket durduruldu.'));
            } else {
                console.log(color.red('[BARITONE] Geçersiz konsol komutu. Örnek kullanım: #goto X Y Z veya #stop'));
            }
        } catch (err) {
            console.log(color.red('[BARITONE HATA]'), err);
        }
    } else {
        activeBotInstance.bot.chat(input);
    }
});

module.exports = function(options) {
    const instance = new BotInstance(options);
    activeBotInstance = instance;
    return instance;
};
                    
