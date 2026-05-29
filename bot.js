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
          this.clearAllMovements();
          
          if (this.bot.physics) {
            this.bot.physicsEnabled = false;
          }
          console.log(color.magenta(`[GEÇİŞ] Yapılandırma başladı. Fizik motoru donduruldu.`));
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

      if (this.bot.physics) {
        this.bot.physicsEnabled = true;
      }

      // ŞİFRE GİRİŞİ YAPMA (İlk Giriş - Lobi)
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
          
          this.portalTimeout = setTimeout(() => this.autoEnterPortal(), 5000);
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
      if (!loggingMsgs) {
        console.log(ansiMsg);
      }
      if (msg.includes('6b6t.org/verify') || msg.toLowerCase().includes('verify')) {
        this.verifyRequired = true;
        if (this.portalTimeout) clearTimeout(this.portalTimeout);
        this.clearAllMovements();
        console.log(color.red("\n========================================"));
        console.log(`⚠️  [${this.botOptions.username}] DOĞRULAMA GEREKLİ! OTOMATİK PORTAL DURDURULDU.`);
        console.log("========================================\n");
      }
    });
  }

  // ULTRA AGRESİF PORTAL MOTORU
  async autoEnterPortal() {
    if (this.verifyRequired || this.currentState !== state.online || this.isPortaling) return;

    this.isPortaling = true; 
    
    // Resimdeki net portal içi koordinatları
    const targetPos = new Vec3(-1000.0, 101.0, -988.5); 
    console.log(color.green(`[PORTAL] Hedef koordinat doğrulanıyor: X:-1000 Y:101 Z:-988`));

    // Koşma ve zıplama tuşlarını kilitliyoruz
    this.bot.setControlState("forward", true);
    this.bot.setControlState("jump", true);
    this.bot.setControlState("sprint", true);

    // 5 saniye boyunca her fizik adımında bota "Portala Bak!" emri veriyoruz (Gözü kaymasın)
    const lookInterval = setInterval(() => {
      if (this.bot && this.bot.lookAt) {
        this.bot.lookAt(targetPos.offset(0, 1, 0), true);
      }
    }, 50);

    // 5 saniye sonra tuşları bırak ve portal içinde sabit kal
    setTimeout(() => {
      clearInterval(lookInterval);
      this.bot.setControlState("forward", false);
      this.bot.setControlState("jump", false);
      this.bot.setControlState("sprint", false);
      console.log(color.magenta(`[PORTAL] Koşu bitti, portal merkezinde bekleniyor...`));
    }, 5000);
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
