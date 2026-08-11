const fs = require('fs');
const path = require('path');

const root = process.argv[2] || '/app';

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content);
  console.log(`patched ${rel}`);
}
function requireReplace(content, needle, replacement, label) {
  if (!content.includes(needle)) throw new Error(`Could not patch ${label}: expected source block not found`);
  return content.replace(needle, replacement);
}

// Guild schema
{
  const rel = 'models/guilds.js';
  let s = read(rel);
  if (!s.includes('community: {')) {
    s = requireReplace(
      s,
      '  tags: { type: Array, default: [] },',
      `  community: {\n    launchers: { type: Array, default: [] },\n    conversations: { type: Array, default: [] },\n    starboard: {\n      enabled: { type: Boolean, default: false },\n      channelId: { type: String, default: null },\n      emoji: { type: String, default: "⭐" },\n      threshold: { type: Number, default: 3 },\n      includeNsfw: { type: Boolean, default: false },\n      entries: { type: Array, default: [] },\n    },\n    confessions: {\n      enabled: { type: Boolean, default: false },\n      channelId: { type: String, default: null },\n      retainAuthor: { type: Boolean, default: true },\n      entries: { type: Array, default: [] },\n    },\n  },\n  tags: { type: Array, default: [] },`,
      rel
    );
    write(rel, s);
  }
}

// DM confession hook
{
  const rel = 'events/messageCreate.js';
  let s = read(rel);
  if (!s.includes('const communityDm = require("../functions/communityDm");')) {
    s = s.replace(
      'const manageVC = require("../functions/manageVC");',
      'const manageVC = require("../functions/manageVC");\nconst communityDm = require("../functions/communityDm");'
    );
  }
  const old = `  if (!message?.channel || !message.content || message.author.bot) return;\n  const MVC = client.manageVC.get(message.author.id);\n  if (message.channel.type === 1 && MVC) return await manageVC(client, message)\n  if (message.channel.type === 1) return;`;
  const next = `  if (!message?.channel || !message.content || message.author.bot) return;\n  const MVC = client.manageVC.get(message.author.id);\n  if (message.channel.type === 1 && MVC) return await manageVC(client, message);\n  if (message.channel.type === 1) {\n    if (await communityDm(client, message)) return;\n    return;\n  }`;
  if (!s.includes(next)) s = requireReplace(s, old, next, rel);
  write(rel, s);
}

// Reaction hook for launchers and starboard
{
  const rel = 'events/messageReactionAdd.js';
  let s = read(rel);
  if (!s.includes('const communityHandler = require("../reactionHandlers/community");')) {
    s = s.replace(
      'const timezoneHandler = require("../reactionHandlers/timezone");',
      'const timezoneHandler = require("../reactionHandlers/timezone");\nconst communityHandler = require("../reactionHandlers/community");'
    );
  }
  const old = '  return roleReactionHandler(client, reaction, userId, emojiId, "add");';
  const next = `  const guildId = reaction.reaction?.guildId || reaction.guildId || reactionMsg.guildId;\n  const guildDb = guildId ? await client.database.getGuild(guildId, true) : null;\n  if (guildDb && await communityHandler(client, reaction, reactionMsg, guildDb)) return;\n\n  return roleReactionHandler(client, reaction, userId, emojiId, "add");`;
  if (!s.includes('await communityHandler(client, reaction, reactionMsg, guildDb)')) {
    s = requireReplace(s, old, next, rel);
  }
  write(rel, s);
}

// Cleanup when managed/configured channels are removed
{
  const rel = 'events/channelDelete.js';
  let s = read(rel);
  if (!s.includes('const conversations = (db.community.conversations || []).filter')) {
    const insertion = `\n  if (db.community) {\n    const launchers = (db.community.launchers || []).filter(x => x.channelId !== channel.id);\n    const conversations = (db.community.conversations || []).filter(x => x.channelId !== channel.id);\n    const starboard = db.community.starboard?.channelId === channel.id\n      ? { ...db.community.starboard, enabled: false, channelId: null }\n      : db.community.starboard;\n    const confessions = db.community.confessions?.channelId === channel.id\n      ? { ...db.community.confessions, enabled: false, channelId: null }\n      : db.community.confessions;\n\n    await client.database.updateGuild(guildId, {\n      community: { ...db.community, launchers, conversations, starboard, confessions }\n    });\n  }\n`;
    const idx = s.lastIndexOf('\n};');
    if (idx < 0) throw new Error(`Could not patch ${rel}: module ending not found`);
    s = s.slice(0, idx) + insertion + s.slice(idx);
    write(rel, s);
  }
}

console.log('OBW overlay applied successfully');
