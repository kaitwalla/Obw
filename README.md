# OBW

OBW is a self-hostable Fluxer community bot built on top of the open-source Functious codebase.

It adds the community workflows needed for a Discord → Fluxer migration without modifying Fluxer itself:

- 🧵 bot-managed text conversations as a practical thread/forum replacement
- 🎫 private support tickets using per-member and per-role channel permissions
- ⭐ starboard / quote collection
- 🕵️ anonymous confessions by DM
- 🎭 Functious reaction roles and autoroles
- 🏗️ one-command recreation of the server structure, roles, access gates, and role panels

Functious's built-in `tempchannels` feature is voice-only. OBW adds a separate managed **text-channel** abstraction.

## Quick start

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

The Docker build checks out the pinned upstream Functious revision and applies OBW automatically.

## Recreate the server

Invite OBW to the target Fluxer community with permission to manage channels, roles, messages, and reactions. Then, from a channel where you can run bot commands:

```text
f!provision
```

This shows a dry-run summary. To actually build the server:

```text
f!provision apply confirm
```

The provisioner is idempotent. It reuses matching roles/categories/channels by name and records the reaction-role and launcher message IDs it creates, so rerunning it should repair missing pieces rather than generate `general-2-final-FINAL`.

It provisions:

- `starboard`
- Ticket Desk / Intros / General / Hangouts / Voice / NSFW / Games categories
- the full channel list from the migration screenshots
- color, age, DM status, pronoun, relationship, timezone, ping, channel-access, event, gaming, and affiliation roles
- exclusive role panels where only one choice should be active
- multi-select role panels for pings/access/timezones
- NSFW gating via **NSFW Kink Channel Access** for the whole NSFW section
- Bot Games gating for the Games section
- Dyke Digest channel gating
- read-only `rules`, `gen-announcements`, `roles`, and `support-tickets` posting behavior
- ⭐ starboard threshold of 3
- 🎫 private support-ticket launcher
- 📖 book-club managed discussions
- 📝 writing managed discussions
- anonymous confessions routed to `anon-confessions`

### Staff roles

OBW deliberately does **not** create or grant privileged `Moderator` or `Admin` roles. If roles with those names already exist, the ticket provisioner grants them ticket access. This avoids a provisioning command accidentally minting a new privileged role.

The entire layout is declared in [`blueprints/server.js`](blueprints/server.js), so the recreation can be edited as data rather than by rewriting the provisioner.

## Managed conversations

A user reacting to a launcher receives an ordinary Fluxer text channel managed by OBW.

Examples:

```text
book-kait-001
ticket-kait-004
writing-kait-006
```

Inside a managed conversation:

```text
f!community rename project-hail-mary-spoilers
f!community close
```

Inside private tickets:

```text
f!community add @OtherUser
```

## Manual community configuration

The lower-level commands remain available if you want to change individual pieces without rerunning the blueprint.

### Starboard

```text
f!community starboard STARBOARD_CHANNEL_ID 3 ⭐
```

### Add a launcher

```text
f!community launcher add book 📖 CHANNEL_ID CATEGORY_ID public book 3
f!community launcher panel book
```

Private ticket example:

```text
f!community launcher add ticket 🎫 SUPPORT_CHANNEL_ID TICKET_CATEGORY_ID private ticket 1 MOD_ROLE_ID,ADMIN_ROLE_ID
f!community launcher panel ticket
```

### Anonymous confessions

```text
f!community confessions CONFESSIONS_CHANNEL_ID true
```

Users DM OBW:

```text
confess I still don't understand what rizz means.
```

With author retention enabled, OBW privately stores a message → author mapping for moderation. Use `false` instead of `true` if you do not want the source user ID retained.

## Server blueprint highlights

The role menu uses Unicode stand-ins for the custom Discord emoji so it can be recreated immediately on Fluxer. For example:

```text
🎨 Color: 🔴 Red, 🟠 Orange, 🟡 Yellow, 🔵 Blue, ...
🎂 Age: 🐣 22–25, 🐥 26–30, 🐤 31–35, 🍗 36–40, 🍽️ 41+
💌 DMs: 😸 Open, 🦉 Ask, 🙀 Closed
🚪 Access: ⛓️ NSFW Kink, 🌿 420 Friendly, 🤖 Bot Games, 🐸 Dyke Digest, 🗳️ Current Events / Politics
```

Those emoji can later be swapped for Fluxer custom emoji while keeping the same role architecture.

## Why the upstream revision is pinned

OBW currently builds against Functious commit:

```text
5672a5bc7dc361df8e85b01e0aca515da821099d
```

This is intentional. The patcher fails the Docker build if upstream source structure changes unexpectedly instead of silently producing a broken bot.

## Deployment architecture

```text
Docker Compose
├── obw
│   ├── pinned Functious source
│   ├── OBW overlay
│   └── server blueprint + provisioner
└── mongo
    └── persistent volume: obw-mongo
```

## Updating

```bash
git pull
docker compose up -d --build
```

For direct development against a Functious checkout, see [`PATCHING.md`](PATCHING.md).

## Staging checklist

Before using OBW on the production community, run the provisioner on a throwaway Fluxer server and verify:

- category/channel ordering
- NSFW, Games, and Dyke Digest visibility
- private ticket visibility and moderator overrides
- role-panel add/remove behavior and exclusive groups
- starboard reaction counts and edits
- managed discussion creation/closing
- anonymous confession DMs
- rerunning `f!provision apply confirm` does not duplicate objects

## Roadmap

- ticket transcripts
- archive categories and inactivity cleanup
- `community reopen`
- per-launcher retention rules
- NSFW-aware starboard filtering
- moderator confession-author lookup when retention is enabled
- stronger provisioning reconciliation and automated permission tests

## Upstream and licensing

OBW is based on [Functious](https://github.com/forgetfulskybro/Fluxer-Functious), released under GNU AGPL-3.0. OBW is intended to be distributed and operated under the same terms. See [`NOTICE.md`](NOTICE.md) for attribution and source details.
