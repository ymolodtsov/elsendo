import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolve4, resolve6 } from 'dns/promises';
import { isIP } from 'net';

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  author?: string;
  siteName?: string;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Check if an IP is private/reserved
function isPrivateIP(ip: string): boolean {
  // IPv4 private/reserved ranges
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true;                              // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true;        // 192.168.0.0/16
    if (parts[0] === 127) return true;                             // 127.0.0.0/8
    if (parts[0] === 169 && parts[1] === 254) return true;        // 169.254.0.0/16
    if (parts[0] === 0) return true;                               // 0.0.0.0/8
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // 100.64.0.0/10
    if (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) return true;  // 198.18.0.0/15
  }

  // IPv6 private/reserved
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;  // ULA
  if (lower.startsWith('fe80')) return true;                           // Link-local
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — check the embedded IPv4
    return isPrivateIP(lower.replace('::ffff:', ''));
  }

  return false;
}

async function isBlockedUrl(urlString: string): Promise<boolean> {
  try {
    const parsed = new URL(urlString);

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return true;
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();

    // Block localhost variants
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return true;
    }

    // If hostname is already an IP, check it directly
    if (isIP(hostname)) {
      return isPrivateIP(hostname);
    }

    // Resolve DNS and check all resolved IPs
    try {
      const [ipv4s, ipv6s] = await Promise.allSettled([
        resolve4(hostname),
        resolve6(hostname),
      ]);

      const ips: string[] = [];
      if (ipv4s.status === 'fulfilled') ips.push(...ipv4s.value);
      if (ipv6s.status === 'fulfilled') ips.push(...ipv6s.value);

      if (ips.length === 0) return true; // Can't resolve — block it

      return ips.some(ip => isPrivateIP(ip));
    } catch {
      return true; // DNS resolution failed — block it
    }
  } catch {
    return true;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify user auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  // SSRF protection — resolves DNS to check actual IPs
  if (await isBlockedUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
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
  } catch {
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
