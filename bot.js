const { Telegraf } = require("telegraf");
const fs = require("fs");
const axios = require("axios");
const phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();
const PNF = require("google-libphonenumber").PhoneNumberFormat;

// ─── Load Config ─────────────────────────────────────────────

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

const BOT_TOKEN = config.bot_token;
const OWNER_ID = parseInt(config.owner_id);
const GC_TOKEN = config.gc_token || "";
const GC_FINAL_KEY = config.gc_final_key || "";
const DB_FILE = "./db.json";

const bot = new Telegraf(BOT_TOKEN);

// ─── Database ────────────────────────────────────────────────

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { admins: [], members: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getRole(userId) {
  if (userId === OWNER_ID) return "owner";
  const db = loadDB();
  if (db.admins.includes(userId)) return "admin";
  if (db.members.includes(userId)) return "member";
  return null;
}

// ─── Phone Info ──────────────────────────────────────────────

function parsePhone(raw) {
  let num = raw.trim().replace(/[\s\-]/g, "");
  if (num.startsWith("08") || num.startsWith("8")) {
    num = "+62" + num.replace(/^0+/, "");
  } else if (!num.startsWith("+")) {
    num = "+" + num;
  }
  return num;
}

function getPhoneInfo(number) {
  try {
    const parsed = phoneUtil.parse(number);
    if (!phoneUtil.isValidNumber(parsed)) return null;
    const formatted = phoneUtil.format(parsed, PNF.INTERNATIONAL);
    const regionCode = phoneUtil.getRegionCodeForNumber(parsed);
    return { formatted, regionCode };
  } catch {
    return null;
  }
}

function detectProvider(number) {
  const prefixMap = {
    "0811": "Telkomsel", "0812": "Telkomsel", "0813": "Telkomsel",
    "0821": "Telkomsel", "0822": "Telkomsel", "0823": "Telkomsel",
    "0851": "Telkomsel", "0852": "Telkomsel", "0853": "Telkomsel",
    "0814": "Indosat Ooredoo", "0815": "Indosat Ooredoo", "0816": "Indosat Ooredoo",
    "0855": "Indosat Ooredoo", "0856": "Indosat Ooredoo", "0857": "Indosat Ooredoo",
    "0858": "Indosat Ooredoo",
    "0817": "XL Axiata", "0818": "XL Axiata", "0819": "XL Axiata",
    "0859": "XL Axiata", "0877": "XL Axiata", "0878": "XL Axiata",
    "0831": "Axis (XL)", "0832": "Axis (XL)", "0833": "Axis (XL)", "0838": "Axis (XL)",
    "0895": "Tri (3)", "0896": "Tri (3)", "0897": "Tri (3)",
    "0898": "Tri (3)", "0899": "Tri (3)",
    "0881": "Smartfren", "0882": "Smartfren", "0883": "Smartfren",
    "0884": "Smartfren", "0885": "Smartfren", "0886": "Smartfren",
    "0887": "Smartfren", "0888": "Smartfren", "0889": "Smartfren",
  };
  const local = number.replace(/^\+62/, "0").replace(/\s/g, "");
  const prefix = local.substring(0, 4);
  return prefixMap[prefix] || "Tidak diketahui";
}

function getRegionName(regionCode) {
  const regions = {
    ID: "Indonesia", MY: "Malaysia", SG: "Singapura",
    US: "Amerika Serikat", GB: "Inggris", AU: "Australia",
    JP: "Jepang", KR: "Korea Selatan", CN: "China",
    IN: "India", SA: "Arab Saudi", AE: "Uni Emirat Arab",
  };
  return regions[regionCode] || regionCode || "Tidak diketahui";
}

// ─── GetContact ──────────────────────────────────────────────

async function getGCTags(phone) {
  if (!GC_TOKEN || !GC_FINAL_KEY) return { tags: [], error: "not_configured" };
  try {
    const res = await axios.post(
      "https://api.getcontact.com/v2/number",
      { phoneNumber: phone },
      {
        headers: {
          Authorization: `Bearer ${GC_TOKEN}`,
          "x-final-key": GC_FINAL_KEY,
          "User-Agent": "GetContact/7.2.0 Android",
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    const data = res.data;
    const raw = data?.tags || data?.data?.tags || [];
    const tags = raw.map((t) => (typeof t === "string" ? t : t?.tag || "")).filter(Boolean);
    return { tags, error: null };
  } catch (err) {
    const msg = err?.response?.data?.message || err.message;
    return { tags: [], error: msg };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function esc(text) {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// ─── Commands ────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const role = getRole(ctx.from.id);
  const name = esc(ctx.from.first_name);

  const roleLabel = {
    owner: "👑 *OWNER*",
    admin: "🛡 *ADMIN*",
    member: "👤 *MEMBER*",
  }[role] || "❌ *TIDAK TERDAFTAR*";

  const caption =
    `╔══════════════════════╗\n` +
    `║   🌐 *FSOCIETY x GETCONT*   ║\n` +
    `╚══════════════════════╝\n\n` +
    `👋 Halo, *${name}*\\!\n` +
    `🎭 Role kamu: ${roleLabel}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *MENU PERINTAH*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔍 /looknum \\- Cek info nomor HP\n` +
    `     _Format: /looknum 08xxx_\n\n` +
    `👑 /addadm \\- Tambah admin\n` +
    `     _\\(Owner only\\)_\n\n` +
    `➕ /addmem \\- Tambah member\n` +
    `     _\\(Owner & Admin\\)_\n\n` +
    `🗑 /deladm \\- Hapus admin\n` +
    `     _\\(Owner only\\)_\n\n` +
    `🗑 /delmem \\- Hapus member\n` +
    `     _\\(Owner & Admin\\)_\n\n` +
    `📜 /listuser \\- Lihat semua user\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ _Powered by FSOCIETY_`;

  await ctx.replyWithVideo(
    "https://files.catbox.moe/vj4dz8.mp4",
    {
      caption,
      parse_mode: "MarkdownV2",
    }
  );
});

bot.command("looknum", async (ctx) => {
  if (!getRole(ctx.from.id)) {
    return ctx.reply("❌ Kamu tidak punya akses\\. Hubungi owner atau admin\\.", { parse_mode: "MarkdownV2" });
  }

  const args = ctx.message.text.split(" ").slice(1);
  if (!args.length) {
    return ctx.reply("⚠️ Format: `/looknum 08xxx`", { parse_mode: "MarkdownV2" });
  }

  const number = parsePhone(args[0]);
  const sent = await ctx.reply("🔍 Mencari info nomor\\.\\.\\.", { parse_mode: "MarkdownV2" });

  const info = getPhoneInfo(number);
  if (!info) {
    return ctx.telegram.editMessageText(ctx.chat.id, sent.message_id, null,
      "❌ Nomor tidak valid atau tidak dikenali\\.", { parse_mode: "MarkdownV2" });
  }

  const provider = detectProvider(info.formatted);
  const region = getRegionName(info.regionCode);
  const { tags, error: gcError } = await getGCTags(info.formatted);

  let tagSection = "";
  if (!GC_TOKEN || !GC_FINAL_KEY) {
    tagSection = "\n\n🏷 *Tag GetContact:* _Token belum dikonfigurasi_";
  } else if (gcError) {
    tagSection = `\n\n🏷 *Tag GetContact:* ❌ _${esc(gcError)}_`;
  } else if (tags.length > 0) {
    tagSection = `\n\n🏷 *Tag GetContact \\(${tags.length}\\):*\n` +
      tags.map((t) => `  • \`${esc(t)}\``).join("\n");
  } else {
    tagSection = "\n\n🏷 *Tag GetContact:* _Tidak ada tag publik_";
  }

  await ctx.telegram.editMessageText(
    ctx.chat.id, sent.message_id, null,
    `📱 *Info Nomor*\n` +
    `${"─".repeat(26)}\n` +
    `*Nomor:* \`${esc(info.formatted)}\`\n` +
    `*Provider:* ${esc(provider)}\n` +
    `*Negara\\/Region:* ${esc(region)}` +
    tagSection,
    { parse_mode: "MarkdownV2" }
  );
});

bot.command("addadm", async (ctx) => {
  if (getRole(ctx.from.id) !== "owner") {
    return ctx.reply("❌ Hanya *owner* yang bisa menambah admin\\.", { parse_mode: "MarkdownV2" });
  }
  const args = ctx.message.text.split(" ").slice(1);
  if (!args.length) return ctx.reply("⚠️ Format: `/addadm <user_id>`", { parse_mode: "MarkdownV2" });

  const targetId = parseInt(args[0]);
  if (isNaN(targetId)) return ctx.reply("❌ Gunakan User ID angka\\.", { parse_mode: "MarkdownV2" });
  if (targetId === OWNER_ID) return ctx.reply("❌ Owner tidak perlu ditambah\\.", { parse_mode: "MarkdownV2" });

  const db = loadDB();
  if (db.admins.includes(targetId)) return ctx.reply(`⚠️ User \`${targetId}\` sudah jadi admin\\.`, { parse_mode: "MarkdownV2" });

  db.members = db.members.filter((m) => m !== targetId);
  db.admins.push(targetId);
  saveDB(db);
  await ctx.reply(`✅ User \`${targetId}\` berhasil dijadikan *Admin*\\.`, { parse_mode: "MarkdownV2" });
});

bot.command("addmem", async (ctx) => {
  const role = getRole(ctx.from.id);
  if (!["owner", "admin"].includes(role)) {
    return ctx.reply("❌ Hanya *owner* atau *admin* yang bisa menambah member\\.", { parse_mode: "MarkdownV2" });
  }
  const args = ctx.message.text.split(" ").slice(1);
  if (!args.length) return ctx.reply("⚠️ Format: `/addmem <user_id>`", { parse_mode: "MarkdownV2" });

  const targetId = parseInt(args[0]);
  if (isNaN(targetId)) return ctx.reply("❌ Gunakan User ID angka\\.", { parse_mode: "MarkdownV2" });
  if (targetId === OWNER_ID) return ctx.reply("❌ Owner tidak perlu ditambah\\.", { parse_mode: "MarkdownV2" });

  const db = loadDB();
  if (db.admins.includes(targetId)) return ctx.reply(`⚠️ User \`${targetId}\` sudah jadi *admin*\\.`, { parse_mode: "MarkdownV2" });
  if (db.members.includes(targetId)) return ctx.reply(`⚠️ User \`${targetId}\` sudah jadi member\\.`, { parse_mode: "MarkdownV2" });

  db.members.push(targetId);
  saveDB(db);
  await ctx.reply(`✅ User \`${targetId}\` berhasil ditambahkan sebagai *Member*\\.`, { parse_mode: "MarkdownV2" });
});

bot.command("deladm", async (ctx) => {
  if (getRole(ctx.from.id) !== "owner") {
    return ctx.reply("❌ Hanya *owner* yang bisa menghapus admin\\.", { parse_mode: "MarkdownV2" });
  }
  const args = ctx.message.text.split(" ").slice(1);
  if (!args.length) return ctx.reply("⚠️ Format: `/deladm <user_id>`", { parse_mode: "MarkdownV2" });

  const targetId = parseInt(args[0]);
  if (isNaN(targetId)) return ctx.reply("❌ Gunakan User ID angka\\.", { parse_mode: "MarkdownV2" });

  const db = loadDB();
  if (!db.admins.includes(targetId)) return ctx.reply(`⚠️ User \`${targetId}\` bukan admin\\.`, { parse_mode: "MarkdownV2" });

  db.admins = db.admins.filter((a) => a !== targetId);
  saveDB(db);
  await ctx.reply(`✅ Admin \`${targetId}\` berhasil dihapus\\.`, { parse_mode: "MarkdownV2" });
});

bot.command("delmem", async (ctx) => {
  if (!["owner", "admin"].includes(getRole(ctx.from.id))) {
    return ctx.reply("❌ Tidak ada akses\\.", { parse_mode: "MarkdownV2" });
  }
  const args = ctx.message.text.split(" ").slice(1);
  if (!args.length) return ctx.reply("⚠️ Format: `/delmem <user_id>`", { parse_mode: "MarkdownV2" });

  const targetId = parseInt(args[0]);
  if (isNaN(targetId)) return ctx.reply("❌ Gunakan User ID angka\\.", { parse_mode: "MarkdownV2" });

  const db = loadDB();
  if (!db.members.includes(targetId)) return ctx.reply(`⚠️ User \`${targetId}\` bukan member\\.`, { parse_mode: "MarkdownV2" });

  db.members = db.members.filter((m) => m !== targetId);
  saveDB(db);
  await ctx.reply(`✅ Member \`${targetId}\` berhasil dihapus\\.`, { parse_mode: "MarkdownV2" });
});

bot.command("listuser", async (ctx) => {
  if (!["owner", "admin"].includes(getRole(ctx.from.id))) {
    return ctx.reply("❌ Tidak ada akses\\.", { parse_mode: "MarkdownV2" });
  }
  const db = loadDB();
  const admins = db.admins.length ? db.admins.map((a) => `  • \`${a}\``).join("\n") : "  _Kosong_";
  const members = db.members.length ? db.members.map((m) => `  • \`${m}\``).join("\n") : "  _Kosong_";

  await ctx.reply(
    `👑 *Owner:*\n  • \`${OWNER_ID}\`\n\n` +
    `🛡 *Admins:*\n${admins}\n\n` +
    `👤 *Members:*\n${members}`,
    { parse_mode: "MarkdownV2" }
  );
});

// ─── Launch ──────────────────────────────────────────────────

bot.launch().then(() => {
  console.log("✅ GC Lookup Bot berjalan...");
}).catch((err) => {
  console.error("❌ Gagal start:", err.message);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
