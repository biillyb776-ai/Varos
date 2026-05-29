const mineflayer = require("mineflayer");
const pathfinder = require('@miner-org/mineflayer-baritone').loader; 
const goals = require('@miner-org/mineflayer-baritone').goals;       
const { Vec3 } = require('vec3');                                   
const { randomInt } = require("crypto");
const color = require("colors");
const readline = require('readline'); 

// CANLI GÖZLEM MOTORU (Harita Eklentisi)
const mineflayerViewer = require('prismarine-viewer').mineflayer;

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
    this.isPortaling = false; 
    this.dynamicCheckInterval = null;

    this.startBot();
  }

  startBot() {
    this.verifyRequired = false;
    this.isPortaling = false;
    
    const secureOptions = {
      ...this.botOptions,
      hideErrors: true,                
      checkTimeoutInterval: 120 * 1000, 
      respawn: true,                   
      physicsEnabled: true,            
      resetErrorChannels: true,
      skipValidation: true, 
      waitWindowCloseTimeout: 5000,
      chatSignature: false,
      clientSignature: false,
      brand: "vanilla",
      viewDistance: "tiny" 
    };

    this.bot = mineflayer.createBot(secureOptions);
    this.bot.loadPlugin(pathfinder); 
    this.registerEvents();
  }

  registerEvents() {
    if (this.bot._client) {
      this.bot._client.on('packet', (data, metadata) => {
        if (metadata.name === 'start_configuration') {
          this.isPortaling = true;
          if (this.portalTimeout) clearTimeout(this.portalTimeout);
          if (this.dynamicCheckInterval) clearInterval(this.dynamicCheckInterval);
          
          this.clearAllMovements();
          
          if (this.bot.physics) {
            this.bot.physicsEnabled = false;
          }
          console.log(color.red(`[KORUMA] Sunucu geçişi başladı! Baritone kapatıldı ve fizik motoru donduruldu.`));
        }

        if (metadata.name === 'finish_configuration') {
          console.log(color.green(`[GEÇİŞ] Yapılandırma bitti! Sunucu el sıkışması onaylanıyor...`));
          try {
            this.bot._client.write('finish_configuration', {});
          } catch (e) {}
          
          setTimeout(() => {
            if (this.bot.physics) {
              this.bot.physicsEnabled = true;
              console.log(color.cyan(`[GEÇİŞ] Fizik motoru ana dünya için serbest bırakıldı.`));
            }
          }, 2000);
        }

        if (metadata.name === 'server_data' || metadata.name === 'player_chat_header' || metadata.name === 'bundle_delimiter') {
          return true; 
        }
      });
    }

    this.bot.on('resourcePackSend', (url, hash, required, message) => {
      try {
        this.bot.acceptResourcePack();
      } catch (e) {
        if (this.bot._client) {
          this.bot._client.write('resource_pack_receive', { result: 2 }); 
          this.bot._client.write('resource_pack_receive', { result: 0 }); 
        }
      }
    });

    this.bot.on("error", async (error) => {
      console.log(color.yellow(`[${this.botOptions.username}] Hata Yakalandı: `) + error.message);
      await this.reconnect();
    });

    this.bot.on("end", async (reason) => {
      console.log(color.yellow(`[${this.botOptions.username}] Bağlantı sonlandı (End): `) + reason);
      await this.reconnect();
    });

    this.bot.on("kicked", async (reason) => {
      const kickReason = typeof reason === 'object' ? JSON.stringify(reason) : reason;
      console.log(color.red(`[${this.botOptions.username}] Sunucudan Atıldı (Kick): `) + kickReason);
    });

    this.bot.on("death", () => {
      this.currentState = state.dead;
      this.clearAllMovements();
    });

    this.bot.on("spawn", async () => {
      this.spawned++;
      this.currentState = state.online;

      console.log(color.green(`[${this.botOptions.username}] Dünyaya giriş yaptı (Spawn: ${this.spawned})`));

      // CANLI GÖZÜ AKTİFLEŞTİRME (Port: 3000)
      if (this.spawned === 1) {
        try {
          // Bot lobiye ilk girdiğinde harita yayınını 3000 portundan başlatır
          mineflayerViewer(this.bot, { port: 3000, firstPerson: false });
          console.log(color.bgGreen.black(`\n 👁️  [CANLI HARİTA] Botun gözü açıldı! İzlemek için tarayıcına gir: http://localhost:3000 \n`));
        } catch (e) {
          console.log(color.red("[HARİTA HATASI] Canlı yayın başlatılamadı."));
        }
      }

      if (this.bot.physics) {
        this.bot.physicsEnabled = true;
      }

      // ŞİFRE GİRİŞİ YAPMA
      if (this.spawned == 1) {
        this.isPortaling = false;
        await sleep(3500); 
        
        if (this.currentState === state.online) {
          try {
            if (this.bot._client) {
              this.bot._client.write('chat_command', {
                command: `login ${this.botOptions.password}`,
                timestamp: BigInt(Date.now()),
                salt: BigInt(0),
                argumentSignatures: [],
                signedPreview: false,
                previousMessages: [],
                lastMessage: null
              });
            } else {
              this.bot.chat(`/login ${this.botOptions.password}`);
            }
          } catch(e) {
            this.bot.chat(`/login ${this.botOptions.password}`);
          }
          console.log(color.cyan(`[${this.botOptions.username}] Şifre başarıyla gönderildi.`));
          
          this.portalTimeout = setTimeout(() => this.scanAndScanPortalWithBaritone(), 5000);
        }
      }

      if (this.spawned === 2) {
        this.isPortaling = false; 
        if (!sentPlayercount && this.bot.players) {
          const players = Object.values(this.bot.players).filter(
            (p) => p.username !== this.botOptions.username
          );
          console.log(color.green(`[BAŞARILI] Ana dünyaya tamamen oturuldu! Çevrimiçi oyuncu: ${players.length}`));
          sentPlayercount = true;
        }
      }

      if (this.spawned >= 2) {
        this.movementLoop();
      }
    });

    this.bot.on("messagestr", (ansiMsg) => {
      const msg = ansiMsg.toString();
      // CHATİ KONTROL ETME: Sunucu mesajlarını her zaman konsola temizce basar
      console.log(ansiMsg);

      if (msg.includes('6b6t.org/verify') || msg.toLowerCase().includes('verify')) {
        this.verifyRequired = true;
        if (this.portalTimeout) clearTimeout(this.portalTimeout);
        if (this.dynamicCheckInterval) clearInterval(this.dynamicCheckInterval);
        this.clearAllMovements();
        console.log(color.red("\n========================================"));
        console.log(`⚠️  [${this.botOptions.username}] DOĞRULAMA GEREKLİ! OTOMATİK PORTAL DURDURULDU.`);
        console.log("========================================\n");
      }
    });
  }

  async scanAndScanPortalWithBaritone() {
    if (this.verifyRequired || this.currentState !== state.online || this.isPortaling) return;

    console.log(color.cyan(`[TARAYICI] Çevredeki Nether Portalları aranıyor...`));

    try {
      const portalBlocks = this.bot.findBlocks({
        matching: (block) => block.name === 'nether_portal' || block.name === 'portal',
        maxDistance: 32,
        count: 1
      });

      if (portalBlocks.length > 0) {
        const foundPortalPos = portalBlocks[0];
        console.log(color.green(`[DİNAMİK] Portal otomatik kodlandı! Hedef: X:${foundPortalPos.x} Y:${foundPortalPos.y} Z:${foundPortalPos.z}`));
        
        if (this.bot.ashfinder) {
          const goal = new goals.GoalExact(foundPortalPos);
          this.bot.ashfinder.goto(goal);
          console.log(color.cyan(`[BARITONE] Akıllı yol bulma başlatıldı. Güvenli geçiş moduna giriliyor.`));

          this.dynamicCheckInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;
            
            const currentPos = this.bot.entity.position;
            const distance = currentPos.distanceTo(foundPortalPos);

            if (distance <= 1.3) {
              clearInterval(this.dynamicCheckInterval);
              this.clearAllMovements(); 
              console.log(color.magenta(`[BAŞARILI] Portalın içine girildi ve heykel gibi donuldu. Aktarma bekleniyor...`));
            }
          }, 100);
        } else {
          this.walkToPortalBackup();
        }
      } else {
        console.log(color.yellow(`[TARAYICI] Çevrede aktif portal bulunamadı, lobi yükleniyor olabilir. Tekrar denenecek.`));
        this.portalTimeout = setTimeout(() => this.scanAndScanPortalWithBaritone(), 3000);
      }
    } catch (err) {
      console.log(color.red(`[HATA] Portal tarama motoru başarısız oldu.`));
      this.walkToPortalBackup();
    }
  }

  walkToPortalBackup() {
    if (this.verifyRequired || this.currentState !== state.online) return;
    this.bot.setControlState("forward", true);
    setTimeout(() => {
      this.bot.setControlState("forward", false);
    }, 6000);
  }

  clearAllMovements() {
    try {
      if (this.bot.ashfinder) this.bot.ashfinder.stop();
      this.bot.setControlState("forward", false);
      this.bot.setControlState("back", false);
      this.bot.setControlState("left", false);
      this.bot.setControlState("right", false);
      this.bot.setControlState("jump", false);
      this.bot.setControlState("sprint", false);
    } catch (e) {}
  }

  async movementLoop() {
    const maxMotionDelay = 1000;
    while (this.currentState === state.online && !this.verifyRequired && !this.isPortaling) {
      try {
        if (!this.bot.physicsEnabled) break;
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
      await sleep(4000); 
    }
  }

  async reconnect() {
    if (this.currentState === state.reconnecting) return;
    this.currentState = state.reconnecting;
    
    this.clearAllMovements();
    if (this.dynamicCheckInterval) clearInterval(this.dynamicCheckInterval);
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

// TERMUX ÜZERİNDEN CANLI CHAT VE KOMUT ARABİRİMİ
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', async (line) => {
    const input = line.trim();
    if (!input || !activeBotInstance || !activeBotInstance.bot) return;

    // Eğer başına # koyarsan Baritone'a komut gider. Örn: #stop
    if (input.startsWith('#')) {
        const args = input.substring(1).split(' ');
        const cmd = args[0].toLowerCase();

        try {
            if (cmd === 'goto' && args.length >= 4) {
                const x = parseInt(args[1]);
                const y = parseInt(args[2]);
                const z = parseInt(args[3]);
                const goal = new goals.GoalExact(new Vec3(x, y, z));
                await activeBotInstance.bot.ashfinder.goto(goal);
            } else if (cmd === 'stop') {
                activeBotInstance.clearAllMovements();
            }
        } catch (err) {
            console.log(color.red('[BARITONE HATA]'), err);
        }
    } else {
        // Normal yazarsan direkt oyundaki chate fırlatır!
        activeBotInstance.bot.chat(input);
    }
});

let activeBotInstance = null; 
module.exports = function(options) {
    const instance = new BotInstance(options);
    activeBotInstance = instance;
    return instance;
};
      
