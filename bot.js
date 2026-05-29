const mineflayer = require("mineflayer");
const pathfinder = require('@miner-org/mineflayer-baritone').loader; 
const goals = require('@miner-org/mineflayer-baritone').goals;       
const { Vec3 } = require('vec3');                                   
const { randomInt } = require("crypto");
const color = require("colors");
const readline = require('readline'); 

// ASLA HATA VERMEYEN SAF JAVASCRIPT TARAYICI MONITORÜ
const inventoryViewer = require('mineflayer-web-inventory');

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
    this.viewerInstance = null;

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
          console.log(color.red(`[KORUMA] Sunucu geçişi başladı! Baritone kapatıldı ve fizik donduruldu.`));
        }

        if (metadata.name === 'finish_configuration') {
          console.log(color.green(`[GEÇİŞ] Yapılandırma bitti! Sunucu el sikismasi onaylanıyor...`));
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
      });
    }

    this.bot.on("error", async (error) => {
      console.log(color.yellow(`[Hata] `) + error.message);
      await this.reconnect();
    });

    this.bot.on("end", async (reason) => {
      console.log(color.yellow(`[Bağlantı Kesildi] `) + reason);
      await this.reconnect();
    });

    this.bot.on("death", () => {
      this.currentState = state.dead;
      this.clearAllMovements();
    });

    this.bot.on("spawn", async () => {
      this.spawned++;
      this.currentState = state.online;

      console.log(color.green(`[${this.botOptions.username}] Dünyaya giriş yaptı (Spawn: ${this.spawned})`));

      // 👁️ WEB MONITORÜNÜ BAŞLATMA (Port: 3000)
      if (this.spawned === 1) {
        try {
          inventoryViewer(this.bot, { port: 3000, startOnLoad: true });
          console.log(color.bgGreen.black(`\n 📡 [CANLI MONITOR] Web ekranı açıldı! İzlemek için tarayıcına gir: http://localhost:3000 \n`));
        } catch (e) {
          console.log(color.red("[MONİTOR HATASI] Web ekranı başlatılamadı."));
        }
      }

      if (this.bot.physics) {
        this.bot.physicsEnabled = true;
      }

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
          console.log(color.cyan(`[Sistem] Şifre gönderildi.`));
          
          this.portalTimeout = setTimeout(() => this.scanAndScanPortalWithBaritone(), 5000);
        }
      }

      if (this.spawned === 2) {
        this.isPortaling = false; 
        if (!sentPlayercount && this.bot.players) {
          const players = Object.values(this.bot.players).filter(
            (p) => p.username !== this.botOptions.username
          );
          console.log(color.green(`[BAŞARILI] Ana dünyaya girildi! Çevrimiçi oyuncu: ${players.length}`));
          sentPlayercount = true;
        }
      }
    });

    this.bot.on("messagestr", (ansiMsg) => {
      console.log(ansiMsg.toString()); 
    });
  }

  async scanAndScanPortalWithBaritone() {
    if (this.verifyRequired || this.currentState !== state.online || this.isPortaling) return;

    try {
      const portalBlocks = this.bot.findBlocks({
        matching: (block) => block.name === 'nether_portal' || block.name === 'portal',
        maxDistance: 32,
        count: 1
      });

      if (portalBlocks.length > 0) {
        const foundPortalPos = portalBlocks[0];
        console.log(color.green(`[OTOMATİK] Portal bulundu! Koordinat: X:${foundPortalPos.x} Y:${foundPortalPos.y} Z:${foundPortalPos.z}`));
        
        if (this.bot.ashfinder) {
          const goal = new goals.GoalExact(foundPortalPos);
          this.bot.ashfinder.goto(goal);

          this.dynamicCheckInterval = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;
            
            const currentPos = this.bot.entity.position;
            const distance = currentPos.distanceTo(foundPortalPos);

            if (distance <= 1.3) {
              clearInterval(this.dynamicCheckInterval);
              this.clearAllMovements(); 
              console.log(color.magenta(`[BAŞARILI] Portala girildi. Donma modu aktif.`));
            }
          }, 100);
        }
      } else {
        this.portalTimeout = setTimeout(() => this.scanAndScanPortalWithBaritone(), 3000);
      }
    } catch (err) {}
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
    console.log(color.yellow(`[YENİDEN BAĞLANTI] ${delay / 1000} saniye sonra denenecek...`));
    
    await sleep(delay);
    this.startBot();
  }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let activeBotInstance = null; 
rl.on('line', async (line) => {
    const input = line.trim();
    if (!input || !activeBotInstance || !activeBotInstance.bot) return;
    activeBotInstance.bot.chat(input);
});

module.exports = function(options) {
    const instance = new BotInstance(options);
    activeBotInstance = instance;
    return instance;
};
