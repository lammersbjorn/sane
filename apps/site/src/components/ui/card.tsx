import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] shadow-[0_20px_55px_-35px_rgba(0,0,0,0.72)]",
        className
      )}
      {...props}
    />
  );
}
