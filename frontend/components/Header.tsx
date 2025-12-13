'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import SearchBar from './SearchBar';
import styles from './Header.module.css';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only show tooltip on home page
    if (pathname === '/' && !tooltipDismissed) {
      tooltipTimeoutRef.current = setTimeout(() => {
        setShowTooltip(true);
      }, 5000);

      return () => {
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
        }
      };
    } else {
      setShowTooltip(false);
    }
  }, [pathname, tooltipDismissed]);

  const handleSearchFocus = () => {
    setShowTooltip(false);
    setTooltipDismissed(true);
  };

  const handleContactClick = () => {
    router.push('/contact-us');
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        {/* Logo - Left */}
        <div className={styles.logo} onClick={() => router.push('/')}>
          <svg width="120" height="40" viewBox="0 0 120 40" fill="none">
            <text x="0" y="30" fontSize="16" fontWeight="700" fill="#008BFF" fontFamily="Montserrat">
              i2e Consulting
            </text>
          </svg>
        </div>

        {/* Navigation Menu */}
        <nav className={styles.nav}>
          <span className={styles.navLink}>Services</span>
          <span className={styles.navLink}>Solutions</span>
          <span className={styles.navLink}>Technologies</span>
          <span className={styles.navLink}>Resource Center</span>
          <span className={styles.navLink}>About i2e</span>
        </nav>

        {/* Search Bar */}
        <div 
          className={styles.searchWrapper} 
          ref={searchBarRef}
          onFocus={handleSearchFocus}
        >
          <SearchBar isHeader={true} />
          
          {/* Tooltip */}
          {showTooltip && (
            <div className={styles.tooltip}>
              <div className={styles.tooltipArrow}></div>
              <span>Need help in looking for something?</span>
            </div>
          )}
        </div>

        {/* Contact Us Button - Right */}
        <a 
          href="https://i2econsulting.com/contact-us" 
          target="_blank" 
          rel="noopener noreferrer"
          className={styles.contactButton}
        >
          Contact us
        </a>
      </div>
    </header>
  );
}

