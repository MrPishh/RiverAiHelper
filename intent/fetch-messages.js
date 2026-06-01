// Temporary script to fetch messages from a channel since a given date
require('dotenv').config();

const CHANNEL_ID = process.argv[2] || '1212717429319540790';
const SINCE_DATE = new Date('2026-05-09T00:00:00Z');

// Discord snowflake for a given date: ((ms - DISCORD_EPOCH) << 22n)
const DISCORD_EPOCH = 1420070400000n;
function dateToSnowflake(date) {
  const ms = BigInt(date.getTime());
  return ((ms - DISCORD_EPOCH) << 22n).toString();
}

async function fetchMessages() {
  const fetch = (await import('node-fetch')).default;
  const afterSnowflake = dateToSnowflake(SINCE_DATE);

  let allMessages = [];
  let after = afterSnowflake;
  let page = 0;

  while (true) {
    const url = `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=100&after=${after}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
    });

    if (!res.ok) {
      console.error(`HTTP ${res.status}: ${await res.text()}`);
      break;
    }

    const msgs = await res.json();
    if (!msgs.length) break;

    // API returns newest first when using after= — sort ascending
    msgs.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
    allMessages.push(...msgs);
    after = msgs[msgs.length - 1].id;
    page++;

    process.stderr.write(`Page ${page}: fetched ${msgs.length} messages (total ${allMessages.length})\n`);

    if (msgs.length < 100) break;
    await new Promise(r => setTimeout(r, 300));
  }

  // Filter bots out, keep human messages only
  const human = allMessages.filter(m => !m.author.bot);

  // Output compact JSON for classification
  const out = human.map(m => ({
    id: m.id,
    ts: m.timestamp,
    author: m.author.username,
    content: m.content.slice(0, 500),
    hasReply: !!(m.referenced_message || m.message_reference),
    attachments: m.attachments.length,
  }));

  console.log(JSON.stringify(out, null, 2));
  process.stderr.write(`\nTotal human messages: ${out.length}\n`);
}

fetchMessages().catch(console.error);
