import { IsUrl, IsNotEmpty } from 'class-validator';

export class ResearchProductDto {
  @IsNotEmpty({ message: 'URL sản phẩm không được để trống' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'URL không hợp lệ. Vui lòng nhập URL bắt đầu bằng http:// hoặc https://' },
  )
  url: string;
}
