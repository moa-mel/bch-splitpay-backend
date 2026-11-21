import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface JsonRpcResponse<T> {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

@Injectable()
export class NetworkProvider {
  private readonly rpcUrl: string;
  private readonly username?: string;
  private readonly password?: string;

  constructor(private readonly config: ConfigService) {
    this.rpcUrl = this.config.getOrThrow<string>('BCH_RPC_URL');
    this.username = this.config.get<string>('BCH_RPC_USER');
    this.password = this.config.get<string>('BCH_RPC_PASSWORD');
  }

  async call<T>(
    method: string,
    params: unknown[] = [],
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.username && this.password) {
      const credentials = Buffer.from(
        `${this.username}:${this.password}`,
      ).toString('base64');

      headers.Authorization = `Basic ${credentials}`;
    }

    let response: Response;

    try {
      response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: 'splitpay',
          method,
          params,
        }),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Unable to connect to the BCH node.',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `BCH node returned HTTP ${response.status}.`,
      );
    }

    const body =
      (await response.json()) as JsonRpcResponse<T>;

    if (body.error) {
      throw new InternalServerErrorException(
        `BCH RPC error: ${body.error.message}`,
      );
    }

    if (body.result === undefined) {
      throw new InternalServerErrorException(
        'BCH node returned an empty result.',
      );
    }

    return body.result;
  }

  getNetwork() {
    return this.config.get<string>('BCH_NETWORK', 'chipnet');
  }
}