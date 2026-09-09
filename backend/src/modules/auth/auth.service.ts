import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export class RegisterDto {
  email!: string;
  name?: string;
  password?: string;
}

export class LoginDto {
  email?: string;
  password?: string;
  userId?: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultUsers();
  }

  async seedDefaultUsers() {
    const count = await this.prisma.user.count();
    if (count === 0) {
      await this.prisma.user.createMany({
        data: [
          {
            email: 'user1@example.com',
            name: 'Tài khoản 1',
            passwordHash: 'seeded_hash_1',
            role: 'USER',
          },
          {
            email: 'user2@example.com',
            name: 'Tài khoản 2',
            passwordHash: 'seeded_hash_2',
            role: 'USER',
          },
          {
            email: 'user3@example.com',
            name: 'Tài khoản 3',
            passwordHash: 'seeded_hash_3',
            role: 'USER',
          },
        ],
      });
    }
  }

  async getUsers() {
    await this.seedDefaultUsers();
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return user;
  }

  async register(dto: RegisterDto) {
    if (!dto.email) {
      throw new BadRequestException('Email is required.');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException(
        `User with email ${dto.email} already exists.`,
      );
    }

    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name || dto.email.split('@')[0],
        passwordHash: dto.password || 'default_hash',
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  }

  async login(dto: LoginDto) {
    if (dto.userId) {
      return this.getUserById(dto.userId);
    }
    if (dto.email) {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (!user) {
        throw new NotFoundException(`User with email ${dto.email} not found.`);
      }
      return this.getUserById(user.id);
    }
    const users = await this.getUsers();
    return users[0];
  }
}
