import { ShieldCheckIcon, DocumentTextIcon, ClockIcon, LockClosedIcon } from '@heroicons/react/24/outline';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="w-12 h-12 text-teal-600 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 text-gray-700">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

export default function FeaturesSection() {
  const features = [
    {
      icon: <ShieldCheckIcon className="w-full h-full" />,
      title: 'Tamper-Proof Records',
      description: 'Academic records stored on blockchain cannot be altered or falsified, ensuring authenticity.'
    },
    {
      icon: <DocumentTextIcon className="w-full h-full" />,
      title: 'Easy Verification',
      description: 'Instantly verify the authenticity of academic credentials with a simple search.'
    },
    {
      icon: <ClockIcon className="w-full h-full" />,
      title: '24/7 Accessibility',
      description: 'Access your academic records anytime, anywhere without depending on institution availability.'
    },
    {
      icon: <LockClosedIcon className="w-full h-full" />,
      title: 'Privacy Control',
      description: 'Students maintain control over who can access and verify their academic records.'
    }
  ];

  return (
    <section className="w-full py-16 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-black mb-4">Features</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Our blockchain-based academic record system offers several advantages over traditional methods.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}