"use client";
import clsx from "clsx";

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function Aurora({ className, ...rest }: Props) {
  return (
    <div
      aria-hidden
      {...rest}
      className={clsx("absolute inset-0 -z-40 pointer-events-none", className)}
    />
  );
}
