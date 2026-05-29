const mineflayer = require("mineflayer");
const pathfinder = require('@miner-org/mineflayer-baritone').loader; 
const goals = require('@miner-org/mineflayer-baritone').goals;       
const color = require("colors");
const readline = require('readline'); 

const sleep = (toMs) => new Promise((r) => setTimeout(r, toMs));

const state = { offline: "offline", online: "online", reconnecting: "reconnecting", dead: "dead" };

class BotInstance {
  constructor(botOptions) {
    this.botOptions = botOptions;
    this.spawned = 0;
    this.currentState = state.offline;
    this.isPortaling = false;
    this.forceWalkInterval = null;
    this.startBot();
  }

  startBot() {
    this.bot = mineflayer.createBot({ ...this.botOptions, hideErrors: true, physicsEnabled: true });
    this.bot.loadPlugin(pathfinder);
    this.registerEvents();
  }

  registerEvents() {
    this.bot.on("spawn", async () => {
      this.spawned++;
      this.currentState = state.online;
      console.log(color.green(`[${this.botOptions.username}] Giriş yaptı.`));

      if (this.spawned == 1) {
        await sleep(3500);
        this.bot.chat(`/login ${this.botOptions.password}`);
        this.goToPortal();
      }
    });

    this.bot.on("messagestr", (msg) => console.log(color.white(msg)));
    this.bot.on("end", () => this.reconnect());
  }

  async goToPortal() {
    const portalBlocks = this.bot.findBlocks({
      matching: (block) => block.name === 'nether_portal' || block.name === 'portal',
      maxDistance: 32,
      count: 1
    });

    if (portalBlocks.length > 0) {
      const portalPos = portalBlocks[0];
      console.log(color.cyan(`[RADAR] Portal bulundu: X:${portalPos.x} Y:${portalPos.y} Z:${portalPos.z}`));
      
      this.bot.lookAt(portalPos.offset(0, 1, 0), true);
      this.bot.setControlState("forward", true);
      this.bot.setControlState("sprint", true);

      this.forceWalkInterval = setInterval(() => {
        if (!this.bot.entity) return;
        
        // EKRAN GÖRÜNTÜSÜ GİBİ SÜREKLİ GÜNCEL KONUM BİLGİSİ
        const pos = this.bot.entity.position;
        process.stdout.write(color.yellow(`\r[CANLI TAKİP] Konum: X:${pos.x.toFixed(1)} Z:${pos.z.toFixed(1)} | Portala yürüyor...`));

        if (pos.distanceTo(portalPos) <= 1.5) {
          clearInterval(this.forceWalkInterval);
          // BAŞARI BİLDİRİMİ
          console.log(color.bgGreen.black(`\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`));
          console.log(color.bgGreen.black(`!!   BAŞARILI! BOT PORTALIN İÇİNE GİRDİ!        !!`));
          console.log(color.bgGreen.black(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`));
          this.isPortaling = true;
        }
      }, 500);
    } else {
      setTimeout(() => this.goToPortal(), 2000);
    }
  }

  reconnect() {
    clearInterval(this.forceWalkInterval);
    setTimeout(() => this.startBot(), 5000);
  }
}

module.exports = (options) => new BotInstance(options);
