import { ListPageSkeleton } from "@/components/skeletons";

export default function ExpensesLoading() {
  return <ListPageSkeleton pills={5} cols={5} />;
}
