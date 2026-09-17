# Production MongoDB — Quick Access & Queries

How to get from the Mac into the MongoDB instance on the Pi in one command, and a set of
ready-made queries. Auth details are in [configure_db.md](./configure_db.md).

Nothing is exposed on the LAN (Mongo listens only on the Pi's loopback): you SSH to the Pi
and run `mongosh` **inside** the `gnosis-mongodb` container. Credentials are read from
`~/projects/gnosis-esoterica/.env.gnosis.prod` on the Pi — they never leave it.

## 1. One-time setup

### Deploy the helper script to the Pi

`scripts/pi-mongo.sh` works from both sides: run from the Mac it ssh's to
`pavlos-mk@pavspi.local` and executes the Pi copy at
`~/projects/gnosis-esoterica/scripts/pi-mongo.sh`; on the Pi it sources
`../.env.gnosis.prod`, builds the `gnosis_admin` URI and runs `mongosh` inside the container.

Copy your key once if not done: `ssh-copy-id pavlos-mk@pavspi.local`. Then deploy the Pi copy
(repeat whenever the script changes):
```bash
scp scripts/pi-mongo.sh pavlos-mk@pavspi.local:~/projects/gnosis-esoterica/scripts/
ssh pavlos-mk@pavspi.local chmod +x ~/projects/gnosis-esoterica/scripts/pi-mongo.sh
```

Optional shortcut in `~/.zshrc` so it works from any directory:
```bash
alias pimongo=~/projects/gnosis_application/backend/scripts/pi-mongo.sh
```

## 2. Daily workflow

All from the Mac, in the repo (or with the alias, from anywhere):

| Want | Run |
|---|---|
| Interactive shell (db = `gnosis_esoterica`) | `pimongo` |
| One expression | `pimongo 'db.users.countDocuments()'` |
| Multi-statement | `pimongo 'db.readings.find({}, {spread_type:1}).limit(3).toArray()'` |
| Run a local `.js` file | `pimongo --file q.js` (streamed over ssh, no scp) |
| Different db | `DB=admin pimongo 'db.getUsers()'` |
| Different host / path | `PI_HOST=user@host PI_DIR=~/other pimongo` |

Quoting rule: wrap the whole expression in single quotes; use double quotes inside it.

Exit the interactive shell with `exit` or Ctrl-D.

## 3. Sanity checks

```bash
pimongo 'db.runCommand({ping:1})'
pimongo 'db.getSiblingDB("admin").getUsers()'          # gnosis_admin
pimongo 'db.getUsers()'                                # gnosis_app
pimongo 'db.getCollectionNames()'
pimongo 'db.getCollection("_migrations").find().sort({version:1}).toArray()'
pimongo 'db.stats().dataSize'
```

## 4. Common queries

### Users
```js
db.users.countDocuments()
db.users.find({}, {email:1, is_superadmin:1, created_at:1}).sort({created_at:-1}).limit(10).toArray()
db.users.findOne({email: "someone@example.com"})
db.users.updateOne({email: "someone@example.com"}, {$set: {is_superadmin: true}})
```

### Readings / interpretations
```js
// user_id is stored as an ObjectId on readings/interpretations (but as a plain string
// on refresh_tokens) — a string literal here silently matches nothing.
db.readings.countDocuments({user_id: ObjectId("<user_id>")})
db.readings.find({}, {spread_type:1, created_at:1}).sort({created_at:-1}).limit(5).toArray()
db.interpretations.countDocuments()
```

### User usage by month
```js
db.interpretations.aggregate([
  {$group: {
    _id: {user_id: "$user_id", month: {$dateToString: {format: "%Y-%m", date: "$created_at"}}},
    prompt_tokens: {$sum: "$usage.prompt_tokens"},
    completion_tokens: {$sum: "$usage.completion_tokens"},
    cost_usd: {$sum: "$usage.cost_usd"},
    interpretations: {$sum: 1}
  }},
  {$sort: {"_id.month": -1, cost_usd: -1}}
]).toArray()
```

### Lifetime spend per user
```js
db.users.find({}, {email:1, "usage.cost_usd":1, "usage.readings":1}).sort({"usage.cost_usd":-1}).toArray()
```

### Indexes
```js
db.readings.getIndexes()
db.users.getIndexes()
```

## 5. GUI (Compass) — optional

`docker-compose.prod.yml` publishes Mongo on the Pi's loopback (`127.0.0.1:27017` — never
the LAN), so no override or manual tunnel setup is needed. Compass builds the SSH tunnel
itself; configure a connection once and reuse it:

- **General**: hostname `localhost`, port `27017`
- **Authentication**: Username/Password — `gnosis_admin`, password from `.env.gnosis.prod`
  on the Pi, authentication database `admin`
- **Proxy/SSH**: SSH with Identity File — hostname `pavspi.local`, port `22`,
  username `pavlos-mk`, your default key

For `mongosh` from the Mac instead, open a tunnel and connect through it:
```bash
ssh -N -L 27017:localhost:27017 pavlos-mk@pavspi.local        # keep open
mongosh "mongodb://gnosis_admin:<root-pw>@localhost:27017/gnosis_esoterica?authSource=admin"
```

## 6. Rules

- Read with `gnosis_admin`; never paste passwords into docs, commits or shell history on the Mac.
- Writes in prod: prefer a migration (`src/migrations/versions/`) over ad-hoc `updateOne`.
- Take a backup before any manual data change (see [configure_db.md §3](./configure_db.md)).
