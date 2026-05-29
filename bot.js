const mineflayer = require("mineflayer");
const pathfinder = require('@miner-org/mineflayer-baritone').loader;
const goals = require('@miner-org/mineflayer-baritone').goals;
const color = require("colors");
const readline = require('readline');
const { Vec3 } = require('vec3');

// --- SİSTEM AYARLARI ---
const CONFIG = {
    checkInterval: 1000,
    portalDistance: 1.5,
    reconnectDelay: 10000,
    spamFilter: 5000 // Aynı mesajı engelleme süresi
};

const sleep = (toMs) => new Promise((r) => setTimeout(r, toMs));

class AdvancedBot {
    constructor(options) {
        this.options = options;
        this.lastMsg = "";
        this.msgTime = 0;
        this.isPortaling = false;
        this.spawned = 0;
        this.init();
    }

    init() {
        this.bot = mineflayer.createBot({
            ...this.options,
            hideErrors: true,
            checkTimeoutInterval: 60000
        });
        this.bot.loadPlugin(pathfinder);
        this.setupEvents();
    }

    setupEvents() {
        this.bot.on("spawn", async () => {
            this.spawned++;
            console.log(color.green(`[SİSTEM] Bot lobiye giriş yaptı. (Spawn Count: ${this.spawned})`));
            
            if (this.spawned === 1) {
                await sleep(3000);
                this.bot.chat(`/login ${this.options.password}`);
                console.log(color.cyan(`[LOGIN] Kimlik doğrulama gönderildi.`));
                this.monitorPortal();
            }
        });

        this.bot.on("messagestr", (msg) => this.handleMessage(msg));
        this.bot.on("end", (reason) => {
            console.log(color.yellow(`[BAĞLANTI] Kesildi: ${reason}. Yeniden bağlanılıyor...`));
            setTimeout(() => this.init(), CONFIG.reconnectDelay);
        });

        this.bot.on("error", (err) => console.log(color.red(`[HATA] ${err.message}`)));
    }

    handleMessage(msg) {
        const now = Date.now();
        // Spam engelleyici (Eğer son mesajla aynıysa ve 5 saniye geçmediyse basma)
        if (msg === this.lastMsg && (now - this.msgTime) < CONFIG.spamFilter) return;
        
        this.lastMsg = msg;
        this.msgTime = now;

        if (msg.toLowerCase().includes("login") || msg.toLowerCase().includes("şifre")) {
            this.bot.chat(`/login ${this.options.password}`);
        }
        process.stdout.write(color.white(`\r[CHAT] ${msg.substring(0, 50)}...\n`));
    }

    async monitorPortal() {
        const check = setInterval(async () => {
            if (this.isPortaling || !this.bot.entity) return;

            const portal = this.bot.findBlock({
                matching: (b) => b.name === 'nether_portal' || b.name === 'portal',
                maxDistance: 32
            });

            if (portal) {
                clearInterval(check);
                this.executePrecisionEntry(portal);
            } else {
                process.stdout.write(color.yellow(`\r[RADAR] Portal aranıyor... X: ${this.bot.entity.position.x.toFixed(0)} Z: ${this.bot.entity.position.z.toFixed(0)}`));
            }
        }, CONFIG.checkInterval);
    }

    async executePrecisionEntry(portal) {
        console.log(color.bgGreen.black(`\n[HEDEF] Portal tespit edildi: ${portal.position}`));
        
        // Hassas Hareket Başlangıcı
        this.bot.lookAt(portal.position.offset(0, 1, 0), true);
        this.bot.setControlState("forward", true);
        this.bot.setControlState("sprint", true);

        const entryLoop = setInterval(() => {
            if (!this.bot.entity) return;
            const dist = this.bot.entity.position.distanceTo(portal.position);
            
            // Titreşimli Giriş Mekaniği
            if (dist <= CONFIG.portalDistance) {
                this.isPortaling = true;
                this.performVibration();
            } else {
                this.bot.setControlState("forward", true);
            }
        }, 100);
    }

    performVibration() {
        console.log(color.magenta(`[GİRİŞ] Portal bölgesine girildi, titreşimli aktarım başlatılıyor...`));
        let count = 0;
        const vib = setInterval(() => {
            this.bot.setControlState("forward", !this.bot.controlState.forward);
            this.bot.setControlState("back", !this.bot.controlState.forward);
            
            count++;
            if (count > 20) {
                clearInterval(vib);
                console.log(color.bgMagenta.white(`\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`));
                console.log(color.bgMagenta.white(`!!      İŞLEM TAMAMLANDI: PORTALDA BEKLENİYOR   !!`));
                console.log(color.bgMagenta.white(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`));
            }
        }, 300);
    }
}

// Bot Başlatıcı
module.exports = (options) => new AdvancedBot(options);
a
