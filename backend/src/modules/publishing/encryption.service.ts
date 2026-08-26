import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly secretKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawSecret = this.configService.get<string>(
      'TOKEN_ENCRYPTION_SECRET',
      'antigravity-default-secret-key-32-chars-long!',
    );
    // Ensure key length is exactly 32 bytes for aes-256
    this.secretKey = crypto.createHash('sha256').update(rawSecret).digest();
  }

  encrypt(text: string | null | undefined): string | null {
    if (!text) return null;
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${(error as Error).message}`);
    }
  }

  decrypt(cipherText: string | null | undefined): string | null {
    if (!cipherText) return null;
    try {
      const parts = cipherText.split(':');
      if (parts.length !== 3) {
        // Fallback for unencrypted legacy tokens if any
        return cipherText;
      }
      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.secretKey,
        iv,
      );
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      // In case decryption fails or token is plain text fallback
      return cipherText;
    }
  }

  sanitizeAccount<T extends { accessToken?: string | null; refreshToken?: string | null }>(
    account: T,
  ): Omit<T, 'accessToken' | 'refreshToken'> & {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
  } {
    const { accessToken, refreshToken, ...rest } = account;
    return {
      ...rest,
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
    };
  }
}
