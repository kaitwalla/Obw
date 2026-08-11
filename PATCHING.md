# Patching Functious

OBW is currently an overlay for the upstream Functious repository.

## 1. Guild schema

Add this field to `models/guilds.js`:

```js
community: {
  launchers: { type: Array, default: [] },
  conversations: { type: Array, default: [] },
  starboard: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    emoji: { type: String, default: "⭐" },
    threshold: { type: Number, default: 3 },
    includeNsfw: { type: Boolean, default: false },
    entries: { type: Array, default: [] },
  },
  confessions: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    retainAuthor: { type: Boolean, default: true },
    entries: { type: Array, default: [] },
  },
},
```

## 2. `events/messageCreate.js`

Add:

```js
const communityDm = require("../functions/communityDm");
```

Change the DM handling at the start to:

```js
if (!message?.channel || !message.content || message.author.bot) return;
const MVC = client.manageVC.get(message.author.id);
if (message.channel.type === 1 && MVC) return await manageVC(client, message);
if (message.channel.type === 1) {
  if (await communityDm(client, message)) return;
  return;
}
```

## 3. `events/messageReactionAdd.js`

Add:

```js
const communityHandler = require("../reactionHandlers/community");
```

Immediately before the final call to `roleReactionHandler`, add:

```js
const guildId = reaction.reaction?.guildId || reaction.guildId || reactionMsg.guildId;
const guildDb = guildId ? await client.database.getGuild(guildId, true) : null;
if (guildDb && await communityHandler(client, reaction, reactionMsg, guildDb)) return;
```

## 4. `events/channelDelete.js`

Before the final closing brace, add cleanup for OBW state:

```js
if (db.community) {
  const launchers = (db.community.launchers || []).filter(x => x.channelId !== channel.id);
  const conversations = (db.community.conversations || []).filter(x => x.channelId !== channel.id);
  const starboard = db.community.starboard?.channelId === channel.id
    ? { ...db.community.starboard, enabled: false, channelId: null }
    : db.community.starboard;
  const confessions = db.community.confessions?.channelId === channel.id
    ? { ...db.community.confessions, enabled: false, channelId: null }
    : db.community.confessions;

  await client.database.updateGuild(guildId, {
    community: { ...db.community, launchers, conversations, starboard, confessions }
  });
}
```

## Staging caveats

Verify against the current `@fluxerjs/core` version before production:

- permission names `ViewChannel`, `ReadMessageHistory`, `SendMessages`
- reaction count exposure
- category placement and permission overwrite behavior
- DM channel type
- message editing for starboard entries
