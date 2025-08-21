export const cn = (...a: (string | undefined | false | null)[]) =>
  a.filter(Boolean).join(" ");
