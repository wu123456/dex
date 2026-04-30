import { SwapCard } from "@/components/SwapCard";
import { PriceChart } from "@/components/PriceChart";

export default function SwapPage() {
  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <SwapCard />
      <PriceChart pair="" />
    </div>
  );
}
