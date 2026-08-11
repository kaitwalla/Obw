const { EmbedBuilder } = require("@fluxerjs/core");
const { createConversation } = require("../functions/community");
const emojiString=r=>r.emoji?.id?`<:${r.emoji?.name}:${r.emoji.id}>`:r.emoji?.name;
module.exports=async function(client,reaction,reactionMsg,db){
 const emote=emojiString(reaction), cfg=db.community?.starboard;
 if(cfg?.enabled&&cfg.channelId&&emote===(cfg.emoji||"⭐")&&reaction.channelId!==cfg.channelId){
  const count=Number(reaction.count||0); if(count<Number(cfg.threshold||3))return true;
  const entries=cfg.entries||[], existing=entries.find(e=>e.sourceMessageId===reaction.messageId), starboard=await client.channels.fetch(cfg.channelId).catch(()=>null); if(!starboard)return true;
  const guildId=reaction.reaction?.guildId||reaction.guildId||reactionMsg.guildId, jump=`https://fluxer.app/channels/${guildId}/${reaction.channelId}/${reaction.messageId}`;
  const embed=new EmbedBuilder().setColor("#F2C94C").setTitle(`${emote} ${count} • quoted message`).setDescription(`${reactionMsg.author?.id?`<@${reactionMsg.author.id}>\n\n`:""}${reactionMsg.content||"(attachment-only message)"}\n\n[Original message](${jump})`);
  const attachments=reactionMsg.attachments?.values?[...reactionMsg.attachments.values()]:Array.isArray(reactionMsg.attachments)?reactionMsg.attachments:[]; if(attachments[0]?.url)embed.setImage(attachments[0].url);
  if(existing){const old=await starboard.messages.fetch(existing.starboardMessageId).catch(()=>null); if(old)await old.edit({embeds:[embed]}).catch(()=>{}); return true;}
  const posted=await starboard.send({embeds:[embed]}); await client.database.updateGuild(db.id,{community:{...db.community,starboard:{...cfg,entries:[...entries,{sourceMessageId:reaction.messageId,sourceChannelId:reaction.channelId,starboardMessageId:posted.id,createdAt:Date.now()}]}}}); return true;
 }
 const launcher=(db.community?.launchers||[]).find(x=>x.messageId===reaction.messageId&&x.channelId===reaction.channelId&&x.emoji===emote); if(!launcher)return false;
 const guildId=reaction.reaction?.guildId||reaction.guildId||reactionMsg.guildId, guild=client.guilds.get(guildId)||await client.guilds.fetch(guildId), result=await createConversation(client,guild,db,launcher,reaction.user.id), dm=await reaction.user.createDM().catch(()=>null); if(dm)await dm.send(result.error||`Created <#${result.channel.id}>.`).catch(()=>{}); return true;
};
