const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const path = require('path');

const TOKEN = '8864377455:AAFhMlui8SQ3lXsGT6RhwFQidkvMKcHCFfA';
const OWNER_ID = 7742916370;
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'users.json');
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ "admin": "prank2024" }, null, 2));
}
let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🤖 *Bot GeoLocator*\n\n/adduser username password\n/listuser', { parse_mode: 'Markdown' });
});

bot.onText(/\/adduser (\w+) (\w+)/, (msg, match) => {
  if (msg.from.id !== OWNER_ID) return bot.sendMessage(msg.chat.id, '❌ Hanya owner.');
  const [_, u, p] = match;
  if (u.length < 3 || p.length < 3) return bot.sendMessage(msg.chat.id, '❌ Minimal 3 karakter.');
  users[u] = p;
  saveUsers();
  bot.sendMessage(msg.chat.id, `✅ Akun dibuat!\nUsername: ${u}\nPassword: ${p}`);
});

bot.onText(/\/listuser/, (msg) => {
  if (msg.from.id !== OWNER_ID) return bot.sendMessage(msg.chat.id, '❌ Hanya owner.');
  const list = Object.entries(users).map(([u, p]) => `${u}: ${p}`).join('\n') || 'Kosong';
  bot.sendMessage(msg.chat.id, `📋 Daftar Akun:\n${list}`);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const current = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  if (current[username] === password) return res.json({ success: true });
  res.json({ success: false });
});

app.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});