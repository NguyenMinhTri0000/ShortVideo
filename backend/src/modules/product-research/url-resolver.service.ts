import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface ResolvedUrlResult {
  originalUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  platform: string;
  urlType: 'direct_product_url' | 'affiliate_short_link' | 'generic_url';
  redirectHops: number;
  redirectChain: string[];
  shopeeIds?: {
    shopId: string;
    itemId: string;
  };
}

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254',
];

const BLOCKED_IP_PREFIXES = [
  '10.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
  '0.',
];

const MAX_REDIRECTS_DEFAULT = 10;
const FETCH_TIMEOUT_MS_DEFAULT = 10_000;

@Injectable()
export class UrlResolverService {
  private readonly logger = new Logger(UrlResolverService.name);

  /**
   * Main entrypoint to resolve and normalize product URLs.
   */
  async resolveAndNormalizeUrl(
    inputUrl: string,
    options?: { maxRedirects?: number; timeoutMs?: number },
  ): Promise<ResolvedUrlResult> {
    if (!inputUrl || typeof inputUrl !== 'string' || !inputUrl.trim()) {
      throw new BadRequestException('Vui lòng cung cấp URL sản phẩm hợp lệ');
    }

    const cleanedInput = inputUrl.trim();
    this.validateUrlSyntaxAndSecurity(cleanedInput);

    const safeInputLog = this.redactSensitiveParams(cleanedInput);
    this.logger.log(`[ProductResearch] Input URL: ${safeInputLog}`);

    const initialPlatformInfo = this.detectPlatform(cleanedInput);
    const urlType: 'direct_product_url' | 'affiliate_short_link' | 'generic_url' =
      initialPlatformInfo.isShortLink
        ? 'affiliate_short_link'
        : initialPlatformInfo.platform !== 'generic'
          ? 'direct_product_url'
          : 'generic_url';

    this.logger.log(`[ProductResearch] Detected platform: ${initialPlatformInfo.platform}`);
    this.logger.log(`[ProductResearch] URL type: ${urlType}`);

    let resolvedFinalUrl = cleanedInput;
    let redirectHops = 0;
    let redirectChain: string[] = [cleanedInput];

    // Always attempt redirect resolution if short link or if shopee url requires follow
    if (initialPlatformInfo.isShortLink || initialPlatformInfo.platform === 'shopee') {
      this.logger.log(`[ProductResearch] Resolving URL...`);
      const res = await this.resolveRedirects(
        cleanedInput,
        options?.maxRedirects ?? MAX_REDIRECTS_DEFAULT,
        options?.timeoutMs ?? FETCH_TIMEOUT_MS_DEFAULT,
      );
      resolvedFinalUrl = res.finalUrl;
      redirectHops = res.hops;
      redirectChain = res.redirectChain;

      const safeFinalLog = this.redactSensitiveParams(resolvedFinalUrl);
      this.logger.log(`[ProductResearch] Redirect hops: ${redirectHops}`);
      this.logger.log(`[ProductResearch] Final URL: ${safeFinalLog}`);
    }

    // Re-detect platform on final URL in case short link redirected across platforms
    const finalPlatformInfo = this.detectPlatform(resolvedFinalUrl);
    const platform = finalPlatformInfo.platform;

    let canonicalUrl = resolvedFinalUrl;
    let shopeeIds: { shopId: string; itemId: string } | undefined;

    if (platform === 'shopee') {
      const extracted = this.extractShopeeIds(resolvedFinalUrl);
      if (extracted) {
        shopeeIds = { shopId: extracted.shopId, itemId: extracted.itemId };
        canonicalUrl = extracted.canonicalUrl;
        this.logger.log(`[ProductResearch] Extracted shopId: ${shopeeIds.shopId}`);
        this.logger.log(`[ProductResearch] Extracted itemId: ${shopeeIds.itemId}`);
        this.logger.log(`[ProductResearch] Canonical URL: ${this.redactSensitiveParams(canonicalUrl)}`);
      } else if (initialPlatformInfo.isShortLink) {
        throw new BadRequestException(
          'The Shopee link was resolved successfully, but it does not point to a supported product page.',
        );
      }
    }

    return {
      originalUrl: cleanedInput,
      finalUrl: resolvedFinalUrl,
      canonicalUrl,
      platform,
      urlType,
      redirectHops,
      redirectChain,
      shopeeIds,
    };
  }

  /**
   * Safe HTTP Redirect Resolver with max hops, loop detection, timeout, and SSRF validation.
   */
  async resolveRedirects(
    startUrl: string,
    maxRedirects = MAX_REDIRECTS_DEFAULT,
    timeoutMs = FETCH_TIMEOUT_MS_DEFAULT,
  ): Promise<{ finalUrl: string; hops: number; redirectChain: string[] }> {
    let currentUrl = startUrl;
    let hops = 0;
    const visited = new Set<string>([startUrl]);
    const redirectChain: string[] = [startUrl];
    let cookiesToPass: string[] = [];

    while (hops < maxRedirects) {
      this.validateUrlSyntaxAndSecurity(currentUrl);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const headers: Record<string, string> = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        };

        if (cookiesToPass.length > 0) {
          headers['Cookie'] = cookiesToPass.join('; ');
        }

        const response = await fetch(currentUrl, {
          method: 'GET',
          headers,
          redirect: 'manual',
          signal: controller.signal,
        });

        // Collect cookies set by redirect responses
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
          const newCookies = setCookieHeader.split(',').map((c) => c.split(';')[0].trim());
          cookiesToPass = Array.from(new Set([...cookiesToPass, ...newCookies]));
        }

        const status = response.status;
        if ([301, 302, 303, 307, 308].includes(status)) {
          const location = response.headers.get('location');
          if (!location) {
            break;
          }

          let nextUrl: string;
          try {
            nextUrl = new URL(location, currentUrl).href;
          } catch {
            throw new BadRequestException(`Invalid redirect location header: ${location}`);
          }

          if (visited.has(nextUrl)) {
            throw new BadRequestException(
              `Unable to resolve Shopee affiliate URL. Detection of redirect loop at: ${this.redactSensitiveParams(nextUrl)}`,
            );
          }

          visited.add(nextUrl);
          redirectChain.push(nextUrl);
          currentUrl = nextUrl;
          hops++;
          continue;
        }

        // Non-redirect response reached
        break;
      } catch (err: unknown) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        if (err instanceof Error && err.name === 'AbortError') {
          throw new BadRequestException(
            'Unable to resolve Shopee affiliate URL. Request timed out during redirect resolution.',
          );
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw new BadRequestException(`Unable to resolve Shopee affiliate URL. ${msg}`);
      } finally {
        clearTimeout(timeout);
      }
    }

    if (hops >= maxRedirects) {
      throw new BadRequestException(
        `Unable to resolve Shopee affiliate URL. Exceeded maximum redirect limit (${maxRedirects} hops).`,
      );
    }

    return {
      finalUrl: currentUrl,
      hops,
      redirectChain,
    };
  }

  /**
   * Hostname platform detector with strict domain boundaries.
   */
  detectPlatform(urlStr: string): { platform: string; isShortLink: boolean } {
    try {
      const parsed = new URL(urlStr);
      const host = parsed.hostname.toLowerCase();

      // Shopee check
      if (
        host === 'shopee.vn' ||
        host.endsWith('.shopee.vn') ||
        host === 'shopee.com' ||
        host.endsWith('.shopee.com') ||
        host === 'shp.ee' ||
        host.endsWith('.shp.ee')
      ) {
        const isShort =
          host === 's.shopee.vn' ||
          host === 'shp.ee' ||
          host.endsWith('.shp.ee') ||
          parsed.pathname.startsWith('/universal-link');
        return { platform: 'shopee', isShortLink: isShort };
      }

      // Lazada check
      if (
        host === 'lazada.vn' ||
        host.endsWith('.lazada.vn') ||
        host === 's.lazada.vn'
      ) {
        return { platform: 'lazada', isShortLink: host === 's.lazada.vn' };
      }

      // TikTok Shop check
      if (
        host === 'tiktok.com' ||
        host.endsWith('.tiktok.com') ||
        host === 'vt.tiktok.com'
      ) {
        return { platform: 'tiktok', isShortLink: host === 'vt.tiktok.com' };
      }

      // Amazon check
      if (
        host === 'amazon.com' ||
        host.endsWith('.amazon.com') ||
        host === 'amzn.to'
      ) {
        return { platform: 'amazon', isShortLink: host === 'amzn.to' };
      }

      return { platform: 'generic', isShortLink: false };
    } catch {
      return { platform: 'generic', isShortLink: false };
    }
  }

  /**
   * Extract shopId and itemId from any Shopee URL format and produce canonical URL.
   */
  extractShopeeIds(
    urlStr: string,
  ): { shopId: string; itemId: string; canonicalUrl: string } | null {
    try {
      const parsed = new URL(urlStr);
      const pathname = parsed.pathname;

      let shopId: string | null = null;
      let itemId: string | null = null;

      // Pattern 1: /product/{shopId}/{itemId}
      const productMatch = pathname.match(/\/product\/(\d+)\/(\d+)/i);
      if (productMatch) {
        shopId = productMatch[1];
        itemId = productMatch[2];
      }

      // Pattern 2: /-i.{shopId}.{itemId} or /i.{shopId}.{itemId} or /any-name-i.{shopId}.{itemId}
      if (!shopId || !itemId) {
        const iMatch = pathname.match(/-?i\.(\d+)\.(\d+)/i);
        if (iMatch) {
          shopId = iMatch[1];
          itemId = iMatch[2];
        }
      }

      // Pattern 3: /{shopSlug}/{shopId}/{itemId} (e.g., /opaanlp/1016604648/23552060269)
      if (!shopId || !itemId) {
        const slugMatch = pathname.match(/\/([a-zA-Z0-9_\-\.]+)\/(\d+)\/(\d+)/i);
        if (slugMatch) {
          shopId = slugMatch[2];
          itemId = slugMatch[3];
        }
      }

      // Pattern 4: Query parameters shopid / itemid or shop_id / item_id
      if (!shopId || !itemId) {
        const qShop = parsed.searchParams.get('shopid') || parsed.searchParams.get('shop_id');
        const qItem = parsed.searchParams.get('itemid') || parsed.searchParams.get('item_id');
        if (qShop && qItem && /^\d+$/.test(qShop) && /^\d+$/.test(qItem)) {
          shopId = qShop;
          itemId = qItem;
        }
      }

      if (shopId && itemId) {
        const canonicalUrl = `https://shopee.vn/product/${shopId}/${itemId}`;
        return { shopId, itemId, canonicalUrl };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Redacts sensitive token values in URLs for safe logging.
   */
  redactSensitiveParams(urlStr: string): string {
    if (!urlStr) return urlStr;
    try {
      const parsed = new URL(urlStr);
      const sensitiveKeys = [
        'credential_token',
        'access_token',
        'token',
        'secret',
        'gads_t_sig',
        'auth',
      ];
      let modified = false;

      for (const key of sensitiveKeys) {
        if (parsed.searchParams.has(key)) {
          parsed.searchParams.set(key, '[REDACTED]');
          modified = true;
        }
      }

      return modified ? parsed.href : urlStr;
    } catch {
      return urlStr.replace(
        /(credential_token|access_token|token|secret|gads_t_sig)=[^&]+/gi,
        '$1=[REDACTED]',
      );
    }
  }

  private validateUrlSyntaxAndSecurity(urlStr: string): void {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new BadRequestException('URL không hợp lệ');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Chỉ hỗ trợ URL HTTP và HTTPS');
    }

    const hostname = parsed.hostname.toLowerCase();

    if (BLOCKED_HOSTS.includes(hostname)) {
      throw new BadRequestException('Không thể truy cập địa chỉ nội bộ');
    }

    if (BLOCKED_IP_PREFIXES.some((prefix) => hostname.startsWith(prefix))) {
      throw new BadRequestException('Không thể truy cập địa chỉ IP nội bộ');
    }
  }
}
