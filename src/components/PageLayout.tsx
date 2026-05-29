'use client';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

const PageLayout = ({ children }: PageLayoutProps) => (
  <div translate="no">{children}</div>
);

export default PageLayout;
