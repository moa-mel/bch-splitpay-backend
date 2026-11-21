import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  timingSafeEqual,
  randomUUID,
} from 'crypto';

export interface InvitationPayload {
  id: string;
  type: 'SPLIT' | 'GROUP';
  network: string;
  data: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

interface SignedInvitation {
  payload: InvitationPayload;
  signature: string;
}

@Injectable()
export class InvitationsService {
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.secret =
      this.config.getOrThrow<string>('INVITATION_SECRET');

    if (this.secret.length < 32) {
      throw new Error(
        'INVITATION_SECRET must contain at least 32 characters.',
      );
    }
  }

  exportInvitation(
    input: {
      type: 'SPLIT' | 'GROUP';
      data: Record<string, unknown>;
      expiresInHours?: number;
    },
  ) {
    const expiresInHours = input.expiresInHours ?? 24;

    if (
      !Number.isInteger(expiresInHours) ||
      expiresInHours < 1 ||
      expiresInHours > 168
    ) {
      throw new BadRequestException(
        'Invitation expiry must be between 1 and 168 hours.',
      );
    }

    const now = new Date();

    const payload: InvitationPayload = {
      id: randomUUID(),
      type: input.type,
      network: this.config.get<string>(
        'BCH_NETWORK',
        'chipnet',
      ),
      data: input.data,
      createdAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + expiresInHours * 60 * 60 * 1000,
      ).toISOString(),
    };

    const signature = this.sign(payload);

    const invitation: SignedInvitation = {
      payload,
      signature,
    };

    const encoded = Buffer.from(
      JSON.stringify(invitation),
    ).toString('base64url');

    return {
      id: payload.id,
      type: payload.type,
      network: payload.network,
      expiresAt: payload.expiresAt,
      encoded,
    };
  }

  importInvitation(encoded: string) {
    if (!encoded || encoded.length > 100_000) {
      throw new BadRequestException(
        'Invalid invitation payload.',
      );
    }

    let invitation: SignedInvitation;

    try {
      invitation = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as SignedInvitation;
    } catch {
      throw new BadRequestException(
        'Invitation could not be decoded.',
      );
    }

    if (
      !invitation.payload ||
      !invitation.signature ||
      !invitation.payload.id ||
      !invitation.payload.data ||
      !['SPLIT', 'GROUP'].includes(invitation.payload.type)
    ) {
      throw new BadRequestException(
        'Invitation structure is invalid.',
      );
    }

    const expectedSignature = this.sign(invitation.payload);

    const actual = Buffer.from(invitation.signature, 'hex');
    const expected = Buffer.from(expectedSignature, 'hex');

    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new UnauthorizedException(
        'Invitation signature is invalid.',
      );
    }

    if (
      !Number.isFinite(
        Date.parse(invitation.payload.expiresAt),
      ) ||
      Date.parse(invitation.payload.expiresAt) <= Date.now()
    ) {
      throw new UnauthorizedException(
        'This invitation has expired.',
      );
    }

    const currentNetwork = this.config.get<string>(
      'BCH_NETWORK',
      'chipnet',
    );

    if (invitation.payload.network !== currentNetwork) {
      throw new BadRequestException(
        'This invitation belongs to a different BCH network.',
      );
    }

    return {
      valid: true,
      invitation: invitation.payload,
    };
  }

  private sign(payload: InvitationPayload): string {
    return createHmac('sha256', this.secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
}