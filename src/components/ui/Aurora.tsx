"use client";
import clsx from "clsx";

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function Aurora({ className, ...rest }: Props) {
  return (
    <div
      aria-hidden
      {...rest}
      className={clsx(
        "pointer-events-none absolute inset-0 -z-40", // <- behind content, cannot catch clicks
        className
      )}
    >
      {/* your aurora layers, canvas, svgs, etc. */}
    </div>
  );
}
