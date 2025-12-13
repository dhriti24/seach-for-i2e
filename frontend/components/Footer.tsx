'use client';

import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        <div className={styles.footerContent}>
          <a href="https://i2econsulting.com" target="_blank" rel="noopener noreferrer" className={styles.websiteLink}>
            i2e Consulting Website
          </a>
        </div>
        <div className={styles.footerCopyright}>
          <p>© 2025 i2e Consulting. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
