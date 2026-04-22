import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[1rem] text-sm font-medium transition duration-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border border-emerald-300/30 bg-emerald-400/90 px-6 py-4 text-black shadow-[0_18px_40px_-22px_rgba(43,193,152,0.62)] hover:-translate-y-[1px] hover:bg-emerald-300",
        secondary:
          "border border-white/14 bg-white/[0.03] px-6 py-4 text-stone-100 backdrop-blur-sm hover:-translate-y-[1px] hover:border-white/28 hover:bg-white/[0.06]",
        ghost:
          "border border-transparent px-0 py-0 text-stone-300 hover:text-stone-100"
      }
    },
    defaultVariants: {
      variant: "primary"
    }
  }
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
}
