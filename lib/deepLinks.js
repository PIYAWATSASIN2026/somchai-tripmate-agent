// Deep link builders — these all work TODAY with no affiliate approval needed.
// Once you're approved as an affiliate (Agoda / Klook / Traveloka), add your
// tracking ID to the commented lines below to start earning commission.

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

function buildAgodaHotelLink({ destination, checkin, checkout, guests }) {
  const params = new URLSearchParams({
    city: destination || '',
    checkIn: checkin || '',
    checkOut: checkout || '',
    rooms: '1',
    adults: String(guests || 2),
    // cid: 'YOUR_AGODA_AFFILIATE_ID', // เพิ่มทีหลังหลังสมัคร Agoda Affiliate
  });
  return `https://www.agoda.com/search?${params.toString()}`;
}

function buildTravelokaFlightLink({ destination }) {
  return `https://www.traveloka.com/th-th/flight/fullsearch?ap=${encodeURIComponent(destination || '')}`;
}

function buildKlookLink({ destination }) {
  // aid=YOUR_KLOOK_AFFILIATE_ID can be appended once approved via Involve Asia
  return `https://www.klook.com/en-US/search/result/?query=${encodeURIComponent(destination || '')}`;
}

function buildWongnaiLink({ destination }) {
  return `https://www.wongnai.com/search?q=${encodeURIComponent(destination || 'ร้านอาหาร')}`;
}

function buildClassPassLink({ destination }) {
  const city = (destination || 'thailand').toLowerCase().trim();
  return `https://classpass.com/search/${encodeURIComponent(city)}/fitness`;
}

function buildZipeventLink({ destination }) {
  return `https://www.zipeventapp.com/search?keyword=${encodeURIComponent(destination || '')}`;
}

module.exports = { buildDeepLink };
