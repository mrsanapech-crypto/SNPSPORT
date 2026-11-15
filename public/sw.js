const CACHE_NAME = 'snp-sport-liquid-glass-v6';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/images/football_hero_stadium_players_1794738958032.jpg',
  '/images/player_striker_portrait_1794738958791.jpg',
  '/images/player_midfielder_portrait_1794738960309.jpg',
  '/images/player_winger_portrait_1794738960555.jpg',
];

let watchedMatches = [];
const swNotifiedIds = new Set();
let bgPollInterval = null;

function checkWatchedMatchesInBackground() {
  const nowMs = Date.now();
  for (const m of watchedMatches) {
    if (!m || !m.id) continue;

    // Check 2-minute pre-match kickoff window (0 < diff <= 120s)
    if (m.status === 'UPCOMING' && m.kickoffIso) {
      const kickoffMs = new Date(m.kickoffIso).getTime();
      if (!Number.isNaN(kickoffMs)) {
        const diffSec = Math.floor((kickoffMs - nowMs) / 1000);
        const alertId = `kickoff-2min-${m.id}`;
        if (diffSec > 0 && diffSec <= 120 && !swNotifiedIds.has(alertId)) {
          swNotifiedIds.add(alertId);
          const minsLeft = Math.max(1, Math.ceil(diffSec / 60));
          self.registration
            .showNotification(`⏰ ជិតដល់ម៉ោងប្រកួតហើយ! (${minsLeft} នាទីទៀត)`, {
              body: `${m.homeName} vs ${m.awayName} · ${m.leagueName} ចាប់ផ្តើមម៉ោង ${m.kickoffTime || 'ឆាប់ៗនេះ'}`,
              icon: m.homeLogo || '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: alertId,
              renotify: true,
              requireInteraction: true,
              vibrate: [220, 100, 220, 100, 300],
              data: { matchId: m.id, url: '/' },
            })
            .catch(() => {});
        }
      }
    }
  }
}

async function pollLiveEspnScoresInBackground() {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard'
    );
    if (!res.ok) return;
    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      const statusState = comp?.status?.type?.state;
      if (statusState !== 'in') continue;
      const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
      const home = competitors.find((c) => c.homeAway === 'home') || competitors[0];
      const away = competitors.find((c) => c.homeAway === 'away') || competitors[1];
      if (!home || !away) continue;

      const homeName = home?.team?.shortDisplayName || home?.team?.displayName || 'Home';
      const awayName = away?.team?.shortDisplayName || away?.team?.displayName || 'Away';
      const homeScore = Number(home?.score || 0);
      const awayScore = Number(away?.score || 0);
      const clock = comp?.status?.displayClock || "LIVE";

      const prev = watchedMatches.find(
        (wm) => wm.homeName === homeName || wm.awayName === awayName
      );
      if (prev && (homeScore > (prev.homeScore || 0) || awayScore > (prev.awayScore || 0))) {
        const scorerTeam = homeScore > (prev.homeScore || 0) ? homeName : awayName;
        const alertId = `goal-${ev.id}-${homeScore}-${awayScore}`;
        prev.homeScore = homeScore;
        prev.awayScore = awayScore;

        if (!swNotifiedIds.has(alertId)) {
          swNotifiedIds.add(alertId);
          self.registration
            .showNotification(`⚽ គ្រាប់បាល់ស៊ុតចូល! GOAL — ${scorerTeam}`, {
              body: `${homeName} ${homeScore} - ${awayScore} ${awayName} (${clock})`,
              icon: home?.team?.logo || '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: alertId,
              renotify: true,
              requireInteraction: true,
              vibrate: [250, 100, 250, 100, 350],
              data: { matchId: prev.id || ev.id, url: '/' },
            })
            .catch(() => {});
        }
      }
    }
  } catch {
    // ignore network errors in background worker
  }
}

function ensureBackgroundMonitor() {
  if (bgPollInterval) return;
  bgPollInterval = setInterval(() => {
    checkWatchedMatchesInBackground();
    pollLiveEspnScoresInBackground();
  }, 20000);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  ensureBackgroundMonitor();
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SYNC_WATCHED_MATCHES' && Array.isArray(data.matches)) {
    watchedMatches = data.matches;
    ensureBackgroundMonitor();
    checkWatchedMatchesInBackground();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetMatchId = event.notification?.data?.matchId || '';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_MATCH_CLICKED',
            matchId: targetMatchId,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept live stream video segments, API routes, Vite modules, or external ESPN/StreamFree calls
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@') ||
    url.hostname.includes('espn.com') ||
    url.hostname.includes('strmfree.') ||
    url.hostname.includes('streamfree.')
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
  );
});
