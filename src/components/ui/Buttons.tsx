// src/components/ui/Buttons.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

function classesFor(variant: Variant, size: Size, block?: boolean, loading?: boolean) {
  const base = "btn";
  const variantClass =
    variant === "primary" ? "" :
    variant === "outline" ? "btn-outline" :
    variant === "ghost" ? "btn-ghost" :
    "btn-danger";
  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  const blockClass = block ? "w-full justify-center" : "";
  const loadingClass = loading ? "opacity-60 pointer-events-none" : "";
  return cn(base, variantClass, sizeClass, blockClass, loadingClass);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", block, leftIcon, rightIcon, loading, className, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(classesFor(variant, size, block, loading), className)}
        aria-busy={loading ? true : undefined}
        {...rest}
      >
        {leftIcon ? <span className="mr-2 inline-flex">{leftIcon}</span> : null}
        <span>{children}</span>
        {rightIcon ? <span className="ml-2 inline-flex">{rightIcon}</span> : null}
      </button>
    );
  }
);
Button.displayName = "Button";

export type ButtonLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block,
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(classesFor(variant, size, block, false), className)}
      {...rest}
    >
      {leftIcon ? <span className="mr-2 inline-flex">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span className="ml-2 inline-flex">{rightIcon}</span> : null}
    </Link>
  );
}
