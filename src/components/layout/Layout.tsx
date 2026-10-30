import { ReactNode } from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
}

export function Layout({ children, hideHeader = false }: LayoutProps) {
  return (
    <div className={`flex min-h-screen flex-col${hideHeader ? ' h-[100dvh] min-h-0 overflow-hidden' : ''}`}>
      {!hideHeader && <Header />}
      <main className={`flex-1${hideHeader ? ' min-h-0 overflow-hidden' : ''}`}>
        {children}
      </main>
    </div>
  );
}
