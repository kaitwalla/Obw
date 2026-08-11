# OBW

OBW is a self-hostable Fluxer community bot built on top of the open-source Functious codebase.

It adds the community workflows we needed for a Discord → Fluxer migration without modifying Fluxer itself:

- 🧵 bot-managed text conversations as a practical thread/forum replacement
- 🎫 private support tickets using per-member and per-role channel permissions
- ⭐ starboard / quote collection
- 🕵️ anonymous confessions by DM
- 🎭 Functious's existing reaction-role, autorole, poll, schedule, and utility features

Functious's built-in `tempchannels` feature is voice-only. OBW adds a separate managed **text-channel** abstraction.

## Quick start

You only need Docker and a Fluxer bot token.

```bash
git clone https://github.com/kaitwalla/Obw.git
cd Obw
cp .env.example .env
```

Put your Fluxer bot token in `.env`:

```dotenv
TOKEN=your_fluxer_bot_token
```

Then start OBW and its bundled MongoDB:

```bash
docker compose up -d --build
```

View logs with:

```bash
docker compose logs -f obw
```

The Docker build automatically checks out the pinned upstream Functious revision and applies the OBW source overlay. There is no manual patching step.

## Why the upstream revision is pinned

OBW currently builds against Functious commit:

```text
5672a5bc7dc361df8e85b01e0aca515da821099d
```

This is intentional. The patcher fails the Docker build if upstream source structure changes unexpectedly instead of silently producing a broken bot.

To test a newer Functious revision, change `FUNCTIOUS_REF` in `.env` and rebuild.

## Initial setup

OBW keeps Functious's default `f!` prefix.

### Starboard

```text
f!community starboard STARBOARD_CHANNEL_ID 3 ⭐
```

A message reaching the configured star threshold is copied to the starboard. Existing entries are updated instead of duplicated.

### Book-club discussions

```text
f!community launcher add book 📖 BOOK_CLUB_CHANNEL_ID BOOK_DISCUSSIONS_CATEGORY_ID public book 3
```

Then run this **inside the book-club launcher channel**:

```text
f!community launcher panel book
```

A user reacting 📖 gets a managed text channel such as:

```text
book-kait-001
```

Inside a managed conversation:

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

Generated ticket channels are hidden from the default role and explicitly granted to:

- the ticket opener
- configured moderator/admin roles
- the bot itself through its normal guild permissions

Inside a ticket:

```text
f!community add @OtherUser
f!community close
```

### Anonymous confessions

```text
f!community confessions CONFESSIONS_CHANNEL_ID true
```

Users DM OBW:

```text
confess I still don't understand what rizz means.
```

With author retention enabled, OBW privately stores a message → author mapping for moderation. It is not shown in the public confession.

Use `false` instead of `true` if you do not want the source user ID retained.

## Reaction roles

OBW intentionally reuses stock Functious reaction roles instead of growing a second role system.

Use **exclusive** panels for:

- color
- age
- DM status
- pronouns
- relationship status
- affiliation

Use regular multi-select panels for:

- timezone
- notification roles
- channel-access roles
- event pings
- gaming roles

## Recommended managed channels for the migration

| Launcher | Emoji | Visibility |
|---|---|---|
| `book-club` | 📖 | public |
| `ink-stained-wretches` | 📝 | public |
| `support-tickets` | 🎫 | private, max 1/user |

Possible later additions include `help-me-adult` and `ugh-vent-here`.

Normal high-volume channels such as chat, memes, selfies, music, and photos should remain ordinary Fluxer channels.

## Deployment architecture

```text
Docker Compose
├── obw
│   ├── pinned Functious source
│   └── OBW overlay + automatic source patching
└── mongo
    └── persistent volume: obw-mongo
```

The application image is assembled entirely from public source. The build process is reproducible and does not require a prebuilt private image.

## Updating

```bash
git pull
docker compose up -d --build
```

OBW's source patcher is deliberately strict. If a future Functious revision changes the files we patch, the image build should stop with an error so the integration can be reviewed.

## Manual / development integration

If you're developing directly against a Functious checkout instead of Docker, see [`PATCHING.md`](PATCHING.md).

## Current staging checklist

Before relying on OBW for a production community, verify on a test Fluxer guild:

- private ticket visibility and staff overrides
- the installed `@fluxerjs/core` permission names
- category placement for generated text channels
- starboard reaction counts and message edits
- bot DMs and confession routing
- reaction-role exclusivity for single-choice role panels

## Roadmap

- ticket transcripts
- archive categories and inactivity cleanup
- `community reopen`
- per-launcher retention rules
- NSFW-aware starboard filtering
- moderator confession-author lookup when retention is enabled
- automated permission tests

## Upstream and licensing

OBW is based on [Functious](https://github.com/forgetfulskybro/Fluxer-Functious), which is released under the GNU Affero General Public License v3.0. OBW is intended to be distributed and operated under the same AGPL-3.0 terms. See [`NOTICE.md`](NOTICE.md) for attribution and source details.
