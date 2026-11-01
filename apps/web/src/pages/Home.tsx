import { useState } from 'react';
import { Link } from 'react-router';
import { ParcelScene } from '../components/ParcelScene';
import { REPOSITORY_URL } from '../lib/config';
import './home.css';

export function Home() {
  return (
    <>
      <Hero />
      <ModulesStrip />
      <Problem />
      <Approach />
      <Proofs />
      <HowItWorks />
      <UseCases />
      <Developers />
      <Pricing />
      <Limits />
      <Faq />
      <Closing />
    </>
  );
}

function Hero() {
  const [edited, setEdited] = useState(false);
  return (
    <section className="hero page" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="label hero-eyebrow">
          <span className="rec-dot" aria-hidden="true" /> Capture-time evidence on Portaldot V3
        </p>
        <h1 id="hero-title" className="display">
          Photographs
          <br />
          that can <span className="italic">testify.</span>
        </h1>
        <p className="lede">
          Witness seals a photo the moment it is taken: who took it, when, and every pixel. The
          record lives on Portaldot, so neither side of a dispute controls it. Not even us.
        </p>
        <div className="hero-actions">
          <Link to="/capture" className="btn">
            Capture a photo
          </Link>
          <Link to="/verify" className="btn btn-secondary">
            Verify an image
          </Link>
        </div>
        <p className="hero-footnote muted">
          Free to verify. No wallet, no crypto, no account. Verification runs in your browser.
        </p>
      </div>

      <div className="specimen">
        <div className="specimen-toolbar">
          <span className="label">Example record</span>
          <div className="segmented" role="radiogroup" aria-label="Image shown">
            <button
              type="button"
              role="radio"
              aria-checked={!edited}
              onClick={() => setEdited(false)}
            >
              Original
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={edited}
              onClick={() => setEdited(true)}
            >
              Edited copy
            </button>
          </div>
        </div>
        <div className="specimen-image cropmarks">
          <ParcelScene edited={edited} overlay={edited} />
        </div>
        <div className="specimen-record" aria-live="polite">
          <div className="specimen-verdict">
            <span className={`pill ${edited ? 'pill-bad' : 'pill-ok'}`}>
              {edited ? 'Altered' : 'Authentic'}
            </span>
            <span className="specimen-verdict-text">
              {edited
                ? 'One region differs from the sealed original.'
                : 'Bit-for-bit identical to the sealed original.'}
            </span>
          </div>
          <dl className="facts">
            <dt>Sealed</dt>
            <dd className="mono">Block 276,104 &middot; 12:41:07 UTC</dd>
            <dt>Signed by</dt>
            <dd className="mono">5HGjWAeF...mLqX &middot; delivery device</dd>
            <dt>{edited ? 'Changed' : 'Content'}</dt>
            <dd className="mono">
              {edited ? 'Front face, 2.0% of frame' : 'sha256 3f9a07c1...e2c4'}
            </dd>
          </dl>
        </div>
      </div>
    </section>
  );
}

function ModulesStrip() {
  const modules = [
    'TransactionStorage',
    'Revive (Solidity)',
    'Utility.batchAll',
    'Identity',
    'Ed25519 accounts',
  ];
  return (
    <section className="strip" aria-label="Portaldot modules used">
      <div className="page strip-inner">
        <span className="label">One capture, one atomic Portaldot transaction</span>
        <ul className="strip-list">
          {modules.map((m) => (
            <li key={m} className="mono">
              {m}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SectionHead({
  index,
  kicker,
  title,
  children,
}: {
  index: string;
  kicker: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="section-head">
      <p className="label">
        <span className="section-index">{index}</span> {kicker}
      </p>
      <h2 className="h1">{title}</h2>
      {children ? <p className="lede">{children}</p> : null}
    </header>
  );
}

function Problem() {
  const stats = [
    {
      value: '99%',
      text: 'of insurers say they have encountered manipulated or AI-altered claim documentation.',
      source: 'Verisk, March 2026',
      href: 'https://www.verisk.com/company/newsroom/ai-editing-tools-are-fueling-a-new-era-of-insurance-fraud-according-to-new-research-from-verisk/',
    },
    {
      value: '36%',
      text: 'of consumers would consider editing a claim photo, even knowing it breaks the rules. 55% of Gen Z.',
      source: 'Verisk, March 2026',
      href: 'https://www.verisk.com/company/newsroom/ai-editing-tools-are-fueling-a-new-era-of-insurance-fraud-according-to-new-research-from-verisk/',
    },
    {
      value: '$3.7B',
      text: 'in documented deepfake fraud losses worldwide. Only publicly reported incidents are counted.',
      source: 'Surfshark research, 2026',
      href: 'https://www.brside.com/blog/deepfake-fraud-losses-2026',
    },
  ];
  return (
    <section className="section page" aria-labelledby="problem-title">
      <SectionHead
        index="01"
        kicker="The problem"
        title={<span id="problem-title">Fake evidence got cheap. Checking it did not.</span>}
      >
        A torn box, a cracked screen, a dented bumper: one prompt in a phone editor. Refund desks,
        claims teams and landlords now argue over pictures they cannot trust.
      </SectionHead>
      <div className="stats">
        {stats.map((s) => (
          <figure key={s.value} className="stat">
            <span className="stat-value">{s.value}</span>
            <figcaption>
              <p>{s.text}</p>
              <a className="stat-source label" href={s.href} rel="noreferrer" target="_blank">
                {s.source}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Approach() {
  const rows = [
    ['Question asked', 'Is this picture fake?', 'Is this the picture that was taken?'],
    ['Method', 'Classifiers guess from pixels', 'Signature and fingerprint made at capture'],
    [
      'Against better AI',
      'Gets worse every model release',
      'Unaffected: there is nothing to guess',
    ],
    ['Who holds the record', 'The vendor', 'Portaldot. Neither party, not even Witness'],
    ['Answer', 'A probability', 'Yes, no, or exactly which region changed'],
  ];
  return (
    <section className="section page" aria-labelledby="approach-title">
      <SectionHead
        index="02"
        kicker="The approach"
        title={<span id="approach-title">Detection is an arms race. Provenance ends it.</span>}
      >
        Every detector is one model release from obsolete. Witness does not try to spot fakes. It
        proves originals, at the moment they exist.
      </SectionHead>
      <div className="compare" role="table" aria-label="Detection compared with Witness">
        <div className="compare-row compare-header" role="row">
          <span role="columnheader" />
          <span role="columnheader" className="label">
            Detect after the fact
          </span>
          <span role="columnheader" className="label compare-ours">
            Witness, at capture
          </span>
        </div>
        {rows.map(([label, theirs, ours]) => (
          <div key={label} className="compare-row" role="row">
            <span role="rowheader" className="label">
              {label}
            </span>
            <span role="cell" className="compare-theirs">
              {theirs}
            </span>
            <span role="cell" className="compare-ours">
              {ours}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Proofs() {
  const proofs = [
    {
      name: 'When',
      body: 'The device embeds the latest finalized Portaldot block before signing, so the capture cannot be older. Anchoring proves it is no newer. Together they pin the moment to a window of seconds.',
      sample: 'block 276,102 -> anchored 276,104 (12 s)',
    },
    {
      name: 'Who',
      body: 'Every capture is signed with the device key, an Ed25519 account on Portaldot. Businesses can register their capture devices with on-chain Identity so verifiers see a name, not a key.',
      sample: 'ed25519 5HGjWAeF...mLqX',
    },
    {
      name: 'What',
      body: 'The exact file hash proves bit-for-bit originals. A 3,072-byte colour fingerprint survives re-compression and resizing, and pinpoints regions that were painted, removed or recoloured.',
      sample: 'sha256 3f9a07c1...e2c4 / dhash 8f3a11c077e29b45',
    },
  ];
  return (
    <section className="section page" aria-labelledby="proofs-title">
      <SectionHead
        index="03"
        kicker="What a capture proves"
        title={<span id="proofs-title">Three proofs, sealed in one transaction.</span>}
      />
      <div className="proofs">
        {proofs.map((p) => (
          <article key={p.name} className="proof">
            <h3 className="proof-name">{p.name}</h3>
            <p>{p.body}</p>
            <code className="proof-sample">{p.sample}</code>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="section page" aria-labelledby="how-title">
      <SectionHead
        index="04"
        kicker="How it works"
        title={<span id="how-title">From shutter to settlement in one block.</span>}
      >
        The capture is fingerprinted and signed on the device. The notary pays the fee and submits
        one atomic extrinsic: the signed evidence goes into TransactionStorage and its anchor into a
        Solidity registry, together or not at all.
      </SectionHead>
      <figure className="diagram panel">
        <ArchitectureDiagram />
        <figcaption className="label">
          The notary relays and pays. It cannot forge a capture: it never holds the device key.
        </figcaption>
      </figure>
      <ol className="flow">
        <li>
          <span className="flow-n mono">01</span>
          <strong>Capture.</strong> The camera frame becomes a JPEG on the device. Its SHA-256
          becomes the capture id.
        </li>
        <li>
          <span className="flow-n mono">02</span>
          <strong>Sign.</strong> A manifest with the hash, fingerprint and latest block is signed by
          the device key.
        </li>
        <li>
          <span className="flow-n mono">03</span>
          <strong>Anchor.</strong> <code>utility.batchAll</code> stores the envelope and calls{' '}
          <code>WitnessRegistry.anchor</code>. First write wins, forever.
        </li>
        <li>
          <span className="flow-n mono">04</span>
          <strong>Verify.</strong> Anyone drops in an image. The browser reads the chain directly
          and returns authentic, altered, reframed or no record.
        </li>
      </ol>
    </section>
  );
}

function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 960 300" className="arch" role="img" aria-labelledby="arch-title">
      <title id="arch-title">
        Device signs a capture, the notary submits one batch extrinsic to Portaldot that stores the
        envelope in TransactionStorage and anchors it in WitnessRegistry; verifiers read both.
      </title>
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="#15130F" />
        </marker>
      </defs>
      <g fontFamily="IBM Plex Sans, sans-serif" fontSize="14" fill="#15130F">
        <rect x="20" y="40" width="190" height="110" fill="#FBF9F4" stroke="#15130F" />
        <text x="36" y="68" fontWeight="600">
          Capture device
        </text>
        <text x="36" y="92" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#48433A">
          fingerprint + sha256
        </text>
        <text x="36" y="110" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#48433A">
          ed25519 signature
        </text>
        <circle cx="190" cy="58" r="5" fill="#D2451E" />

        <rect x="290" y="40" width="190" height="110" fill="#FBF9F4" stroke="#15130F" />
        <text x="306" y="68" fontWeight="600">
          Notary
        </text>
        <text x="306" y="92" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#48433A">
          validates, rate-limits
        </text>
        <text x="306" y="110" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#48433A">
          pays the fee
        </text>

        <rect x="560" y="20" width="380" height="170" fill="#EBE6DA" stroke="#15130F" />
        <text x="576" y="46" fontWeight="600">
          Portaldot V3
        </text>
        <text x="576" y="66" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#48433A">
          utility.batchAll, atomic
        </text>
        <rect x="576" y="82" width="166" height="88" fill="#FBF9F4" stroke="#15130F" />
        <text x="588" y="106" fontWeight="600" fontSize="13">
          TransactionStorage
        </text>
        <text x="588" y="128" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#48433A">
          signed envelope
        </text>
        <text x="588" y="146" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#48433A">
          native pallet
        </text>
        <rect x="758" y="82" width="166" height="88" fill="#FBF9F4" stroke="#15130F" />
        <text x="770" y="106" fontWeight="600" fontSize="13">
          WitnessRegistry
        </text>
        <text x="770" y="128" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#48433A">
          first-write anchor
        </text>
        <text x="770" y="146" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#48433A">
          Solidity on Revive
        </text>

        <rect x="560" y="230" width="380" height="54" fill="#FBF9F4" stroke="#15130F" />
        <text x="576" y="262" fontWeight="600">
          Verifier (any browser, any contract)
        </text>

        <line
          x1="210"
          y1="95"
          x2="286"
          y2="95"
          stroke="#15130F"
          strokeWidth="1.4"
          markerEnd="url(#arrow)"
        />
        <line
          x1="480"
          y1="95"
          x2="556"
          y2="95"
          stroke="#15130F"
          strokeWidth="1.4"
          markerEnd="url(#arrow)"
        />
        <line
          x1="659"
          y1="226"
          x2="659"
          y2="174"
          stroke="#15130F"
          strokeWidth="1.4"
          markerEnd="url(#arrow)"
          strokeDasharray="4 3"
        />
        <line
          x1="841"
          y1="226"
          x2="841"
          y2="174"
          stroke="#15130F"
          strokeWidth="1.4"
          markerEnd="url(#arrow)"
          strokeDasharray="4 3"
        />
        <text x="226" y="86" fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#777064">
          envelope
        </text>
        <text x="494" y="86" fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#777064">
          extrinsic
        </text>
        <text x="672" y="212" fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#777064">
          read
        </text>
        <text x="854" y="212" fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#777064">
          read
        </text>
      </g>
    </svg>
  );
}

function UseCases() {
  const cases = [
    {
      title: 'Returns and refunds',
      moment: 'Packing at the warehouse, unboxing at the door',
      stops: 'AI-painted damage on refund requests',
      buyer: 'Marketplaces, online shops',
    },
    {
      title: 'Deliveries',
      moment: 'Proof of delivery at the doorstep',
      stops: '"It never arrived" and "it arrived broken" disputes',
      buyer: 'Couriers, logistics platforms',
    },
    {
      title: 'Rentals',
      moment: 'Check-in and check-out photos, both sides',
      stops: 'Deposit fights over damage that was already there',
      buyer: 'Car, equipment and property rentals',
    },
    {
      title: 'Insurance claims',
      moment: 'First notice of loss, inspection photos',
      stops: 'Edited or recycled claim photos',
      buyer: 'Insurers, brokers, adjusters',
    },
  ];
  return (
    <section className="section page" aria-labelledby="cases-title">
      <SectionHead
        index="05"
        kicker="Where it pays"
        title={<span id="cases-title">Condition evidence, at the moment things change hands.</span>}
      >
        Witness starts where a photo decides who pays, and the cost of a fake is easy to measure.
      </SectionHead>
      <div className="cases">
        {cases.map((c) => (
          <article key={c.title} className="case">
            <h3 className="h3">{c.title}</h3>
            <dl>
              <dt className="label">Captured</dt>
              <dd>{c.moment}</dd>
              <dt className="label">Stops</dt>
              <dd>{c.stops}</dd>
              <dt className="label">Who pays</dt>
              <dd>{c.buyer}</dd>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

const SOLIDITY_SNIPPET = `// Release a refund only for evidence witnessed after the claim opened.
WitnessRegistry.Anchor memory a = registry.anchorOf(contentHash);
if (a.blockNumber == 0) revert EvidenceNotAnchored(contentHash);
if (a.blockNumber < claim.openedAt) revert EvidenceTooOld(a.blockNumber, claim.openedAt);
if (!trustedSubmitters[a.submitter]) revert UntrustedSubmitter(a.submitter);
claim.settled = true;
(bool ok, ) = claim.claimant.call{value: claim.payout}("");`;

const TS_SNIPPET = `import { verifyImage, RegistryClient, connectPortaldot } from '@witness/sdk';

const result = await verifyImage({ file, raster }, {
  registry: new RegistryClient(network),
  api: () => connectPortaldot(network.substrateRpc),
});

result.verdict.status; // 'authentic' | 'altered' | 'reframed' | 'invalid' | 'unverified'`;

function Developers() {
  const [tab, setTab] = useState<'solidity' | 'ts'>('solidity');
  return (
    <section className="section page" aria-labelledby="dev-title">
      <SectionHead
        index="06"
        kicker="For developers"
        title={<span id="dev-title">Evidence your contracts can read.</span>}
      >
        Any Solidity contract on Portaldot can gate money on witnessed evidence. The repository
        ships ClaimGate, a tested escrow that pays out only for fresh, trusted, unused captures.
      </SectionHead>
      <div className="code-card panel">
        <div className="code-tabs" role="tablist" aria-label="Code samples">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'solidity'}
            onClick={() => setTab('solidity')}
          >
            ClaimGate.sol
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ts'}
            onClick={() => setTab('ts')}
          >
            verify.ts
          </button>
          <Link to="/developers" className="code-more">
            Full reference
          </Link>
        </div>
        <pre className="code" role="tabpanel">
          <code>{tab === 'solidity' ? SOLIDITY_SNIPPET : TS_SNIPPET}</code>
        </pre>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: 'Personal',
      price: 'Free',
      unit: '',
      points: ['Unlimited verification', '20 sealed captures a month', 'Downloadable certificates'],
    },
    {
      name: 'Business',
      price: '$0.05',
      unit: 'per sealed capture',
      points: [
        'Capture SDK for your app',
        'Dispute dashboard and reports',
        'Registered device identities',
        '90-day evidence retention',
      ],
      featured: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      unit: '',
      points: [
        'Dedicated notary and SLA',
        'Retention plans up to 7 years',
        'On-chain policy contracts',
        'Batch anchoring',
      ],
    },
  ];
  return (
    <section className="section page" aria-labelledby="pricing-title">
      <SectionHead
        index="07"
        kicker="Pricing"
        title={<span id="pricing-title">Verification is free. Sealing is metered.</span>}
      >
        Businesses pay per capture, so cost follows usage. Every verified link a customer opens
        introduces Witness to someone new.
      </SectionHead>
      <div className="tiers">
        {tiers.map((t) => (
          <article key={t.name} className={`tier${t.featured ? ' tier-featured' : ''}`}>
            <h3 className="label">{t.name}</h3>
            <p className="tier-price">
              <span className="h2">{t.price}</span> <span className="muted">{t.unit}</span>
            </p>
            <ul>
              {t.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="label pricing-note">
        Pilot pricing for the testnet programme. Subject to change.
      </p>
    </section>
  );
}

function Limits() {
  const limits = [
    [
      'A screen can be photographed.',
      'Witness proves when and by which device a photo was taken, not that the scene was real. Mitigations: in-app capture only for the camera tier, device attestation on the roadmap, and registered business devices.',
    ],
    [
      'Imports are weaker evidence.',
      'Files imported from a gallery are labelled "import" in the signed manifest and in every verdict. Witness vouches for who and when, not for the camera.',
    ],
    [
      'The fingerprint is 32 by 32.',
      'Edits smaller than about one cell (0.1% of the frame) may pass the visual check. The exact SHA-256 match still catches any change to the original file.',
    ],
    [
      'Storage on chain is retained, then renewed.',
      'TransactionStorage keeps envelopes for about seven days unless renewed. The anchor is permanent, and the downloadable certificate keeps every capture verifiable.',
    ],
  ];
  return (
    <section className="section page" aria-labelledby="limits-title">
      <SectionHead
        index="08"
        kicker="Limits, stated plainly"
        title={<span id="limits-title">What Witness does not claim.</span>}
      />
      <div className="limits">
        {limits.map(([title, body]) => (
          <article key={title} className="limit">
            <h3 className="h3">{title}</h3>
            <p className="muted">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    [
      'Do I need a wallet or tokens?',
      'No. The notary pays the transaction fee. Your device holds a signing key that never leaves the browser, and verification is free and read-only.',
    ],
    [
      'Is my photo public?',
      'Not by default. The chain stores the hash, the fingerprint and the signature. A low-resolution preview is published only if you choose to include it.',
    ],
    [
      'What if Witness the company disappears?',
      'Every record stays on Portaldot and the verifier is open source. Your certificate plus any Portaldot node is enough to verify a capture.',
    ],
    [
      'Why Portaldot?',
      'It is the only place this fits in one transaction: native TransactionStorage holds the evidence, a Solidity registry on Revive makes it readable by contracts, and utility.batchAll binds them atomically.',
    ],
    [
      'Can the notary fake a capture?',
      'No. Captures are signed on the device and checked by every verifier. The notary can refuse to relay, which is why the protocol also accepts self-submitted captures.',
    ],
  ];
  return (
    <section className="section page narrow" aria-labelledby="faq-title">
      <header className="section-head">
        <h2 id="faq-title" className="h2">
          Questions
        </h2>
      </header>
      <div className="faq">
        {faqs.map(([q, a]) => (
          <details key={q} className="faq-item">
            <summary>{q}</summary>
            <p className="muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="closing page" aria-labelledby="closing-title">
      <div className="closing-inner">
        <h2 id="closing-title" className="h1">
          Take a photo the world can check.
        </h2>
        <div className="hero-actions">
          <Link to="/capture" className="btn">
            Capture a photo
          </Link>
          <a href={REPOSITORY_URL} className="btn btn-secondary">
            Read the source
          </a>
        </div>
      </div>
    </section>
  );
}
