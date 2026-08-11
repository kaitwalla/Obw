const { EmbedBuilder, PermissionFlags, resolvePermissionsToBitfield } = require("@fluxerjs/core");
const blueprint = require("../blueprints/server");

function findByName(collection, name, type = null) {
  const values = collection?.values ? [...collection.values()] : Array.isArray(collection) ? collection : [];
  return values.find(x => x?.name === name && (type == null || x?.type === type));
}

async function getChannels(guild) {
  const fetched = await guild.fetchChannels();
  return fetched?.values ? [...fetched.values()] : fetched;
}

async function ensureRole(guild, name, color) {
  let role = findByName(guild.roles, name);
  if (role) return { role, created: false };
  role = await guild.createRole({ name, color: color || 0, mentionable: false, hoist: false });
  return { role, created: true };
}

async function ensureCategory(guild, channels, name) {
  let category = channels.find(x => x.name === name && x.type === 4);
  if (category) return { channel: category, created: false };
  category = await guild.createChannel({ type: 4, name });
  channels.push(category);
  return { channel: category, created: true };
}

async function ensureChannel(guild, channels, spec, parentId) {
  let channel = channels.find(x => x.name === spec.name && x.type === spec.type && (parentId ? x.parentId === parentId || x.parent_id === parentId : true));
  if (channel) return { channel, created: false };
  channel = await guild.createChannel({
    type: spec.type,
    name: spec.name,
    parent_id: parentId || undefined,
    nsfw: !!spec.nsfw,
  });
  channels.push(channel);
  return { channel, created: true };
}

function everyoneRole(guild) {
  return findByName(guild.roles, "@everyone");
}

async function gateChannel(channel, guild, role) {
  const everyone = everyoneRole(guild);
  if (!everyone || !role) return;
  await channel.editPermission(everyone.id, { type: 0, deny: resolvePermissionsToBitfield(["ViewChannel"]) });
  await channel.editPermission(role.id, { type: 0, allow: resolvePermissionsToBitfield(["ViewChannel"]) });
}

async function makeReadOnly(channel, guild) {
  const everyone = everyoneRole(guild);
  if (!everyone) return;
  await channel.editPermission(everyone.id, { type: 0, deny: resolvePermissionsToBitfield(["SendMessages"]) });
}

async function ensureRolePanel(client, message, db, channel, group, roleMap, panelState, roleRecords) {
  const existing = panelState.find(x => x.key === group.key);
  if (existing) {
    const old = await channel.messages.fetch(existing.messageId).catch(() => null);
    if (old) return existing;
  }

  const lines = group.roles.map(([emoji, name]) => `${emoji} ${name}`);
  const panel = await channel.send({ embeds: [new EmbedBuilder()
    .setColor("#A52F05")
    .setTitle(group.title)
    .setDescription(`${group.exclusive ? "Choose one." : "Choose any that apply."}\n\n${lines.join("\n")}`)] });

  const entries = [];
  let position = 0;
  for (const [emoji, name] of group.roles) {
    const role = roleMap[name];
    if (!role) continue;
    position += 1;
    await panel.react(emoji).catch(() => {});
    entries.push({ emoji, emojiKey: emoji, role: role.id, name: role.name, position });
  }

  roleRecords.push({ msgId: panel.id, chanId: channel.id, roles: entries, exclusive: group.exclusive ? true : null });
  const state = { key: group.key, messageId: panel.id, channelId: channel.id };
  panelState.push(state);
  return state;
}

async function ensureLauncher(channel, launcher, staffRoleIds, panelState) {
  const existing = panelState.find(x => x.key === launcher.key);
  if (existing) {
    const msg = await channel.messages.fetch(existing.messageId).catch(() => null);
    if (msg) return existing;
  }
  const panel = await channel.send({ embeds: [new EmbedBuilder()
    .setColor("#A52F05")
    .setTitle(`${launcher.emoji} ${launcher.label}`)
    .setDescription(launcher.private
      ? `React with ${launcher.emoji} to open a private space visible to you and the moderation team.`
      : `React with ${launcher.emoji} to start a dedicated discussion channel.`)] });
  await panel.react(launcher.emoji).catch(() => {});
  const state = { key: launcher.key, messageId: panel.id, channelId: channel.id, staffRoleIds };
  panelState.push(state);
  return state;
}

module.exports = {
  config: {
    name: "provision",
    usage: "preview | apply confirm",
    cooldown: 5000,
    available: true,
    permissions: { name: "Manage Guild", bitField: PermissionFlags.ManageGuild },
    aliases: ["setupserver", "bootstrap"],
  },

  run: async (client, message, args, db) => {
    const action = (args[0] || "preview").toLowerCase();
    if (action !== "apply") {
      const channelCount = blueprint.channels.length;
      const roleCount = new Set(blueprint.roleGroups.flatMap(g => g.roles.map(r => r[1]))).size;
      return message.reply({ embeds: [new EmbedBuilder()
        .setColor("#A52F05")
        .setTitle("OBW provisioning preview")
        .setDescription(`Blueprint v${blueprint.version}\n\n• ${blueprint.categories.length} categories\n• ${channelCount} channels\n• ${roleCount} self-assignable roles\n• ${blueprint.roleGroups.length} role panels\n• ${blueprint.launchers.length} managed-conversation launchers\n• starboard + anonymous confessions\n\nThis is idempotent by name and stored message IDs.\n\nRun \`${db.prefix}provision apply confirm\` to apply it.`)] });
    }
    if ((args[1] || "").toLowerCase() !== "confirm") return message.reply(`Run \`${db.prefix}provision apply confirm\` to confirm.`);

    const guild = message.guild;
    const report = { roles: 0, categories: 0, channels: 0, panels: 0, launchers: 0 };
    let channels = await getChannels(guild);

    // 1. Roles
    const roleMap = {};
    for (const group of blueprint.roleGroups) {
      for (const entry of group.roles) {
        const [, name, color] = entry;
        if (roleMap[name]) continue;
        const result = await ensureRole(guild, name, color);
        roleMap[name] = result.role;
        if (result.created) report.roles += 1;
      }
    }
    // Resolve existing staff roles but do not create privileged staff roles automatically.
    for (const name of ["Moderator", "Admin"]) {
      const role = findByName(guild.roles, name);
      if (role) roleMap[name] = role;
    }

    // 2. Categories
    const categoryMap = {};
    for (const spec of blueprint.categories) {
      const result = await ensureCategory(guild, channels, spec.name);
      categoryMap[spec.key] = result.channel;
      if (result.created) report.categories += 1;
    }

    // 3. Channels
    const channelMap = {};
    for (const spec of blueprint.channels) {
      const parent = spec.parent ? categoryMap[spec.parent] : null;
      const result = await ensureChannel(guild, channels, spec, parent?.id);
      const key = spec.key || `${spec.parent || "root"}:${spec.name}`;
      channelMap[key] = result.channel;
      if (result.created) report.channels += 1;
      if (spec.readOnly) await makeReadOnly(result.channel, guild);
      if (spec.accessRole && roleMap[spec.accessRole]) await gateChannel(result.channel, guild, roleMap[spec.accessRole]);
    }

    // 4. Category gates, applied both to categories and children for predictable behavior.
    for (const spec of blueprint.categories.filter(x => x.accessRole)) {
      const role = roleMap[spec.accessRole];
      const category = categoryMap[spec.key];
      if (!role || !category) continue;
      await gateChannel(category, guild, role);
      for (const child of blueprint.channels.filter(x => x.parent === spec.key)) {
        const key = child.key || `${child.parent}:${child.name}`;
        if (channelMap[key]) await gateChannel(channelMap[key], guild, role);
      }
    }

    // 5. Reaction role panels in #roles, using Functious's native DB format.
    const rolesChannel = channelMap.roles;
    const community = db.community || {};
    const provision = community.provision || {};
    const panelState = [...(provision.rolePanels || [])];
    const roleRecords = [...(db.roles || [])];
    if (rolesChannel) {
      for (const group of blueprint.roleGroups) {
        const before = panelState.length;
        await ensureRolePanel(client, message, db, rolesChannel, group, roleMap, panelState, roleRecords);
        if (panelState.length > before) report.panels += 1;
      }
    }

    // 6. Managed conversation launcher panels.
    const launcherState = [...(provision.launcherPanels || [])];
    const launchers = [];
    for (const spec of blueprint.launchers) {
      const channel = channelMap[spec.channel];
      const category = categoryMap[spec.category];
      if (!channel || !category) continue;
      const staffRoleIds = (spec.staffRoles || []).map(n => roleMap[n]?.id).filter(Boolean);
      const before = launcherState.length;
      const panel = await ensureLauncher(channel, spec, staffRoleIds, launcherState);
      if (launcherState.length > before) report.launchers += 1;
      launchers.push({
        key: spec.key,
        label: spec.label,
        emoji: spec.emoji,
        channelId: channel.id,
        categoryId: category.id,
        private: !!spec.private,
        prefix: spec.prefix,
        maxOpenPerUser: spec.maxOpenPerUser || 0,
        allowedRoleIds: staffRoleIds,
        type: spec.key,
        messageId: panel.messageId,
      });
    }

    // 7. Configure starboard and confessions.
    const starboardChannel = channelMap[blueprint.starboard.channel];
    const confessionChannel = channelMap[blueprint.confessions.channel];
    const nextCommunity = {
      ...community,
      launchers,
      starboard: {
        ...(community.starboard || {}),
        enabled: !!starboardChannel,
        channelId: starboardChannel?.id || null,
        emoji: blueprint.starboard.emoji,
        threshold: blueprint.starboard.threshold,
        entries: community.starboard?.entries || [],
      },
      confessions: {
        ...(community.confessions || {}),
        enabled: !!confessionChannel,
        channelId: confessionChannel?.id || null,
        retainAuthor: blueprint.confessions.retainAuthor,
        entries: community.confessions?.entries || [],
      },
      provision: {
        blueprintVersion: blueprint.version,
        rolePanels: panelState,
        launcherPanels: launcherState,
        lastAppliedAt: Date.now(),
      },
    };

    await client.database.updateGuild(message.guildId, { roles: roleRecords, community: nextCommunity });

    return message.reply({ embeds: [new EmbedBuilder()
      .setColor("#2ECC71")
      .setTitle("OBW provisioning complete")
      .setDescription(`Created this run:\n• ${report.roles} roles\n• ${report.categories} categories\n• ${report.channels} channels\n• ${report.panels} role panels\n• ${report.launchers} launcher panels\n\nExisting matching objects were reused.\n\nNote: Moderator/Admin roles are never auto-created or granted privileges. If those roles already exist, ticket access is wired to them.`)] });
  },
};
