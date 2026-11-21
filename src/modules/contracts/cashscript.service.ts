
import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { spawn } from 'child_process';
import { join } from 'path';

@Injectable()
export class CashScriptService {
  private readonly workerPath = join(
    process.cwd(),
    'scripts',
    'cashscript-worker.mjs',
  );

  execute<T>(
    action: string,
    input: Record<string, unknown>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [this.workerPath],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);

      child.on('close', (code) => {
        if (code !== 0) {
          reject(
            new InternalServerErrorException(
              stderr || 'CashScript execution failed.',
            ),
          );
          return;
        }

        try {
          resolve(JSON.parse(stdout) as T);
        } catch {
          reject(
            new InternalServerErrorException(
              'CashScript worker returned invalid JSON.',
            ),
          );
        }
      });

      child.stdin.end(
        JSON.stringify({ action, input }),
      );
    });
  }
}
