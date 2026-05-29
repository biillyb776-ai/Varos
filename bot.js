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
    this.isPortaling = false; 

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
      physicsEnabled: true, // Başlangıçta açık, transferde kapatacağız
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
    // KESİN ÇÖZÜM (Issue #3776 & PR #3722): 
    // Sunucu transfer paketi gönderdiği an (Lobi -> Ana dünya geçişi) fizik motorunu kapatır.
    // Böylece configuration modunda paket gönderilip Velocity tarafından kicklenmesi engellenir.
    this.bot.on("playerLeft", (player) => {
      if (player.username === this.botOptions.username) {
        this.isPortaling = true; 
        if (this.portalTimeout) clearTimeout(this.portalTimeout);
        this.clearAllMovements();
        
        console.log(color.magenta(`[ISSUE #3776 BYPASS] Sunucu transferi başladı. Fizik motoru kapatılıyor...`));
        
        // Mineflayer fizik döngüsünü durduruyoruz
        if (this.bot.physics) {
          this.bot.physicsEnabled = false;
        }
      }
    });

    // RESOURCE PACK DESTEĞİ (#3659)
    this.bot.on('resourcePackSend', (url, hash, required, message) => {
      console.log(color.magenta(`[RESOURCE PACK] İstek onaylanıyor...`));
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
      console.log(color.yellow(`[${this.botOptions.username}] Hata: `) + error.message);
      await this.reconnect();
    });

    this.bot.on("end", async (reason) => {
      console.log(color.yellow(`[${this.botOptions.username}] Bağlantı Kesildi: `) + reason);
      await this.reconnect();
    });

    this.bot.on("kicked", async (reason) => {
      const kickReason = typeof reason === 'object' ? JSON.stringify(reason) : reason;
      console.log(color.red(`[${this.botOptions.username}] Atıldı (Kick): `) + kickReason);
    });

    this.bot.on("death", () => {
      this.currentState = state.dead;
      this.clearAllMovements();
    });

    this.bot.on("spawn", async () => {
      this.spawned++;
      this.currentState = state.online;

      console.log(color.green(`[${this.botOptions.username}] Dünyaya giriş yaptı (Spawn: ${this.spawned})`));

      // Yeni dünyaya başarıyla spawn olunduğunda fizikleri geri açıyoruz
      if (this.bot.physics) {
        this.bot.physicsEnabled = true;
      }

      // ŞİFRE GİRİŞİ YAPMA (İlk Giriş - Lobi)
      if (this.spawned == 1) {
        this.isPortaling = false;
        await sleep(3500); 
        
        if (this.currentState === state.online) {
          // Ham paket şeklinde komut gönderme (Güvenli yöntem)
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
          console.log(color.cyan(`[${this.botOptions.username}] Şifre korumalı kanaldan gönderildi.`));
          
          this.portalTimeout = setTimeout(() => this.autoEnterPortal(), 12000);
        }
      }

      // Ana Dünyaya Tam Geçiş Sağlandığında
      if (this.spawned === 2) {
        this.isPortaling = false; 
        if (!sentPlayercount && this.bot.players) {
          const players = Object.values(this.bot.players).filter(
            (p) => p.username !== this.botOptions.username
          );
          console.log(color.green(`[BAŞARILI] Ana dünyaya tamamen giriş yapıldı! Aktif Oyuncu sayısı: ${players.length}`));
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

      if (msg.includes('6b6t.org/verify') || msg.toLowerCase().includes('verify')) {
        this.verifyRequired = true;
        if (this.portalTimeout) clearTimeout(this.portalTimeout);
        this.clearAllMovements();

        console.log(color.red("\n========================================"));
        console.log(`⚠️  [${this.botOptions.username}] DOĞRULAMA GEREKLİ! PORTAL DURDURULDU.`);
        console.log("========================================\n");
      }

      if (msg.includes("/register") && this.spawned == 1) {
        console.log(color.red(`[HATA] Kayıt hatası veya yanlış şifre!`));
        process.exit();
      }
    });
  }

  async autoEnterPortal() {
    if (this.verifyRequired || this.currentState !== state.online || this.isPortaling) return;

    this.isPortaling = true; 
    console.log(color.cyan(`[PORTAL] Portallar aranıyor...`));

    try {
      const portalBlocks = this.bot.findBlocks({
        matching: (block) => block.name === 'nether_portal' || block.name === 'portal',
        maxDistance: 32,
        count: 1
      });

      if (portalBlocks.length > 0) {
        const portalPos = portalBlocks[0];
        console.log(color.green(`[PORTAL] Bulundu koordinat: X:${portalPos.x} Y:${portalPos.y} Z:${portalPos.z}`));
        
        if (this.bot.ashfinder) {
          const goal = new goals.GoalExact(portalPos);
          await this.bot.ashfinder.goto(goal);
        }
      } else {
        this.walkToPortalBackup();
      }
    } catch (err) {
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
    } catch (e) {}
  }

  async movementLoop() {
    const maxMotionDelay = 1000;
    while (this.currentState === state.online && !this.verifyRequired && !this.isPortaling) {
      try {
        if (!this.bot.physicsEnabled) break; // Eğer fizik kapalıysa hareket paketini engelle
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
    if (this.bot) {
      try { this.bot.end(); } catch (e) {}
    }

    this.spawned = 0;
    const delay = this.botOptions.reconnectDelay || 60000; 
    console.log(color.yellow(`[YENİDEN BAĞLANTI] ${delay / 1000} saniye bekleniyor...`));
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
        activeBotInstance.bot.chat(input);
    }
});

module.exports = function(options) {
    const instance = new BotInstance(options);
    activeBotInstance = instance;
    return instance;
};

