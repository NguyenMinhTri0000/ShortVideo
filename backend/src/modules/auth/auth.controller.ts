import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  Param,
} from '@nestjs/common';
import { AuthService, RegisterDto, LoginDto } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('users')
  async getUsers() {
    return this.authService.getUsers();
  }

  @Get('me')
  async getMe(@Headers('x-user-id') headerUserId?: string, @Query('userId') queryUserId?: string) {
    const userId = headerUserId || queryUserId;
    if (userId) {
      try {
        return await this.authService.getUserById(userId);
      } catch (e) {
        // Fallback to first user if specified ID invalid
      }
    }
    const users = await this.authService.getUsers();
    return users[0];
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    return this.authService.getUserById(id);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
