import { LimitOrderCard } from "@/components/LimitOrderCard";
import { OrderBook } from "@/components/OrderBook";

export default function LimitOrderPage() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-5xl mx-auto">
      <div className="flex-1 w-full">
        <LimitOrderCard />
      </div>
      <div className="flex-1 w-full">
        <OrderBook />
      </div>
    </div>
  );
}
