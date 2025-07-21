import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  image: string;
  description: React.ReactElement;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Secure Record Management',
    image: '/img/diagrams/record-lifecycle.png',
    description: (
      <>
        Store and manage academic records securely on the blockchain with 
        immutable storage and cryptographic verification.
      </>
    ),
  },
  {
    title: 'Role-Based Access',
    image: '/img/diagrams/user-roles-diagram.png',
    description: (
      <>
        Different user roles with custom permissions for universities,
        administrators, students, and third parties.
      </>
    ),
  },
  {
    title: 'IPFS Document Storage',
    image: '/img/diagrams/document-storage-workflow.png',
    description: (
      <>
        Decentralized document storage using IPFS ensures your records 
        are always accessible and cannot be tampered with.
      </>
    ),
  },
];

function Feature({title, image, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img className={styles.featureSvg} src={image} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): React.ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
