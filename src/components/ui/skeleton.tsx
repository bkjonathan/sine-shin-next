import { cn } from "@/lib/utils";

/**
 * Base shimmer block. Compose these to build route-level loading skeletons.
 * The `.skeleton` utility (globals.css) provides the animated sheen and
 * respects the "animations off" accessibility setting.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}
