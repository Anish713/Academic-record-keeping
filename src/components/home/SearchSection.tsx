"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function SearchSection() {
  const [recordId, setRecordId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recordId.trim()) return;
    
    setIsSearching(true);
    
    router.push(`/verify?id=${recordId}`);
  };

  return (
    <section className="w-full py-16 px-6 bg-teal-500">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Record ID</h2>
        </div>
        
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
            placeholder="24242424"
            className="flex-grow px-4 py-3 rounded-md border-2 border-navy-700 focus:ring-2 focus:ring-navy-700 text-gray-900 hover:bg-accent"
            required
          />
          <Button 
            type="submit" 
            variant="outline"
            className="px-8 py-3 bg-navy-700 text-white rounded-md hover:bg-navy-800 transition-colors"
          >
            Find
          </Button>
        </form>
      </div>
    </section>
  );
}