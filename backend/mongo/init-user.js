// Runs once on first container start with an empty volume.
// Creates a scoped app user with readWrite on gnosis_esoterica only.
db = db.getSiblingDB("gnosis_esoterica");

db.createUser({
  user: "gnosis_app",
  pwd: process.env.GNOSIS_APP_PASSWORD,
  roles: [{ role: "readWrite", db: "gnosis_esoterica" }],
});
