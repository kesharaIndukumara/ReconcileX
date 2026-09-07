/// <reference lib="webworker" />
import { runReconciliation, EngineInput, EngineOutput } from '../utils/engine';

export type WorkerRequest = { type: 'run'; input: EngineInput };
export type WorkerResponse =
  | { type: 'progress'; value: number }
  | { type: 'done'; output: EngineOutput }
  | { type: 'error'; message: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  if (e.data?.type !== 'run') return;
  try {
    const output = runReconciliation(e.data.input, value => {
      (self as unknown as Worker).postMessage({ type: 'progress', value } satisfies WorkerResponse);
    });
    (self as unknown as Worker).postMessage({ type: 'done', output } satisfies WorkerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: (err as Error).message,
    } satisfies WorkerResponse);
  }
};
