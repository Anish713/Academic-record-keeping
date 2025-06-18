import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';

interface RecordItemProps {
  studentName: string;
  type: 'Transcript' | 'Certificate';
  dateOfBirth: string;
  lastUpdated: string;
}

function RecordItem({ studentName, type, dateOfBirth, lastUpdated }: RecordItemProps) {
  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      <td className="py-4 px-6 text-sm text-gray-900">{studentName}</td>
      <td className="py-4 px-6 text-sm">
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${type === 'Transcript' ? 'bg-teal-100 text-teal-800' : 'bg-teal-100 text-teal-800'}`}>
          {type}
        </span>
      </td>
      <td className="py-4 px-6 text-sm text-gray-500">{dateOfBirth}</td>
      <td className="py-4 px-6 text-sm text-gray-500">{lastUpdated}</td>
      <td className="py-4 px-6 text-sm text-right">
        <button className="text-blue-600 hover:text-blue-900">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

export default function RecordsPage() {
  // Sample data - in a real app, this would come from the blockchain
  const records = [
    { studentName: 'Alex', type: 'Transcript' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
    { studentName: 'Alex Thapa', type: 'Certificate' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
    { studentName: 'Bob Shrestha', type: 'Certificate' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
    { studentName: 'Alice Khanal', type: 'Certificate' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
    { studentName: 'John Doe', type: 'Transcript' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
    { studentName: 'Joe Devkota', type: 'Transcript' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
    { studentName: 'Laxmi Prasad', type: 'Certificate' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
    { studentName: 'John Vohn Neuman', type: 'Transcript' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
    { studentName: 'Kriti', type: 'Certificate' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
    { studentName: 'Patrik Pokhrel', type: 'Transcript' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
    { studentName: 'Manish Manush', type: 'Certificate' as const, dateOfBirth: 'March 15, 2016', lastUpdated: 'March 15, 2016' },
  ];

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Records</h1>
          <Button variant="navy">
            New Record
          </Button>
        </div>

        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date of birth
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last updated
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record, index) => (
                  <RecordItem key={index} {...record} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}