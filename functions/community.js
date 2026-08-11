const { EmbedBuilder, resolvePermissionsToBitfield } = require("@fluxerjs/core");

function slugify(input, fallback = "conversation") {
  const out = String(input || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return out || fallback;
}

function memberName(member, userId) {
  return slugify(member?.nick || member?.user?.global_name || member?.user?.username || `user-${String(userId).slice(-6)}`);
}

function getEveryoneRole(guild) {
  return guild.roles?.find?.((r) => r.name === "@everyone") || guild.roles?.cache?.find?.((r) => r.name === "@everyone");
}

function conversationTopic(c) {
  return `obw:type=${c.type};owner=${c.ownerId};managed=1`;
}

async function createConversation(client, guild, db, launcher, userId) {
  const member = await guild.fetchMember(userId);
  if (!member) throw new Error("Could not resolve member");
  const existing = (db.community?.conversations || []).filter(c => c.ownerId === userId && c.launcherKey === launcher.key && c.status === "open");
  const maxOpen = Number(launcher.maxOpenPerUser ?? 0);
  if (maxOpen > 0 && existing.length >= maxOpen) return { error: `You already have the maximum number (${maxOpen}) of open ${launcher.label || launcher.key} conversations.` };

  const serial = (db.community?.conversations || []).length + 1;
  const name = `${slugify(launcher.prefix || launcher.key)}-${memberName(member, userId)}-${String(serial).padStart(3, "0")}`.slice(0, 100);
  const channel = await guild.createChannel({ type: 0, name, parent_id: launcher.categoryId || undefined });
  const everyone = getEveryoneRole(guild);

  if (launcher.private && everyone) {
    await channel.editPermission(everyone.id, { type: 0, deny: resolvePermissionsToBitfield(["ViewChannel"]) });
    await channel.editPermission(userId, { type: 1, allow: resolvePermissionsToBitfield(["ViewChannel", "SendMessages", "ReadMessageHistory"]) });
    for (const roleId of launcher.allowedRoleIds || []) {
      await channel.editPermission(roleId, { type: 0, allow: resolvePermissionsToBitfield(["ViewChannel", "SendMessages", "ReadMessageHistory"]) });
    }
  }

  const record = { id: `${Date.now()}-${serial}`, channelId: channel.id, launcherKey: launcher.key, launcherMessageId: launcher.messageId, launcherChannelId: launcher.channelId, ownerId: userId, type: launcher.type || "generic", private: !!launcher.private, status: "open", createdAt: Date.now(), lastActivityAt: Date.now() };
  await channel.edit({ topic: conversationTopic(record) }).catch(() => {});
  await channel.send({ embeds: [new EmbedBuilder().setColor("#A52F05").setTitle(`${launcher.private ? "🎫" : "🧵"} ${launcher.label || "Conversation"}`).setDescription(`<@${userId}> opened this ${launcher.private ? "private " : ""}conversation.\n\nUse \`${db.prefix}community close\` when you're done.`)] }).catch(() => {});

  const community = db.community || {};
  await client.database.updateGuild(guild.id, { community: { ...community, conversations: [...(community.conversations || []), record] } });
  return { channel, record };
}

async function closeConversation(client, guildId, channelId, actorId) {
  const db = await client.database.getGuild(guildId, true);
  const community = db.community || {};
  const conv = (community.conversations || []).find(c => c.channelId === channelId && c.status === "open");
  if (!conv) return { error: "This is not an open managed conversation." };
  const guild = client.guilds.get(guildId) || await client.guilds.fetch(guildId);
  const member = await guild.fetchMember(actorId);
  const canClose = actorId === conv.ownerId || member?.permissions?.has?.("ManageChannels") || member?.permissions?.has?.("ManageGuild");
  if (!canClose) return { error: "Only the owner or staff can close this conversation." };
  const channel = await client.channels.fetch(channelId);
  const everyone = getEveryoneRole(guild);
  if (everyone) await channel.editPermission(everyone.id, { type: 0, deny: resolvePermissionsToBitfield(["SendMessages"]) }).catch(() => {});
  const updated = (community.conversations || []).map(c => c.channelId === channelId ? { ...c, status: "closed", closedAt: Date.now(), closedBy: actorId } : c);
  await client.database.updateGuild(guildId, { community: { ...community, conversations: updated } });
  await channel.send(`🔒 Closed by <@${actorId}>.`).catch(() => {});
  return { ok: true };
}

async function addParticipant(client, guildId, channelId, actorId, targetId) {
  const db = await client.database.getGuild(guildId, true);
  const community = db.community || {};
  const conv = (community.conversations || []).find(c => c.channelId === channelId && c.status === "open");
  if (!conv || !conv.private) return { error: "This is not an open private managed conversation." };
  const guild = client.guilds.get(guildId) || await client.guilds.fetch(guildId);
  const actor = await guild.fetchMember(actorId);
  const allowed = actorId === conv.ownerId || actor?.permissions?.has?.("ManageChannels") || actor?.permissions?.has?.("ManageGuild");
  if (!allowed) return { error: "You cannot add participants to this conversation." };
  const channel = await client.channels.fetch(channelId);
  await channel.editPermission(targetId, { type: 1, allow: resolvePermissionsToBitfield(["ViewChannel", "SendMessages", "ReadMessageHistory"]) });
  return { ok: true };
}

module.exports = { slugify, createConversation, closeConversation, addParticipant };
