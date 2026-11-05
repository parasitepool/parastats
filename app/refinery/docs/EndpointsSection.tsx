import type { ReactNode } from 'react';
import Link from 'next/link';
import CodeBlock from './CodeBlock';
import DocsSection from './DocsSection';
import { Num, Unit } from './Typography';
import { BASE_URL } from './constants';

interface ParamDoc {
  name: string;
  type: string;
  description: ReactNode;
}

interface EndpointDoc {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  params?: ParamDoc[];
  body?: ParamDoc[];
  details?: ReactNode;
  curl: string;
  response: string;
  responseNote?: string;
}

const ENDPOINTS: EndpointDoc[] = [
  {
    method: 'GET',
    path: '/status',
    description:
      'Returns the current router status: hashprice, total and used capacity, whether order creation is halted, and aggregate upstream/downstream mining stats.',
    curl: `curl -s ${BASE_URL}/status`,
    response: `{
  "uptime_secs": 166650,
  "block_count": 1,
  "recent_blocks": ["00000000000000000000b3b4ffabf7eed7e613c5fcb50ec85f015e424b0bcf6d"],
  "hash_price": 47051,
  "hash_value": 44810,
  "difficulty_multiplier": 1,
  "total_capacity_hash_days": 1000000000000000000,
  "used_capacity_hash_days": 18156355635669600,
  "halt": false,
  "boost": false,
  "wallet": { "synced": true },
  "deficit_hashrate": 242660823167963.25,
  "surplus_hashrate": 2409028380977510,
  "starving_order_count": 1,
  "upstream": {
    "users": 4,
    "workers": 4,
    "orders": 5,
    "pending": 0,
    "disconnected": 0,
    "disconnects_1h": 5,
    "hashrate_1m": 23903891512998370,
    "hashrate_5m": 22351127069392070,
    "hashrate_15m": 21017789416449050,
    "hashrate_1hr": 13615135960832540,
    "hashrate_6hr": 11293861977378782,
    "hashrate_1d": 25477950174276900,
    "hashrate_7d": 34998599365939650,
    "sps_1m": 0.8659437857645059,
    "sps_5m": 0.787279530746437,
    "sps_15m": 0.7781535618482415,
    "sps_1hr": 0.5789747379903702,
    "accepted_shares": 11137,
    "rejected_shares": 0,
    "accepted_work": 44077108716.264595,
    "rejected_work": 0,
    "best_share": 70156720686,
    "last_share": 1793198908,
    "totals": {
      "users": 684,
      "orders": 3908,
      "accepted_shares": 21714524,
      "rejected_shares": 3261,
      "accepted_work": 201020604306333.72,
      "rejected_work": 38980956870.4914,
      "delivered_hash_days": 9994726195055389000,
      "best_share": 400975189086445,
      "last_share": 1793198908
    }
  },
  "downstream": {
    "users": 1,
    "workers": 4,
    "sessions": 20,
    "idle": 0,
    "disconnected": 16,
    "connects_1h": { "total": 9767, "sessions": 156, "probes": 9611, "rejects": 0, "pending": 0 },
    "disconnects_1h": { "total": 9750, "client": 9702, "server": 3, "trim": 45, "rejects": 0 },
    "hashrate_1m": 20322723193479148,
    "hashrate_5m": 15472835568427222,
    "hashrate_15m": 8388059207169918,
    "hashrate_1hr": 2635720504297727,
    "hashrate_6hr": 470638597216694.06,
    "hashrate_1d": 118908319749193.73,
    "hashrate_7d": 17038394625728.324,
    "sps_1m": 7.247110208588404,
    "sps_5m": 5.098069196267634,
    "sps_15m": 2.561778494216036,
    "sps_1hr": 0.7684923549907909,
    "accepted_shares": 2952,
    "rejected_shares": 1,
    "accepted_work": 2400489826.813699,
    "rejected_work": 1000000.7735922161,
    "best_share": 70156720686,
    "last_share": 1793198908,
    "totals": {
      "users": 2,
      "workers": 2514,
      "accepted_shares": 485200828,
      "rejected_shares": 59914,
      "accepted_work": 200799075962956.75,
      "rejected_work": 21940234604.05207,
      "delivered_hash_days": 9982866862476966000,
      "best_share": 400975189086445,
      "last_share": 1793198908
    }
  },
  "git_commit": "abcdef0123456789abcdef0123456789abcdef01"
}`,
  },
  {
    method: 'GET',
    path: '/orders',
    description:
      'Lists orders, newest first. Returns up to 50 orders by default. Use limit (1–500) and cursor to page through results.',
    params: [
      { name: 'status', type: 'string', description: 'Comma-separated filter: pending, in_mempool, active, fulfilled, cancelled, disconnected, expired.' },
      { name: 'kind', type: 'string', description: 'bucket or sink.' },
      { name: 'review', type: 'string', description: 'Review filter: clean, flagged, or cleared.' },
      { name: 'address', type: 'string', description: 'Only orders paying to, or mining for, this address.' },
      { name: 'search', type: 'string', description: 'Case-insensitive match on order id, upstream target, or payment address.' },
      { name: 'limit', type: 'integer', description: 'Page size, 1–500. Defaults to 50. Use with cursor for keyset pagination.' },
      { name: 'cursor', type: 'integer', description: 'Keyset cursor from a previous page\'s X-Next-Cursor header.' },
    ],
    details: (
      <>
        <h3 className="text-sm font-semibold mt-4 mb-2">Pagination</h3>
        <p className="text-foreground text-sm mb-2">
          Without <code className="font-mono text-xs">limit</code>, the endpoint returns the newest 50 orders.
          Set <code className="font-mono text-xs">limit</code> (1–500) to request a larger page. When more results exist, the
          response includes an <code className="font-mono text-xs">X-Next-Cursor</code> header;
          send its value back as <code className="font-mono text-xs">cursor</code> to fetch the
          next page. The effective page size is returned in the <code className="font-mono text-xs">X-Limit</code> header.
        </p>
        <CodeBlock code={`curl -si "${BASE_URL}/orders?status=active,in_mempool&kind=bucket&limit=1" | grep -i '^x-'`} language="shell" />
        <div className="mt-2">
          <CodeBlock code={`x-limit: 1\nx-next-cursor: 42`} />
        </div>
      </>
    ),
    curl: `curl -s "${BASE_URL}/orders?status=active,in_mempool&kind=bucket&limit=1"`,
    response: `[
  {
    "id": 42,
    "status": "active",
    "review": "clean",
    "endpoint": "parasite.wtf:42068",
    "username": "bc1q....worker",
    "requested_hash_days": 10000000000000000,
    "hashrate": 10400000000000000,
    "delivered_hash_days": 3200000000000000,
    "best_share": 123456789
  }
]`,
    responseNote: 'Next page: repeat the request with &cursor=42 (from the X-Next-Cursor header).',
  },
  {
    method: 'GET',
    path: '/orders/count',
    description:
      'Returns the number of orders matching the given filters. Accepts the same filters as /orders, except cursor and limit.',
    params: [
      { name: 'status', type: 'string', description: 'Comma-separated filter: pending, in_mempool, active, fulfilled, cancelled, disconnected, expired.' },
      { name: 'kind', type: 'string', description: 'bucket (orders with a work target) or sink.' },
      { name: 'review', type: 'string', description: 'Review filter: clean, flagged, or cleared.' },
      { name: 'address', type: 'string', description: 'Only orders paying to, or mining for, this address.' },
      { name: 'search', type: 'string', description: 'Case-insensitive match on order id, upstream target, or payment address.' },
    ],
    curl: `curl -s "${BASE_URL}/orders/count?status=active&kind=bucket"`,
    response: `{
  "count": 7
}`,
  },
  {
    method: 'GET',
    path: '/order/{id}',
    description:
      'Returns details for an order, including payment information, transaction ids, mining stats, and active worker sessions.',
    curl: `curl -s ${BASE_URL}/order/42`,
    response: `{
  "id": 42,
  "status": "fulfilled",
  "review": "clean",
  "upstream_target": {
    "endpoint": "parasite.wtf:42068",
    "username": "bc1qexample.worker",
    "password": null
  },
  "upstream_address": null,
  "upstream_disconnects_total": 0,
  "requested_hash_days": 299000000000000,
  "hash_price": 47096,
  "payment_address": "bc1qexamplepaymentaddress",
  "payment_amount": 14082,
  "txids": ["exampletxid"],
  "created_at": 1761000000,
  "created_at_height": 921800,
  "upstream": {
    "hashrate_1m": 0,
    "hashrate_5m": 0,
    "hashrate_15m": 24511.928608076323,
    "hashrate_1hr": 2511380599112,
    "hashrate_6hr": 248279636325150,
    "hashrate_1d": 198640222735611,
    "hashrate_7d": 40319828280266,
    "sps_1m": 0,
    "sps_5m": 0,
    "sps_15m": 1.3860600113664807e-12,
    "sps_1hr": 0.00016625749661147924,
    "accepted_shares": 3816,
    "rejected_shares": 0,
    "accepted_work": 6025337965,
    "rejected_work": 0,
    "delivered_hash_days": 299521174839564,
    "best_share": 2448827500,
    "last_share": 1793176337
  },
  "downstream": {
    "hashrate_1m": 0,
    "hashrate_5m": 0,
    "hashrate_15m": 0,
    "hashrate_1hr": 0,
    "hashrate_6hr": 0,
    "hashrate_1d": 0,
    "hashrate_7d": 0,
    "sps_1m": 0,
    "sps_5m": 0,
    "sps_15m": 0,
    "sps_1hr": 0,
    "accepted_shares": 0,
    "rejected_shares": 0,
    "accepted_work": 0,
    "rejected_work": 0,
    "delivered_hash_days": 0,
    "best_share": null,
    "last_share": null
  },
  "sessions": []
}`,
  },
  {
    method: 'POST',
    path: '/order',
    description:
      'Creates an order for a fixed amount of work at the current hashprice. Responds 201 with a payment address and amount; the order activates once the payment confirms. Pay exactly payment_amount sats to payment_address; do not rely on an independently calculated total. ',
    body: [
      { name: 'upstream_target.endpoint', type: 'string', description: 'Stratum endpoint, e.g. parasite.wtf:42068.' },
      { name: 'upstream_target.username', type: 'string', description: 'Stratum username, typically <address>.<worker>.' },
      { name: 'upstream_target.password', type: 'string | null', description: 'Stratum password, if any.' },
      { name: 'hash_days', type: 'number', description: <>Positive finite amount of work in hashdays (<Unit>Hd</Unit>). <Num>1</Num> <Unit>PHd</Unit> = <Num>1e15</Num> <Unit>Hd</Unit>.</> },
    ],
    curl: `curl -s -X POST ${BASE_URL}/order \\
  -H "Content-Type: application/json" \\
  -d '{
    "upstream_target": {
      "endpoint": "parasite.wtf:42068",
      "username": "bc1qyouraddress.yourworker",
      "password": null
    },
    "hash_days": 10000000000000000
  }'`,
    response: `{
  "order_id": 43,
  "payment_address": "bc1q...",
  "payment_amount": 470510,
  "hash_price": 47051
}`,
  },
];

function MethodBadge({ method }: { method: EndpointDoc['method'] }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 font-mono text-xs font-semibold ${method === 'GET'
        ? 'bg-foreground text-background'
        : 'border border-foreground text-foreground'
        }`}
    >
      {method}
    </span>
  );
}

function ParamTable({ title, params }: { title: string; params: ParamDoc[] }) {
  return (
    <>
      <h3 className="text-sm font-semibold mt-4 mb-2">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-foreground border-b border-border">
              <th className="py-1 pr-4 font-medium">Name</th>
              <th className="py-1 pr-4 font-medium">Type</th>
              <th className="py-1 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {params.map(param => (
              <tr key={param.name} className="border-b border-border/50 align-top">
                <td className="py-1.5 pr-4 font-mono text-xs whitespace-nowrap">{param.name}</td>
                <td className="py-1.5 pr-4 font-mono text-xs text-foreground whitespace-nowrap">{param.type}</td>
                <td className="py-1.5 text-foreground">{param.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function EndpointsSection() {
  return (
    <DocsSection id="endpoints" title="Endpoints">
      <p className="text-foreground">
        All endpoints are
        relative to <code className="font-mono text-sm bg-secondary border border-border px-1.5 py-0.5">{BASE_URL}</code>.
      </p>
      <p className="text-foreground">
        <code className="font-mono text-sm">hashrate</code>, <code className="font-mono text-sm">accepted_work</code>, and{' '}
        <code className="font-mono text-sm">hash_days</code> are approximate floating-point values.{' '}
        <code className="font-mono text-sm">hash_price</code> and{' '}
        <code className="font-mono text-sm">payment_amount</code> are exact integer sats. Make sure to pay the exact{' '}
        <code className="font-mono text-sm">payment_amount</code> returned by the API.
      </p>
      <p className="text-foreground">
        For conversions, see{' '}
        <a href="https://github.com/parasitepool/parastats/blob/master/app/utils/hashmath.ts" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">hashmath.ts</a>,{' '}
        <a href="https://github.com/parasitepool/para/blob/master/src/hash.rs" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">hash.rs</a>, or the{' '}
        <Link href="/refinery#calculator" className="underline hover:text-foreground">calculator</Link>.
      </p>
      <div className="space-y-3">
        {ENDPOINTS.map(endpoint => (
          <details
            key={`${endpoint.method} ${endpoint.path}`}
            className="group bg-secondary border border-border open:pb-4"
          >
            <summary className="flex items-center gap-3 p-3 cursor-pointer select-none hover:bg-secondary-hover list-none">
              <span className="text-foreground group-open:rotate-90 transition-transform">▶</span>
              <MethodBadge method={endpoint.method} />
              <code className="font-mono text-sm font-semibold break-all">{endpoint.path}</code>
            </summary>
            <div className="px-3 sm:px-4">
              <h3 className="text-sm font-semibold mb-1">Description</h3>
              <p className="text-foreground text-sm">{endpoint.description}</p>
              {endpoint.params && <ParamTable title="Parameters" params={endpoint.params} />}
              {endpoint.body && <ParamTable title="Request body (JSON)" params={endpoint.body} />}
              {endpoint.details}
              <h3 className="text-sm font-semibold mt-4 mb-2">Example</h3>
              <CodeBlock code={endpoint.curl} language="shell" />
              <div className="mt-2">
                <CodeBlock code={endpoint.response} language="json" />
              </div>
              {endpoint.responseNote && (
                <p className="text-foreground text-sm mt-2">{endpoint.responseNote}</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </DocsSection>
  );
}
