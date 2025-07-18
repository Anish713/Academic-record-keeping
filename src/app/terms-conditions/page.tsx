'use client';

import MainLayout from '@/components/layout/MainLayout';

export default function TermsConditionsPage() {
  return (
    <MainLayout>
      <div className="py-16 px-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Terms and Conditions</h1>
        
        <div className="space-y-6 text-white">
          <p className="italic text-sm text-center mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          
          <p>
            Welcome to CertiChain. These Terms and Conditions govern your use of our blockchain-based academic record-keeping platform and services. By accessing or using CertiChain, you agree to be bound by these Terms.
          </p>
          
          <h2 className="text-xl font-semibold mt-8 mb-4">Definitions</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>"Platform"</strong> refers to the CertiChain website, applications, and services.</li>
            <li><strong>"User"</strong> refers to any individual or entity that accesses or uses the Platform.</li>
            <li><strong>"Academic Records"</strong> refers to educational credentials, certificates, degrees, or other academic achievements stored on the blockchain through our Platform.</li>
          </ul>
          
          <h2 className="text-xl font-semibold mt-8 mb-4">Account Registration</h2>
          <p>
            To use certain features of the Platform, you must register for an account and connect a blockchain wallet. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. You agree to provide accurate and complete information during registration and to update such information as necessary.
          </p>
          
          <h2 className="text-xl font-semibold mt-8 mb-4">Blockchain Transactions</h2>
          <p>
            You understand that transactions on the blockchain are irreversible and immutable. CertiChain is not responsible for any errors in the information you provide for blockchain transactions. You are solely responsible for verifying the accuracy of all information before confirming any transaction.
          </p>
          
          <h2 className="text-xl font-semibold mt-8 mb-4">User Responsibilities</h2>
          <p>
            As a user of CertiChain, you agree to:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Provide accurate and truthful information</li>
            <li>Use the Platform only for lawful purposes</li>
            <li>Not attempt to manipulate or falsify academic records</li>
            <li>Not interfere with the proper operation of the Platform</li>
            <li>Not infringe upon the intellectual property rights of others</li>
            <li>Maintain the security of your blockchain wallet and private keys</li>
          </ul>
          
          <h2 className="text-xl font-semibold mt-8 mb-4">Intellectual Property</h2>
          <p>
            All content, features, and functionality of the Platform, including but not limited to text, graphics, logos, and software, are the exclusive property of CertiChain and are protected by copyright, trademark, and other intellectual property laws.
          </p>
          
          <h2 className="text-xl font-semibold mt-8 mb-4">Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, CertiChain shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or use, arising out of or in connection with your use of the Platform.
          </p>
          
          <h2 className="text-xl font-semibold mt-8 mb-4">Disclaimer of Warranties</h2>
          <p>
            The Platform is provided "as is" and "as available" without any warranties of any kind, either express or implied. CertiChain does not warrant that the Platform will be uninterrupted, error-free, or secure.
          </p>
          
          <h2 className="text-xl font-semibold mt-8 mb-4">Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which CertiChain is established, without regard to its conflict of law provisions.
          </p>
          
          <h2 className="text-xl font-semibold mt-8 mb-4">Changes to Terms</h2>
          <p>
            CertiChain reserves the right to modify these Terms at any time. We will provide notice of any material changes by posting the updated Terms on the Platform and updating the "Last Updated" date. Your continued use of the Platform after such changes constitutes your acceptance of the new Terms.
          </p>
          
          <h2 className="text-xl font-semibold mt-8 mb-4">Contact Us</h2>
          <p>
            If you have any questions about these Terms and Conditions, please contact us at <a href="mailto:anish@blockchain.com" className="text-navy-700 hover:underline">anish@blockchain.com</a>.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}