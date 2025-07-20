"use client";

import MainLayout from "@/components/layout/MainLayout";

/**
 * Renders the CertiChain privacy policy page with detailed information about data collection, usage, blockchain data handling, user rights, and contact details.
 *
 * Displays a dynamically generated "Last Updated" date and organizes the policy content into clearly structured sections for user reference.
 *
 * @returns The privacy policy page as a React element.
 */
export default function PrivacyPolicyPage() {
  return (
    <MainLayout>
      <div className="py-16 px-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Privacy Policy</h1>

        <div className="space-y-6 text-white-700">
          <p className="italic text-sm text-center mb-8">
            Last Updated:{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>

          <p>
            At CertiChain, we take your privacy seriously. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your
            information when you use our blockchain-based academic
            record-keeping service.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">
            Information We Collect
          </h2>
          <p>
            We collect information that you provide directly to us when you:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Create an account or profile</li>
            <li>Connect your blockchain wallet</li>
            <li>Submit academic records for verification</li>
            <li>Communicate with us directly</li>
          </ul>

          <p className="mt-4">
            This information may include your name, email address, wallet
            address, and academic credentials. Additionally, we automatically
            collect certain information about your device and how you interact
            with our platform.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">Blockchain Data</h2>
          <p>
            Please be aware that information stored on the blockchain is
            immutable and public. While we implement access controls for
            sensitive data, the transaction history related to your records will
            be permanently stored on the blockchain and visible to anyone with
            access to the blockchain network.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">
            How We Use Your Information
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide, maintain, and improve our services</li>
            <li>To verify and authenticate academic records</li>
            <li>To communicate with you about our services</li>
            <li>To comply with legal obligations</li>
            <li>To prevent fraud and protect the security of our platform</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-4">
            Data Sharing and Disclosure
          </h2>
          <p>We may share your information with:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>
              Educational institutions that need to verify your credentials
            </li>
            <li>Service providers who perform services on our behalf</li>
            <li>Third parties when required by law or to protect our rights</li>
            <li>Other users with whom you choose to share your records</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-4">
            Your Rights and Choices
          </h2>
          <p>
            You have certain rights regarding your personal information,
            including the right to access, correct, or delete your data (where
            possible, considering the immutable nature of blockchain). You can
            also choose which records to share and with whom. IMPORTANT: This
            project is just a test project as of now and is not intended for
            production uses as of now, you are at your own risk if you are using
            this in current release version.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">Security</h2>
          <p>
            We implement appropriate technical and organizational measures to
            protect your personal information. However, no method of
            transmission over the Internet or electronic storage is 100% secure,
            so we cannot guarantee absolute security.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">
            Changes to This Privacy Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of any changes by posting the new Privacy Policy on this page
            and updating the "Last Updated" date.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact
            us at{" "}
            <a
              href="mailto:anish@blockchain.com"
              className="text-navy-700 hover:underline"
            >
              anish@blockchain.com
            </a>
            .
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
