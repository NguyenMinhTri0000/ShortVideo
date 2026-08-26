import { Injectable } from '@nestjs/common';
import type {
  RawProductData,
  AiProductAnalysis,
  ProductContentBrief,
} from './types/product-research.types';

@Injectable()
export class ContentBriefService {
  /**
   * Generates a reusable Product Content Brief combining extracted factual data
   * and AI marketing analysis insights.
   */
  generateBrief(
    rawData: RawProductData,
    aiAnalysis: AiProductAnalysis,
  ): ProductContentBrief {
    const productName = rawData.title || 'Sản phẩm';
    const brand = rawData.brand || null;

    const targetAudience =
      aiAnalysis.targetAudience.length > 0
        ? aiAnalysis.targetAudience.join(', ')
        : 'Khách hàng quan tâm sản phẩm gia dụng & công nghệ';

    const mainPainPoint =
      aiAnalysis.painPoints.length > 0
        ? aiAnalysis.painPoints[0]
        : 'Tốn thời gian và công sức khi sử dụng sản phẩm truyền thống';

    const mainBenefit =
      aiAnalysis.benefits.length > 0
        ? aiAnalysis.benefits[0]
        : 'Tiết kiệm thời gian, tối ưu trải nghiệm và nâng cao chất lượng cuộc sống';

    const sellingPoints =
      aiAnalysis.sellingPoints.length > 0
        ? aiAnalysis.sellingPoints
        : aiAnalysis.usp.length > 0
          ? aiAnalysis.usp
          : rawData.features.slice(0, 5);

    const primaryAngle =
      aiAnalysis.marketingAngles.length > 0
        ? aiAnalysis.marketingAngles[0]
        : {
            title: 'Giải pháp tối ưu',
            description: 'Tập trung vào tính năng và trải nghiệm người dùng',
            hook: `Bí quyết sở hữu ${productName} chuẩn chất lượng!`,
          };

    const recommendedHook = primaryAngle.hook;
    const recommendedCTA = rawData.price
      ? `Xem ngay ${productName} với giá ưu đãi ${rawData.price} ${rawData.currency || ''}!`
      : `Đặt mua ngay ${productName} hôm nay để nhận ưu đãi!`;

    return {
      product: productName,
      brand,
      targetAudience,
      mainPainPoint,
      mainBenefit,
      sellingPoints,
      marketingAngle: `${primaryAngle.title}: ${primaryAngle.description}`,
      recommendedHook,
      recommendedCTA,
    };
  }
}
