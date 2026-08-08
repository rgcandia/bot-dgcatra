import https from 'https';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/home/tic/proyectos/bot-dgcatra/cliente/public/sounds';

async function fetchWithRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const doFetch = (u, redirects) => {
      https.get(u, { headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://pixabay.com/'
      }}, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          const nextUrl = res.headers.location.startsWith('http') ? res.headers.location :
            new URL(res.headers.location, u).href;
          doFetch(nextUrl, redirects - 1);
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }).on('error', reject);
    };
    doFetch(url, maxRedirects);
  });
}

async function downloadToFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const doFetch = (u) => {
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://pixabay.com/' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doFetch(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).href);
          return;
        }
        const file = fs.createWriteStream(filepath);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      }).on('error', reject);
    };
    doFetch(url);
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// Try to find via pixabay internal search API
const searchQueries = [
  'new notification 036',
  'new notification 051',
];

for (const query of searchQueries) {
  console.log(`\n--- Query: ${query} ---`);

  // Try various API endpoints
  const endpoints = [
    `https://pixabay.com/sound-effects/search/${encodeURIComponent(query)}/`,
    `https://pixabay.com/sound-effects/search/?q=${encodeURIComponent(query)}`,
    `https://pixabay.com/sound-effects/?q=${encodeURIComponent(query)}`,
  ];

  for (const endpoint of endpoints) {
    console.log(`  Trying: ${endpoint}`);
    const result = await fetchWithRedirects(endpoint);
    const mp3Matches = result.body.match(/https:\/\/cdn\.pixabay\.com\/audio\/[^"'\s<>]+\.mp3/g);
    const downloadMatches = result.body.match(/href="\/sound-effects\/download\/[^"]*"/g);
    const searchResults = result.body.match(/"id":\s*\d+[^}]{0,200}"audio_url"[^}]+/g);
    const anyUrl = result.body.match(/https?:\/\/[^"'\s<>]+\.(mp3|ogg|wav)/gi);

    console.log(`    Status: ${result.status}, Size: ${result.body.length}`);
    if (mp3Matches) console.log(`    MP3s: ${mp3Matches.slice(0, 3)}`);
    if (downloadMatches) console.log(`    Downloads: ${downloadMatches.slice(0, 3)}`);
    if (searchResults) console.log(`    Search results: ${searchResults.slice(0, 2).map(s => s.substring(0, 150))}`);
    if (anyUrl) console.log(`    Any audio: ${anyUrl.slice(0, 3)}`);

    if (mp3Matches && mp3Matches.length > 0) {
      const name = query.includes('036') ? 'ticket-creado' : 'ticket-asignado';
      const outPath = path.join(OUT_DIR, `${name}.mp3`);
      await downloadToFile(mp3Matches[0], outPath);
      console.log(`    Downloaded: ${outPath}`);
      break;
    }
  }
}

console.log('\nDone!');
