// api/highlights.js — YouTube highlights search for live matches
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const home = url.searchParams.get('home');
  const away = url.searchParams.get('away');

  if (!home || !away) {
    return new Response(JSON.stringify({ error: 'Missing teams' }), { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key' }), { status: 500 });
  }

  // Search for match highlights
  const query = `${home} vs ${away} 2026 World Cup goals highlights`;
  const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=relevance&maxResults=10&videoEmbeddable=true&key=${apiKey}`;

  try {
    const res = await fetch(ytUrl);
    const data = await res.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), { status: 500 });
    }

    // Filter out FIFA official channel (UCpcTrCXblq78GZrTUTLWeBw) — they block embedding
    const BLOCKED_CHANNELS = ['UCpcTrCXblq78GZrTUTLWeBw', 'UCSb6IXMs4TEncyKLmBLEChw'];
    const candidates = (data.items || [])
      .filter(item => !BLOCKED_CHANNELS.includes(item.snippet.channelId))
      .slice(0, 8);

    // Verify embeddability via Videos API
    const ids = candidates.map(i => i.id.videoId).join(',');
    const verifyUrl = `https://www.googleapis.com/youtube/v3/videos?part=status&id=${ids}&key=${apiKey}`;
    const verifyRes = await fetch(verifyUrl);
    const verifyData = await verifyRes.json();
    const embeddableIds = new Set(
      (verifyData.items || [])
        .filter(v => v.status?.embeddable)
        .map(v => v.id)
    );

    const videos = candidates
      .filter(item => embeddableIds.has(item.id.videoId))
      .slice(0, 5)
      .map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url,
        published: item.snippet.publishedAt,
      }));

    return new Response(JSON.stringify({ videos }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
