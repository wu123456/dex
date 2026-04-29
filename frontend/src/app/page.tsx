import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-12 py-16">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-4">
          <span className="text-indigo-400">DEX</span> Exchange
        </h1>
        <p className="text-zinc-400 text-lg max-w-md">
          Swap tokens and provide liquidity on a decentralized AMM exchange powered by constant product formula.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/swap"
          className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors"
        >
          Swap Tokens
        </Link>
        <Link
          href="/liquidity"
          className="px-8 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
        >
          Manage Liquidity
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-8 mt-8 max-w-2xl">
        <FeatureCard title="AMM Swap" description="Trade tokens instantly with the x·y=k constant product formula" />
        <FeatureCard title="Provide Liquidity" description="Earn fees by supplying token pairs to liquidity pools" />
        <FeatureCard title="0.3% Fee" description="Every swap contributes 0.3% to liquidity providers" />
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-zinc-500 text-sm">{description}</p>
    </div>
  );
}
