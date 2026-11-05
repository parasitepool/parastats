import DocsSection from './DocsSection';
import HashrateSimulator from './HashrateSimulator';
import LiveHashPrice from './LiveHashPrice';
import { Num, Term, Unit } from './Typography';

export default function OverviewSection() {
  return (
    <DocsSection id="overview" title="Overview">
      <p className="text-foreground">
        The Refinery aggregates <Term>hashrate</Term> from miners and distributes it as fixed-size
        orders of <Term>hashwork</Term>, denominated in <Term>hashdays</Term>. The standard unit is the petahash-day
        (<Unit>PHd</Unit>), currently priced at <LiveHashPrice />. Placing an order means accepting the posted <Term>hashprice</Term>.
      </p>
      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 text-foreground sm:grid-cols-[9rem_1fr]">
        <dt className="font-semibold">
          <Term>Hashrate</Term>
        </dt>
        <dd>
          Rate at which a miner computes SHA256d, measured in hashes per second. <Num>1</Num>{' '}
          <Unit>PH/s</Unit> = <Num>10<sup>15</sup></Num> hashes per second.
        </dd>

        <dt className="font-semibold">
          <Term>Hashwork</Term>
        </dt>
        <dd>
          Raw accumulated work from accepted shares (1 unit = {' '}
          <Num>2<sup>32</sup></Num> hashes). Example: <Num>100</Num> shares at pool
          difficulty <Num>1,000</Num> produce <Num>100,000</Num> units of hashwork, approximately{' '}
          <Num>429 trillion</Num> hashes.
        </dd>

        <dt className="font-semibold">
          <Term>Hashdays</Term>
        </dt>
        <dd>
          Hashwork expressed as hashrate sustained for one day. <Num>1</Num> <Unit>PHd</Unit> = <Num>1</Num>{' '}
          <Unit>PH/s</Unit> for 1 full day (= <Num>10<sup>15</sup></Num>{' '}
          <Unit>Hd</Unit> = <Num>20.12 G</Num> units of hashwork).
        </dd>

        <dt className="font-semibold">
          <Term>Hashprice</Term>
        </dt>
        <dd>
          Price of hashwork, in satoshis per petahash-day (<Unit>sats/PHd</Unit>). All pricing
          is variable and subject to change based on, but not limited to, network difficulty, bitcoin price, and market demand.
        </dd>
      </dl>
      <HashrateSimulator />
    </DocsSection>
  );
}
