
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket, { RawData } from 'ws';

interface ElectrumResponse<T> {
  id?: number | null;
  result?: T;
  error?: {
    code: number;
    message: string;
  } | null;
}

@Injectable()
export class NetworkProvider {
  private readonly electrumUrl: string;
  private readonly timeoutMs = 12000;

  constructor(private readonly config: ConfigService) {
    this.electrumUrl =
      this.config.getOrThrow<string>('BCH_ELECTRUM_URL');
  }

  getNetwork(): string {
    return this.config.get<string>('BCH_NETWORK', 'chipnet');
  }

  async call<T>(
    method: string,
    params: unknown[] = [],
  ): Promise<T> {
    switch (method) {
      case 'sendrawtransaction':
        return this.request<T>(
          'blockchain.transaction.broadcast',
          params,
        );

      case 'getrawtransaction': {
        const [transactionId, verbose = false] = params;

        return this.request<T>(
          'blockchain.transaction.get',
          [transactionId, Boolean(verbose)],
        );
      }

      case 'gettransactionheight':
        return this.request<T>(
          'blockchain.transaction.get_height',
          params,
        );

      case 'gettipheight': {
        const header = await this.request<{ height: number }>(
          'blockchain.headers.subscribe',
          [],
        );

        if (
          !header ||
          typeof header.height !== 'number' ||
          !Number.isFinite(header.height)
        ) {
          throw new ServiceUnavailableException(
            'Electrum returned an invalid blockchain height.',
          );
        }

        return header.height as T;
      }

      default:
        throw new InternalServerErrorException(
          `Unsupported BCH Electrum method: ${method}`,
        );
    }
  }

  private request<T>(
    method: string,
    params: unknown[],
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let socket: WebSocket | undefined;

      const requestId = 1;

      const finish = (
        error?: Error,
        value?: T,
      ) => {
        if (settled) return;

        settled = true;
        clearTimeout(timeout);

        if (
          socket &&
          socket.readyState === WebSocket.OPEN
        ) {
          socket.close();
        }

        if (error) {
          reject(error);
        } else {
          resolve(value as T);
        }
      };

      const sendRequest = (
        id: number,
        requestMethod: string,
        requestParams: unknown[],
      ) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          finish(
            new ServiceUnavailableException(
              'The BCH Electrum connection is not ready.',
            ),
          );
          return;
        }

        try {
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              method: requestMethod,
              params: requestParams,
            }),
          );
        } catch {
          finish(
            new ServiceUnavailableException(
              'Unable to send a request to the BCH Electrum server.',
            ),
          );
        }
      };

      const timeout = setTimeout(() => {
        finish(
          new ServiceUnavailableException(
            'Timed out connecting to the BCH Electrum server.',
          ),
        );
      }, this.timeoutMs);

      try {
        socket = new WebSocket(this.electrumUrl);
      } catch {
        finish(
          new ServiceUnavailableException(
            'Invalid BCH Electrum WebSocket endpoint.',
          ),
        );
        return;
      }

      socket.on('open', () => {
        sendRequest(0, 'server.version', [
          'SplitPay',
          '1.4',
        ]);
      });

      socket.on('message', (data: RawData) => {
        let message: ElectrumResponse<unknown>;

        try {
          message = JSON.parse(
            data.toString(),
          ) as ElectrumResponse<unknown>;
        } catch {
          finish(
            new ServiceUnavailableException(
              'Electrum returned an invalid JSON response.',
            ),
          );
          return;
        }

        if (message.id === 0) {
          if (message.error) {
            finish(
              new ServiceUnavailableException(
                `Electrum protocol negotiation failed: ${message.error.message}`,
              ),
            );
            return;
          }

          sendRequest(requestId, method, params);
          return;
        }

        // Ignore notifications and responses to unrelated request IDs.
        if (message.id !== requestId) return;

        if (message.error) {
          finish(
            new InternalServerErrorException(
              `Electrum error ${message.error.code}: ${message.error.message}`,
            ),
          );
          return;
        }

        if (message.result === undefined) {
          finish(
            new ServiceUnavailableException(
              'Electrum returned an empty result.',
            ),
          );
          return;
        }

        finish(undefined, message.result as T);
      });

      socket.on('error', () => {
        finish(
          new ServiceUnavailableException(
            'Unable to connect to the BCH Chipnet Electrum server.',
          ),
        );
      });

      socket.on('close', () => {
        if (!settled) {
          finish(
            new ServiceUnavailableException(
              'The BCH Electrum connection closed unexpectedly.',
            ),
          );
        }
      });
    });
  }
}
