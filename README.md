# ali_from_js
needs mongodb, node, npm, etc.

needs some special folders for storage too so just run
`mkdir db tmp` (linux)

run `npm install discord.js mongoose canvas diff` to install dependencies.

expects a `config.json` in the top directory with the following contents:
```json
{
  "token": "blablablablablablabla",
  "clientId": "123456789",
  "ownerId": "123456789",
  "guildId": "123456789",
  "mongoURI": "mongodb:address"
}
```
