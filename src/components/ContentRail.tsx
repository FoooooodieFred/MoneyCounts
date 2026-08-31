import type { ReactNode } from "react";

type ContentRailProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "main" | "section";
};

/** Centers page content in the main canvas column. */
export function ContentRail({ children, className, as: Tag = "div" }: ContentRailProps) {
  return <Tag className={`content-rail${className ? ` ${className}` : ""}`}>{children}</Tag>;
}
