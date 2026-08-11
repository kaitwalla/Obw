# OBW

A community-management extension for the self-hosted Fluxer bot Functious.

OBW adds the pieces needed to recreate Discord-style community workflows on Fluxer without modifying Fluxer itself:

- 🧵 Bot-managed text conversations as a practical thread/forum replacement
- 🎫 Private support tickets using channel permission overwrites
- ⭐ Starboard / quote collection
- 🕵️ Anonymous confessions by DM
- 🎭 Uses Functious's existing reaction-role system for self-assignable roles

## Status

Early implementation. Test on a staging Fluxer community before production use.

Functious's existing `tempchannels` feature is voice-only. OBW adds a separate managed **text-channel** abstraction.

## Installation

OBW is currently distributed as an overlay for `forgetfulskybro/Fluxer-Functious`.

Copy the files in this repository over a current Functious checkout, then apply the two documented event-handler snippets.

No additional npm dependencies are required.

## Examples

### Starboard

```text
f!community starboard STARBOARD_CHANNEL_ID 3 ⭐
```

### Book-club discussions

```text
f!community launcher add book 📖 BOOK_CLUB_CHANNEL_ID BOOK_DISCUSSIONS_CATEGORY_ID public book 3
f!community launcher panel book
```

Users react 📖 and receive a managed text channel such as `book-kait-001`.

Inside it:

```text
f!community rename project-hail-mary-spoilers
f!community close
```

### Writing discussions

```text
f!community launcher add writing 📝 WRITING_LOBBY_ID WRITING_DISCUSSIONS_CATEGORY_ID public writing 5
f!community launcher panel writing
```

### Private support tickets

```text
f!community launcher add ticket 🎫 SUPPORT_TICKETS_CHANNEL_ID TICKET_DESK_CATEGORY_ID private ticket 1 MOD_ROLE_ID,ADMIN_ROLE_ID
f!community launcher panel ticket
```

Only the opener, configured staff roles, and the bot should be able to access generated ticket channels.

Inside a ticket:

```text
f!community add @OtherUser
f!community close
```

### Anonymous confessions

```text
f!community confessions CONFESSIONS_CHANNEL_ID true
```

Users then DM the bot:

```text
confess I still don't understand what rizz means.
```

When author retention is enabled, OBW privately stores a message → author mapping for moderation purposes. It does not expose the author publicly.

## Reaction roles

Use stock Functious reaction roles.

Use **exclusive** panels for color, age, DM status, pronouns, relationship status, and affiliation.

Use normal multi-select panels for timezone, notification roles, channel-access roles, event pings, and gaming roles.

## Recommended managed conversations

| Launcher | Emoji | Visibility |
|---|---|---|
| `book-club` | 📖 | Public |
| `ink-stained-wretches` | 📝 | Public |
| `support-tickets` | 🎫 | Private |

Potential additional launchers include `help-me-adult` and `ugh-vent-here`.

## Before production

The implementation should be staging-tested against the currently installed `@fluxerjs/core`, particularly permission names, reaction count behavior, DM channel types, category placement, and message edits.

Planned hardening includes archive categories, inactivity cleanup, ticket transcripts, reopen controls, NSFW-aware starboard filtering, confession moderation lookup, and automated permission tests.
