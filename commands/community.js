const { EmbedBuilder, PermissionFlags } = require("@fluxerjs/core");
const { closeConversation, addParticipant, slugify } = require("../functions/community");
const parseId = raw => String(raw || "").match(/\d{5,}/)?.[0] || null;

module.exports = {
  config: { name: "community", usage: "help", cooldown: 1500, available: true, permissions: null, aliases: ["comm"] },
  run: async (client, message, args, db) => {
    const sub = (args.shift() || "help").toLowerCase();
    const isManager = message.member?.permissions?.has?.(PermissionFlags.ManageGuild) || message.member?.permissions?.has?.(PermissionFlags.ManageChannels) || client.config.owners.includes(message.author.id);
    if (sub === "help") return message.reply({ embeds: [new EmbedBuilder().setColor("#A52F05").setTitle("OBW community extension").setDescription(`\`${db.prefix}community close\`\n\`${db.prefix}community add @user\`\n\`${db.prefix}community rename <name>\`\n\nStaff: \`${db.prefix}community launcher add ...\`, \`launcher panel <key>\`, \`launcher list\`, \`starboard <channelId> [threshold] [emoji]\`, \`confessions <channelId> [retainAuthor]\``)] });
    if (sub === "close") { const r = await closeConversation(client, message.guildId, message.channelId, message.author.id); return message.reply(r.error || "Closed."); }
    if (sub === "add") { const id = parseId(args[0]); if (!id) return message.reply("Mention a user to add."); const r = await addParticipant(client, message.guildId, message.channelId, message.author.id, id); return message.reply(r.error || `Added <@${id}>.`); }
    if (sub === "rename") { const conv = (db.community?.conversations || []).find(c => c.channelId === message.channelId && c.status === "open"); if (!conv) return message.reply("This is not an open managed conversation."); if (conv.ownerId !== message.author.id && !isManager) return message.reply("You cannot rename this conversation."); const name = slugify(args.join(" ")); await message.channel.edit({ name }); return message.reply(`Renamed to \`${name}\`.`); }
    if (!isManager) return message.reply("Manage Server/Channels permission is required for setup commands.");
    const community = db.community || { launchers: [], conversations: [] };
    if (sub === "launcher") {
      const action = (args.shift() || "list").toLowerCase();
      if (action === "list") { const lines = (community.launchers || []).map(x => `• **${x.key}** ${x.emoji} → <#${x.channelId}> (${x.private ? "private" : "public"})`); return message.reply(lines.length ? lines.join("\n") : "No launchers configured."); }
      if (action === "add") {
        const [key, emoji, channelRaw, categoryRaw, visibility, prefix, maxRaw, roleCsv] = args;
        if (!key || !emoji || !channelRaw || !categoryRaw) return message.reply(`Usage: \`${db.prefix}community launcher add <key> <emoji> <channelId> <categoryId> <public|private> <prefix> [maxOpen] [roleId,roleId]\``);
        const launcher = { key, label: key.replace(/[-_]/g," "), emoji, channelId: parseId(channelRaw)||channelRaw, categoryId: parseId(categoryRaw)||categoryRaw, private: String(visibility).toLowerCase()==="private", prefix: prefix||key, maxOpenPerUser:Number(maxRaw||0), allowedRoleIds: roleCsv ? roleCsv.split(",").map(s=>parseId(s)||s).filter(Boolean):[], type:key, messageId:null };
        const launchers = [...(community.launchers||[]).filter(x=>x.key!==key), launcher];
        await client.database.updateGuild(message.guildId,{community:{...community,launchers}}); return message.reply(`Configured \`${key}\`. Run \`${db.prefix}community launcher panel ${key}\` in its launcher channel.`);
      }
      if (action === "panel") { const key=args[0]; const launcher=(community.launchers||[]).find(x=>x.key===key); if(!launcher)return message.reply("Unknown launcher key."); if(message.channelId!==launcher.channelId)return message.reply(`Run this in <#${launcher.channelId}>.`); const panel=await message.channel.send({embeds:[new EmbedBuilder().setColor("#A52F05").setTitle(`${launcher.emoji} ${launcher.label}`).setDescription(`React with ${launcher.emoji} to create a ${launcher.private?"private ":""}conversation.`)]}); await panel.react(launcher.emoji); const launchers=(community.launchers||[]).map(x=>x.key===key?{...x,messageId:panel.id}:x); await client.database.updateGuild(message.guildId,{community:{...community,launchers}}); return message.reply("Launcher panel created."); }
    }
    if (sub === "starboard") { const channelId=parseId(args[0])||args[0]; if(!channelId)return message.reply("Provide a channel ID."); await client.database.updateGuild(message.guildId,{community:{...community,starboard:{...(community.starboard||{}),enabled:true,channelId,threshold:Number(args[1]||3),emoji:args[2]||"⭐",entries:community.starboard?.entries||[]}}}); return message.reply(`Starboard enabled in <#${channelId}>.`); }
    if (sub === "confessions") { const channelId=parseId(args[0])||args[0]; if(!channelId)return message.reply("Provide a channel ID."); const retainAuthor=!args[1]||!["false","no","0"].includes(args[1].toLowerCase()); await client.database.updateGuild(message.guildId,{community:{...community,confessions:{...(community.confessions||{}),enabled:true,channelId,retainAuthor,entries:community.confessions?.entries||[]}}}); return message.reply(`Confessions enabled in <#${channelId}>.`); }
    return message.reply("Unknown community command.");
  }
};
