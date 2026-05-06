'use client';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

const PageLayout = ({ children }: PageLayoutProps) => <>{children}</>;

export default PageLayout;
