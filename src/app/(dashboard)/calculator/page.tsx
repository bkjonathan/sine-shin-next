import PriceCalculator from "@/components/dashboard/PriceCalculator";
import { PageHeader } from "@/components/layout/page-header";

export default function CalculatorPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Price Calculator"
        description="Calculate final prices with service fees and exchange rate."
      />
      <PriceCalculator />
    </div>
  );
}
