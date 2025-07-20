"use client";

import React from "react";

/**
 * Renders a static informational page describing the CertiChain platform, its mission, vision, operational overview, and key features.
 *
 * This component displays styled content about CertiChain's use of blockchain for secure academic record storage and verification, including a feature list and explanatory sections.
 *
 * @returns A React element containing the About page content for CertiChain.
 */
export default function About() {
  return (
    <div className="py-16 px-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center text-white">
        About CertiChain
      </h1>

      <div className="space-y-6 text-white">
        <p>
          CertiChain is a revolutionary platform that leverages blockchain
          technology to securely store and verify academic records. Our mission
          is to create a transparent, immutable, and easily accessible system
          for educational credentials.
        </p>

        <h2 className="text-2xl text-white font-semibold mt-8 mb-4">
          Our Vision
        </h2>
        <p>
          We envision a world where academic credentials are universally
          verifiable, impossible to falsify, and accessible to authorized
          parties at any time. By utilizing blockchain technology, we eliminate
          the need for time-consuming verification processes and reduce the risk
          of credential fraud.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">
          How It Works
        </h2>
        <p>
          CertiChain stores academic records on the blockchain, creating a
          permanent and tamper-proof record of achievements. Universities and
          educational institutions can issue credentials directly on our
          platform, while students and employers can instantly verify the
          authenticity of these records.
        </p>

        <div className="mt-8 bg-gray-50 p-6 rounded-lg border text-black border-gray-200">
          <h3 className="text-xl font-semibold mb-4">Key Features</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Immutable Records:</strong> Once stored on the blockchain,
              records cannot be altered or deleted.
            </li>
            <li>
              <strong>Instant Verification:</strong> Verify the authenticity of
              academic credentials in seconds.
            </li>
            <li>
              <strong>Secure Access Control:</strong> Students maintain control
              over who can access their records.
            </li>
            <li>
              <strong>University Dashboard:</strong> Educational institutions
              can easily manage and issue credentials.
            </li>
            <li>
              <strong>Transparent System:</strong> All actions are recorded on
              the blockchain, ensuring complete transparency.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
