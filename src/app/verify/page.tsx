import { Suspense } from 'react';
import VerifyPageContent from './VerifyPageContent';

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-white">Loading verification form...</div>}>
      <VerifyPageContent />
    </Suspense>
  );
}
