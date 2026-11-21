import {
  Body,
  Controller,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
  ) {}

  @Post('export')
  exportInvitation(
    @Body()
    body: {
      type: 'SPLIT' | 'GROUP';
      data: Record<string, unknown>;
      expiresInHours?: number;
    },
  ) {
    if (
      !body ||
      !['SPLIT', 'GROUP'].includes(body.type) ||
      !body.data ||
      typeof body.data !== 'object' ||
      Array.isArray(body.data)
    ) {
      throw new BadRequestException(
        'Provide a valid invitation type and data object.',
      );
    }

    return this.invitationsService.exportInvitation(body);
  }

  @Post('import')
  importInvitation(
    @Body() body: { encoded: string },
  ) {
    if (!body?.encoded) {
      throw new BadRequestException(
        'Encoded invitation is required.',
      );
    }

    return this.invitationsService.importInvitation(
      body.encoded,
    );
  }
}