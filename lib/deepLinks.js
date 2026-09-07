// Deep link builders — these all work TODAY with no affiliate approval needed.
// Once you're approved as an affiliate (Agoda / Klook / Traveloka), add your
// tracking ID to the commented lines below to start earning commission.

// Agoda does NOT accept a plain city name through /search?city=... — it silently
// ignores the parameter and redirects to the homepage. The reliable pattern that
// DOES carry dates/guests through is its "city landing page" URL:
//   https://www.agoda.com/city/<slug>-th.html?checkIn=...&checkOut=...&rooms=...&adults=...
// We only know the slug for well-known Thai destinations, so we keep a small map
// for those and fall back to a Google search (which always carries the text +
// dates through) for anything else.
const AGODA_CITY_SLUGS = {
  'bangkok': 'bangkok-th',
  'กรุงเทพ': 'bangkok-th',
  'กรุงเทพฯ': 'bangkok-th',
  'chiang mai': 'chiang-mai-th',
  'เชียงใหม่': 'chiang-mai-th',
  'phuket': 'phuket-th',
  'ภูเก็ต': 'phuket-th',
  'pattaya': 'pattaya-th',
  'พัทยา': 'pattaya-th',
  'koh samui': 'koh-samui-th',
  'samui': 'koh-samui-th',
  'เกาะสมุย': 'koh-samui-th',
  'สมุย': 'koh-samui-th',
  'krabi': 'krabi-th',
  'กระบี่': 'krabi-th',
  'hua hin': 'hua-hin-th',
  'หัวหิน': 'hua-hin-th',
  'chonburi': 'chonburi-th',
  'ชลบุรี': 'chonburi-th',
  'khao yai': 'khao-yai-th',
  'เขาใหญ่': 'khao-yai-th',
  'hat yai': 'hat-yai-th',
  'หาดใหญ่': 'hat-yai-th',
  'rayong': 'rayong-th',
  'ระยอง': 'rayong-th',
};

function normalizeKey(text) {
  return (text || '').toString().trim().toLowerCase();
}

function buildDeepLink(intent) {
  switch (intent.category) {
    case 'hotel':
      return buildAgodaHotelLink(intent);
    case 'flight':
      return buildTravelokaFlightLink(intent);
    case 'tour':
      return buildKlookLink(intent);
    case 'restaurant':
      return buildWongnaiLink(intent);
    case 'fitness':
      return buildClassPassLink(intent);
    case 'event':
      return buildZipeventLink(intent);
    default:
      return 'https://www.google.com/search?q=' + encodeURIComponent(intent.destination || '');
  }
}

function buildGoogleSearchFallback({ label, destination, checkin, checkout, guests }) {
  const parts = [label, destination || ''];
  if (checkin) parts.push(`check-in ${checkin}`);
  if (checkout) parts.push(`check-out ${checkout}`);
  if (guests) parts.push(`${guests} guests`);
  return `https://www.google.com/search?q=${encodeURIComponent(parts.filter(Boolean).join(' '))}`;
}

function buildAgodaHotelLink({ destination, checkin, checkout, guests }) {
  const slug = AGODA_CITY_SLUGS[normalizeKey(destination)];

  if (slug) {
    const params = new URLSearchParams({
      checkIn: checkin || '',
      checkOut: checkout || '',
      rooms: '1',
      adults: String(guests || 2),
      // cid: 'YOUR_AGODA_AFFILIATE_ID', // เพิ่มทีหลังหลังสมัคร Agoda Affiliate
    });
    return `https://www.agoda.com/city/${slug}.html?${params.toString()}`;
  }

  // Unknown destination — Agoda's /search endpoint ignores plain text city names
  // and redirects to its homepage, silently dropping the dates/guests. A Google
  // search at least keeps the destination + dates visible to the user.
  return buildGoogleSearchFallback({
    label: 'hotels in',
    destination,
    checkin,
    checkout,
    guests,
  });
}

function buildTravelokaFlightLink({ destination, checkin, guests }) {
  // Traveloka's fullsearch needs an encoded "origin.destination.date..." token
  // (both airport codes), which this bot doesn't collect (no origin city is
  // ever asked) and can't reliably build from plain text. A Google search
  // with the same details at least gets the user real flight results.
  return buildGoogleSearchFallback({
    label: 'flights to',
    destination,
    checkin,
    guests,
  });
}

function buildKlookLink({ destination }) {
  // aid=YOUR_KLOOK_AFFILIATE_ID can be appended once approved via Involve Asia
  return `https://www.klook.com/en-US/search/result/?query=${encodeURIComponent(destination || '')}`;
}

function buildWongnaiLink({ destination, budget }) {
  // wongnai.com/search?q=... 404s — Wongnai has no plain query-string search
  // page. Search Google for Wongnai listings instead, which reliably works.
  const parts = ['ร้านอาหาร', destination || '', 'wongnai'];
  if (budget) parts.push(`งบ ${budget} บาท`);
  return `https://www.google.com/search?q=${encodeURIComponent(parts.filter(Boolean).join(' '))}`;
}

function buildClassPassLink({ destination }) {
  const city = (destination || 'thailand').toLowerCase().trim();
  return `https://classpass.com/search/${encodeURIComponent(city)}/fitness`;
}

function buildZipeventLink({ destination }) {
  return `https://www.zipeventapp.com/search?keyword=${encodeURIComponent(destination || '')}`;
}

module.exports = { buildDeepLink };
