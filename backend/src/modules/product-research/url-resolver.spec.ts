import { UrlResolverService } from './url-resolver.service';
import { BadRequestException } from '@nestjs/common';

describe('UrlResolverService Unit Tests', () => {
  let resolver: UrlResolverService;

  beforeEach(() => {
    resolver = new UrlResolverService();
  });

  describe('Shopee URL Identification and Parsing', () => {
    it('Test 1 — Direct Shopee product URL', async () => {
      const url = 'https://shopee.vn/product/1016604648/23552060269';
      const platformInfo = resolver.detectPlatform(url);
      expect(platformInfo.platform).toBe('shopee');
      expect(platformInfo.isShortLink).toBe(false);

      const shopeeIds = resolver.extractShopeeIds(url);
      expect(shopeeIds).toBeDefined();
      expect(shopeeIds?.shopId).toBe('1016604648');
      expect(shopeeIds?.itemId).toBe('23552060269');
      expect(shopeeIds?.canonicalUrl).toBe('https://shopee.vn/product/1016604648/23552060269');
    });

    it('Test 2 — Direct Shopee URL with affiliate parameters', async () => {
      const url =
        'https://shopee.vn/product/1016604648/23552060269?credential_token=xyz123&mmp_pid=17362930494&utm_source=an_17362930494';
      const platformInfo = resolver.detectPlatform(url);
      expect(platformInfo.platform).toBe('shopee');

      const shopeeIds = resolver.extractShopeeIds(url);
      expect(shopeeIds).toBeDefined();
      expect(shopeeIds?.shopId).toBe('1016604648');
      expect(shopeeIds?.itemId).toBe('23552060269');
      expect(shopeeIds?.canonicalUrl).toBe('https://shopee.vn/product/1016604648/23552060269');
    });

    it('Test 3 — Shopee short affiliate URL domain detection', () => {
      const shortUrl = 'https://s.shopee.vn/2BEdOJfh2o';
      const platformInfo = resolver.detectPlatform(shortUrl);
      expect(platformInfo.platform).toBe('shopee');
      expect(platformInfo.isShortLink).toBe(true);
    });

    it('Extracts Shopee IDs from custom store path (/opaanlp/{shopId}/{itemId})', () => {
      const url = 'https://shopee.vn/opaanlp/1016604648/23552060269?__mobile__=1';
      const shopeeIds = resolver.extractShopeeIds(url);
      expect(shopeeIds).toBeDefined();
      expect(shopeeIds?.shopId).toBe('1016604648');
      expect(shopeeIds?.itemId).toBe('23552060269');
      expect(shopeeIds?.canonicalUrl).toBe('https://shopee.vn/product/1016604648/23552060269');
    });

    it('Extracts Shopee IDs from -i format (/-i.{shopId}.{itemId})', () => {
      const url = 'https://shopee.vn/Giay-ve-sinh-TopGia-i.1016604648.23552060269';
      const shopeeIds = resolver.extractShopeeIds(url);
      expect(shopeeIds).toBeDefined();
      expect(shopeeIds?.shopId).toBe('1016604648');
      expect(shopeeIds?.itemId).toBe('23552060269');
    });
  });

  describe('HTTP Redirect Resolution', () => {
    it('Test 4 — Multiple redirect hops (mocked fetch)', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          status: 301,
          headers: new Map([['location', 'https://redirect-a.com/step1']]),
        })
        .mockResolvedValueOnce({
          status: 302,
          headers: new Map([['location', 'https://shopee.vn/product/1016604648/23552060269']]),
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: new Map(),
        });

      global.fetch = mockFetch as any;

      const result = await resolver.resolveRedirects('https://s.shopee.vn/mock-short');

      expect(result.hops).toBe(2);
      expect(result.finalUrl).toBe('https://shopee.vn/product/1016604648/23552060269');
      expect(result.redirectChain).toEqual([
        'https://s.shopee.vn/mock-short',
        'https://redirect-a.com/step1',
        'https://shopee.vn/product/1016604648/23552060269',
      ]);
    });

    it('Test 5 — Redirect loop protection', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          status: 301,
          headers: new Map([['location', 'https://redirect-b.com/loop']]),
        })
        .mockResolvedValueOnce({
          status: 301,
          headers: new Map([['location', 'https://redirect-a.com/loop']]),
        });

      global.fetch = mockFetch as any;

      await expect(
        resolver.resolveRedirects('https://redirect-a.com/loop', 10),
      ).rejects.toThrow(BadRequestException);
    });

    it('Exceeds maximum redirect count', async () => {
      let count = 0;
      const mockFetch = jest.fn().mockImplementation(() => {
        count++;
        return Promise.resolve({
          status: 301,
          headers: new Map([['location', `https://infinite-redirect.com/next-${count}`]]),
        });
      });

      global.fetch = mockFetch as any;

      await expect(
        resolver.resolveRedirects('https://infinite-redirect.com/start', 3),
      ).rejects.toThrow('Exceeded maximum redirect limit');
    });
  });

  describe('Validation & Security', () => {
    it('Test 6 — Unsupported URL platform detection', () => {
      const url = 'https://example.com/product/123';
      const platformInfo = resolver.detectPlatform(url);
      expect(platformInfo.platform).toBe('generic');
      expect(platformInfo.isShortLink).toBe(false);
    });

    it('Test 7 — Invalid / Unsafe URL validation', async () => {
      await expect(resolver.resolveAndNormalizeUrl('')).rejects.toThrow(BadRequestException);
      await expect(resolver.resolveAndNormalizeUrl('not-a-url')).rejects.toThrow(BadRequestException);
      await expect(resolver.resolveAndNormalizeUrl('https://')).rejects.toThrow(BadRequestException);
      await expect(resolver.resolveAndNormalizeUrl('http://127.0.0.1/admin')).rejects.toThrow(
        'Không thể truy cập địa chỉ nội bộ',
      );
      await expect(resolver.resolveAndNormalizeUrl('http://169.254.169.254/metadata')).rejects.toThrow(
        'Không thể truy cập địa chỉ nội bộ',
      );
    });

    it('Test 8 — Redaction of sensitive parameters in logs', () => {
      const sensitiveUrl =
        'https://shopee.vn/product/123/456?credential_token=secret_12345&access_token=token_abc&other=normal';
      const redacted = resolver.redactSensitiveParams(sensitiveUrl);

      expect(redacted).not.toContain('secret_12345');
      expect(redacted).not.toContain('token_abc');
      expect(redacted).toContain('credential_token=%5BREDACTED%5D');
      expect(redacted).toContain('other=normal');
    });
  });
});
