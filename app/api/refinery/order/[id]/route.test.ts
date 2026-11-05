import assert from 'node:assert/strict';
import test from 'node:test';
import { scrubIpAddresses } from '@/lib/refinery-privacy';

test('scrubs only upstream and session IP addresses', () => {
  const order = {
    upstream_address: '192.0.2.1:3333',
    upstream_target: {
      endpoint: 'parasite.wtf:42068',
      username: 'bc1qexample.worker',
      password: 'visible-stratum-password',
    },
    sessions: [
      { id: 1, remote_address: '198.51.100.2:45678', username: 'worker.one' },
      { id: 2, remote_address: null, username: 'worker.two' },
      null,
    ],
  };

  assert.strictEqual(scrubIpAddresses(order), order);
  assert.equal(order.upstream_address, null);
  assert.equal(order.sessions[0]?.remote_address, null);
  assert.equal(order.sessions[1]?.remote_address, null);
  assert.equal(order.upstream_target.password, 'visible-stratum-password');
  assert.equal(order.upstream_target.endpoint, 'parasite.wtf:42068');
});

test('leaves orders without IP fields and non-object responses unchanged', () => {
  const order = { upstream_target: { password: null }, sessions: [] };
  assert.strictEqual(scrubIpAddresses(order), order);
  assert.deepEqual(order, { upstream_target: { password: null }, sessions: [] });

  for (const value of [null, 'error', 42, []]) {
    assert.strictEqual(scrubIpAddresses(value), value);
  }
});
