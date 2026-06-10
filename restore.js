const https = require('https');

const PROJECT = 'espace-gaming-codm';
const CAT_ID = 'CgONUMotKsoMyz9Uj2mU';
const CLAN_LP_ID = '590b519d-3090-4dfa-9542-5303dc0a2da2';

const CLAN_LP = {
  characterImage: 'https://res.cloudinary.com/djdogxq0d/image/upload/v1781055423/awards/nominees/eugmjyetwpli5rno4ilw.png',
  characterName: 'Logo La PiRATERi',
  description: null,
  highlightClipUrl: null,
  id: CLAN_LP_ID,
  playerName: 'La PiRATERi',
  statsValues: null,
  teamName: 'LP',
  teamTag: 'LP',
  votes: 0,
};

function http(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: {}, timeout: 20000,
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', function () { this.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  return { stringValue: String(v) };
}

async function main() {
  const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/awardsCategories/${CAT_ID}`;
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`;

  const res = await http(docUrl);
  if (res.status !== 200) {
    console.log(`Erreur GET: ${res.status}`);
    process.exit(1);
  }

  const doc = JSON.parse(res.body);
  const nominees = doc.fields?.nominees?.arrayValue?.values || [];

  const isPresent = nominees.some(n => {
    const f = n.mapValue?.fields;
    return f?.id?.stringValue === CLAN_LP_ID || f?.playerName?.stringValue === 'La PiRATERi';
  });

  if (isPresent) {
    console.log(`OK - La PiRATERi présent (${nominees.length} nommés)`);
    return;
  }

  console.log('ALERTE - La PiRATERi supprimé ! Restauration...');

  const existing = nominees.map(n => {
    const f = n.mapValue.fields;
    return {
      characterImage: f.characterImage?.stringValue || '',
      characterName: f.characterName?.stringValue || '',
      description: null, highlightClipUrl: null,
      id: f.id?.stringValue || '',
      playerName: f.playerName?.stringValue || '', statsValues: null,
      teamName: f.teamName?.stringValue || '', teamTag: f.teamTag?.stringValue || '',
      votes: parseInt(f.votes?.integerValue || '0'),
    };
  });
  existing.push(CLAN_LP);

  const commitBody = JSON.stringify({
    writes: [{
      update: {
        name: `projects/${PROJECT}/databases/(default)/documents/awardsCategories/${CAT_ID}`,
        fields: {
          nominees: {
            arrayValue: {
              values: existing.map(item => ({
                mapValue: {
                  fields: Object.fromEntries(
                    Object.entries(item).map(([k, v]) => [k, toFirestoreValue(v)])
                  ),
                },
              })),
            },
          },
        },
      },
      updateMask: { fieldPaths: ['nominees'] },
    }],
  });

  const r2 = await http(commitUrl, 'POST', commitBody);
  if (r2.status === 200) {
    console.log(`RESTAURÉ - La PiRATERi ré-ajouté (${existing.length} nommés)`);
  } else {
    console.log(`Erreur RESTAURATION: ${r2.status} - ${r2.body.slice(0, 200)}`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error(`ERREUR: ${e.message}`);
  process.exit(1);
});
