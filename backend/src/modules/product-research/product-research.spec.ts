import { GenericProductAdapter } from './adapters/generic-product.adapter';
import { ShopeeAdapter } from './adapters/shopee.adapter';
import { AmazonAdapter } from './adapters/amazon.adapter';
import { ContentBriefService } from './content-brief.service';
import type { RawProductData, AiProductAnalysis } from './types/product-research.types';

describe('Product Research Engine Tests', () => {
  describe('ProductSourceAdapters', () => {
    const genericAdapter = new GenericProductAdapter();
    const shopeeAdapter = new ShopeeAdapter();
    const amazonAdapter = new AmazonAdapter();

    it('should correctly identify handled URLs per adapter', () => {
      expect(shopeeAdapter.canHandle('https://shopee.vn/product/123/456')).toBe(true);
      expect(shopeeAdapter.canHandle('https://example.com/product')).toBe(false);

      expect(amazonAdapter.canHandle('https://www.amazon.com/dp/B08N5WRWNW')).toBe(true);
      expect(amazonAdapter.canHandle('https://example.com/product')).toBe(false);

      expect(genericAdapter.canHandle('https://example.com/product')).toBe(true);
    });

    it('should reject invalid or unsafe SSRF URLs', async () => {
      await expect(genericAdapter.extract('invalid-url')).rejects.toThrow();
      await expect(genericAdapter.extract('http://127.0.0.1/admin')).rejects.toThrow(
        'Không thể truy cập địa chỉ nội bộ',
      );
      await expect(genericAdapter.extract('http://169.254.169.254/metadata')).rejects.toThrow(
        'Không thể truy cập địa chỉ nội bộ',
      );
    });
  });

  describe('ContentBriefService', () => {
    const contentBriefService = new ContentBriefService();

    it('should generate a structured Content Brief combining raw and AI analysis data', () => {
      const rawData: RawProductData = {
        title: 'Nồi chiên không dầu Philips HD9252/90',
        brand: 'Philips',
        category: 'Thiết bị nhà bếp',
        description: 'Nồi chiên không dầu dung tích 4.1L',
        price: '2.490.000',
        originalPrice: '3.290.000',
        currency: 'VND',
        discountPercent: 24,
        rating: 4.8,
        reviewCount: 350,
        images: ['https://example.com/img1.jpg'],
        videos: [],
        features: ['Công nghệ Rapid Air', 'Dung tích 4.1L'],
        specifications: { 'Công suất': '1400W' },
        productUrl: 'https://example.com/philips',
        sourcePlatform: 'generic',
      };

      const aiAnalysis: AiProductAnalysis = {
        summary: 'Nồi chiên không dầu cao cấp Philips giúp nấu ăn lành mạnh giảm 90% lượng dầu mỡ.',
        category: 'Gia dụng nhà bếp',
        features: ['Công nghệ Rapid Air', 'Màn hình cảm ứng'],
        benefits: ['Nấu ăn nhanh', 'Giảm lượng dầu mỡ'],
        sellingPoints: ['Công nghệ Rapid Air giảm 90% dầu mỡ'],
        usp: ['Thương hiệu Philips uy tín'],
        targetAudience: ['Người bận rộn', 'Gia đình nhỏ'],
        useCases: ['Nấu ăn hàng ngày', 'Chế biến món chiên lành mạnh'],
        painPoints: ['Món chiên rán quá nhiều dầu mỡ gây tăng cân'],
        pros: ['Dễ vệ sinh', 'Tiết kiệm thời gian'],
        cons: ['Dung tích vừa phải'],
        marketingAngles: [
          {
            title: 'Sức khỏe gia đình',
            description: 'Giải pháp ăn ngon không sợ mỡ',
            hook: 'Ăn đồ chiên rán mà vẫn thon gọn? Bí quyết đây!',
          },
        ],
      };

      const brief = contentBriefService.generateBrief(rawData, aiAnalysis);

      expect(brief.product).toBe('Nồi chiên không dầu Philips HD9252/90');
      expect(brief.brand).toBe('Philips');
      expect(brief.targetAudience).toContain('Người bận rộn');
      expect(brief.mainPainPoint).toContain('dầu mỡ');
      expect(brief.mainBenefit).toContain('Nấu ăn nhanh');
      expect(brief.recommendedHook).toContain('Bí quyết');
      expect(brief.recommendedCTA).toContain('2.490.000 VND');
    });
  });
});
