'use client';

import EnhancedApp from '../components/EnhancedApp';
import { Suspense } from 'react';

function PageContent() {
  return <EnhancedApp userId="default-user" />;
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #4171ff 0%, #00d4ff 100%)',
        color: 'white',
        fontSize: '1.5rem'
      }}>
        Loading...
      </div>
    }>
      <PageContent />
    </Suspense>
  );
}
