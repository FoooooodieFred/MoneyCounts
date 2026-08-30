import type { ReactNode } from "react";

type SectionPageProps = {
  children: ReactNode;
  className?: string;
  "data-section"?: string;
};

/** Thin shell for section routes split out of the former single-page home scroll. */
export function SectionPage({ children, className, "data-section": dataSection }: SectionPageProps) {
  return (
    <div
      className={`app-shell app-shell--below-nav section-page-shell${className ? ` ${className}` : ""}`}
      data-section={dataSection}
    >
      <main className="app-main section-main">{children}</main>
    </div>
  );
}
