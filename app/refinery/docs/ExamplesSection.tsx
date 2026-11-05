import CodeBlock from './CodeBlock';
import DocsSection from './DocsSection';
import { BASE_URL } from './constants';

export default function ExamplesSection() {
  return (
    <DocsSection id="examples" title="Examples">
      <p className="text-foreground">How to create an order:</p>
      <CodeBlock language="javascript" code={`const base = '${BASE_URL}';

// Create an order at the current server-selected quote. This one is real:
// the returned amount must be paid.

// 1 PHd = 1e15 hashdays. This order buys 1.25 PHd.
const hashDays = 1.25 * 1e15;

// Replace the endpoint and username with your own.
const orderResponse = await fetch(\`\${base}/order\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    upstream_target: {
      endpoint: 'parasite.wtf:42068',
      username: 'foo.bar',
      password: null,
    },
    hash_days: hashDays,
  }),
});
if (!orderResponse.ok) throw new Error(await orderResponse.text());

// Pay the returned amount in sats; don't use a locally calculated estimate.
const { order_id, payment_address, payment_amount } = await orderResponse.json();
console.log({ order_id, payment_address, payment_amount });`} />
      <p className="text-foreground">How to page/filter through orders:</p>
      <CodeBlock language="javascript" code={`// Page through /orders with filters. Keep the filters identical for every
// page; only the cursor changes. The first request has no cursor. Read
// X-Next-Cursor from each response and send it back as the cursor parameter.
// Stop when it is absent. X-Limit is the effective page size (limit is 1–500,
// default 50). Treat cursors as opaque, and restart if the filters change.
const base = '${BASE_URL}';

const params = new URLSearchParams({
  status: 'active,in_mempool',
  limit: '100',
});

const orders = [];
let cursor = null;
const seenCursors = new Set();

do {
  // Add the next-page cursor; the first request has none.
  if (cursor) params.set('cursor', cursor);
  else params.delete('cursor');

  // Fetch one page with the same filters.
  const response = await fetch(\`\${base}/orders?\${params}\`, { cache: 'no-store' });
  if (!response.ok) throw new Error(await response.text());

  orders.push(...(await response.json()));

  // The next cursor is null on the last page.
  const pageSize = response.headers.get('x-limit');
  cursor = response.headers.get('x-next-cursor');
  console.log('page size:', pageSize, 'next cursor:', cursor);

  // Defensive: stop if the server ever repeats a cursor.
  if (cursor && seenCursors.has(cursor)) throw new Error('pagination repeated a cursor');
  if (cursor) seenCursors.add(cursor);
} while (cursor);

console.log('loaded', orders.length, 'orders');`} />
    </DocsSection>
  );
}
