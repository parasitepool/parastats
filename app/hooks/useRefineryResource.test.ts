import assert from 'node:assert/strict';
import test from 'node:test';
import { RefineryRequestManager } from './useRefineryResource';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}

function jsonResponse(value: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

test('the default fetcher remains bound to globalThis', async () => {
  const originalFetch = globalThis.fetch;
  let receiver: unknown;
  globalThis.fetch = function (this: unknown) {
    receiver = this;
    return Promise.resolve(jsonResponse('ok'));
  } as typeof fetch;

  try {
    const manager = new RefineryRequestManager();
    await manager.request('/resource', false, {
      onData: () => {},
      onError: () => assert.fail('request should not fail'),
      onSettled: () => {},
    });
    assert.strictEqual(receiver, globalThis);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('regular polls do not overlap an active request', async () => {
  const response = deferred<Response>();
  let calls = 0;
  const manager = new RefineryRequestManager((() => {
    calls++;
    return response.promise;
  }) as typeof fetch);
  const values: string[] = [];
  let settled = 0;
  const callbacks = {
    onData: (value: string) => values.push(value),
    onError: () => assert.fail('request should not fail'),
    onSettled: () => { settled++; },
  };

  const first = manager.request<string>('/resource', false, callbacks);
  const second = manager.request<string>('/resource', false, callbacks);
  assert.equal(calls, 1);

  response.resolve(jsonResponse('current'));
  await Promise.all([first, second]);
  assert.deepEqual(values, ['current']);
  assert.equal(settled, 1);
});

test('a forced refresh ignores the superseded response', async () => {
  const responses: Array<ReturnType<typeof deferred<Response>>> = [];
  const manager = new RefineryRequestManager((() => {
    const response = deferred<Response>();
    responses.push(response);
    return response.promise;
  }) as typeof fetch);
  const values: string[] = [];
  const callbacks = {
    onData: (value: string) => values.push(value),
    onError: () => assert.fail('superseded requests must not report errors'),
    onSettled: () => {},
  };

  const first = manager.request<string>('/resource', false, callbacks);
  const second = manager.request<string>('/resource', true, callbacks);
  assert.equal(responses.length, 2);

  responses[0].resolve(jsonResponse('old'));
  await first;
  assert.deepEqual(values, []);

  responses[1].resolve(jsonResponse('new'));
  await second;
  assert.deepEqual(values, ['new']);
});

test('unsuccessful responses report errors without data', async () => {
  const manager = new RefineryRequestManager((async () =>
    new Response('unavailable', { status: 503 })) as typeof fetch);
  let errors = 0;
  let settled = 0;

  await manager.request('/resource', false, {
    onData: () => assert.fail('unusable response must not produce data'),
    onError: () => { errors++; },
    onSettled: () => { settled++; },
  });

  assert.equal(errors, 1);
  assert.equal(settled, 1);
});
