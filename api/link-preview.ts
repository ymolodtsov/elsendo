import type { VercelRequest, VercelResponse } from '@vercel/node';

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  author?: string;
  siteName?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Elsendo/1.0; +https://elsendo.com)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return res.status(404).json({ error: 'Could not fetch URL' });
    }

    const html = await response.text();
    const preview = parseMetaTags(html, url);

    // Cache for 1 hour
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(preview);
  } catch (error) {
    console.error('Error fetching link preview:', error);
    return res.status(500).json({ error: 'Failed to fetch preview' });
  }
}

function parseMetaTags(html: string, url: string): LinkPreview {
  const getMetaContent = (property: string): string | undefined => {
    // Try og: prefix first
    const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'));
    if (ogMatch) return ogMatch[1];

    // Try twitter: prefix
    const twitterMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${property}["']`, 'i'));
    if (twitterMatch) return twitterMatch[1];

    // Try regular meta name
    const nameMatch = html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, 'i'));
    if (nameMatch) return nameMatch[1];

    return undefined;
  };

  const getTitle = (): string | undefined => {
    const ogTitle = getMetaContent('title');
    if (ogTitle) return ogTitle;

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : undefined;
  };

  const resolveUrl = (src: string | undefined): string | undefined => {
    if (!src) return undefined;
    if (src.startsWith('http')) return src;
    if (src.startsWith('//')) return 'https:' + src;
    try {
      return new URL(src, url).href;
    } catch {
      return undefined;
    }
  };

  return {
    url,
    title: getTitle(),
    description: getMetaContent('description'),
    image: resolveUrl(getMetaContent('image')),
    author: getMetaContent('author'),
    siteName: getMetaContent('site_name'),
  };
}
