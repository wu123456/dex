import { LimitOrderCard } from "@/components/LimitOrderCard";
import { OrderBook } from "@/components/OrderBook";

export default function LimitOrderPage() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-4xl mx-auto">
      <div className="flex-1">
        <LimitOrderCard />
      </div>
      <div className="flex-1">
        <OrderBook />
      </div>
    </div>
  );
}
