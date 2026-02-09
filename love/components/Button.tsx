import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

const baseClasses =
  "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`${baseClasses} bg-accent text-white hover:bg-accent-dark ${className}`}
    />
  );
}

export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`${baseClasses} border border-slate-200 bg-white text-ink hover:border-slate-300 ${className}`}
    />
  );
}

export function PrimaryLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`${baseClasses} bg-accent text-white hover:bg-accent-dark`}
    >
      {label}
    </Link>
  );
}
