// Crawler User-Agents that need OG metadata
const CRAWLER_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'WhatsApp',
  'LinkedInBot',
  'Pinterest',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
];

export const config = {
  matcher: '/shared/:path*',
};

export default function middleware(request: Request) {
  const userAgent = request.headers.get('user-agent') || '';
  const isCrawler = CRAWLER_USER_AGENTS.some(crawler =>
    userAgent.toLowerCase().includes(crawler.toLowerCase())
  );

  if (isCrawler) {
    // Rewrite to the OG metadata API route
    const url = new URL(request.url);
    const token = url.pathname.replace('/shared/', '');
    url.pathname = `/api/og/${token}`;
    return fetch(url.toString(), { headers: request.headers });
  }

  // For regular users, continue to the SPA (return undefined to continue)
  return;
}
