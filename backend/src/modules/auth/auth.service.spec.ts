import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AuthService & Multi-User Isolation', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockUsers = [
    {
      id: 'user-1-id',
      email: 'user1@example.com',
      name: 'Tài khoản 1',
      role: 'USER',
    },
    {
      id: 'user-2-id',
      email: 'user2@example.com',
      name: 'Tài khoản 2',
      role: 'USER',
    },
  ];

  const mockPrismaService = {
    user: {
      count: jest.fn().mockResolvedValue(2),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue(mockUsers),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id) {
          return Promise.resolve(
            mockUsers.find((u) => u.id === where.id) || null,
          );
        }
        if (where.email) {
          return Promise.resolve(
            mockUsers.find((u) => u.email === where.email) || null,
          );
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'user-new-id',
          email: data.email,
          name: data.name,
          role: 'USER',
          createdAt: new Date(),
        }),
      ),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return system users list', async () => {
    const users = await service.getUsers();
    expect(users).toHaveLength(2);
    expect(users[0].name).toBe('Tài khoản 1');
    expect(users[1].name).toBe('Tài khoản 2');
  });

  it('should get user profile by ID', async () => {
    const user = await service.getUserById('user-1-id');
    expect(user).toBeDefined();
    expect(user.id).toBe('user-1-id');
    expect(user.name).toBe('Tài khoản 1');
  });

  it('should throw NotFoundException for non-existent user ID', async () => {
    await expect(service.getUserById('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should register a new user', async () => {
    const newUser = await service.register({
      email: 'user3@example.com',
      name: 'Tài khoản 3',
    });
    expect(newUser.email).toBe('user3@example.com');
    expect(newUser.name).toBe('Tài khoản 3');
  });

  it('should prevent registration with existing email', async () => {
    await expect(
      service.register({ email: 'user1@example.com', name: 'Duplicate' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should login with userId or email', async () => {
    const user = await service.login({ userId: 'user-2-id' });
    expect(user.id).toBe('user-2-id');
    expect(user.name).toBe('Tài khoản 2');
  });
});
