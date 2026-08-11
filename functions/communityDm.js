const { EmbedBuilder } = require("@fluxerjs/core");
module.exports = async function communityDm(client,message){
 const text=String(message.content||"").trim(); if(!/^confess(?:\s|$)/i.test(text))return false;
 const body=text.replace(/^confess\s*/i,"").trim(); if(!body){await message.channel.send("Usage: `confess <your message>`").catch(()=>{});return true;}
 const guilds=await client.database.getAll(); const enabled=guilds.filter(g=>g.community?.confessions?.enabled&&g.community?.confessions?.channelId); if(!enabled.length){await message.channel.send("No server connected to this bot has anonymous confessions enabled.").catch(()=>{});return true;}
 let target=enabled[0], confession=body; if(enabled.length>1){const first=body.split(/\s+/)[0], byId=enabled.find(g=>g.id===first); if(!byId){await message.channel.send("This bot serves multiple servers. Use `confess <serverId> <message>`.").catch(()=>{});return true;} target=byId; confession=body.slice(first.length).trim();}
 const cfg=target.community.confessions, channel=await client.channels.fetch(cfg.channelId).catch(()=>null); if(!channel){await message.channel.send("The confession channel is unavailable.").catch(()=>{});return true;}
 const posted=await channel.send({embeds:[new EmbedBuilder().setColor("#A52F05").setTitle("🕵️ Anonymous confession").setDescription(confession)]});
 if(cfg.retainAuthor){const entries=[...(cfg.entries||[]),{messageId:posted.id,authorId:message.author.id,createdAt:Date.now()}].slice(-5000); await client.database.updateGuild(target.id,{community:{...target.community,confessions:{...cfg,entries}}});}
 await message.channel.send("Confession posted.").catch(()=>{}); return true;
};
