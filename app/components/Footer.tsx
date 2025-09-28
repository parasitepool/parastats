"use client";

import React, {useEffect, useState} from "react";
import { Terminal } from "./eastereggs/Terminal";
import HelpModal from "./modals/HelpModal";
import {useRouter, useSearchParams} from "next/navigation";

const Footer = () => {
  const [showTerminal, setShowTerminal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
      if (searchParams.has('help')) {
          setShowHelpModal(true);

          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('help');
          const newUrl = `${window.location.pathname}${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''}`;
          router.replace(newUrl, { scroll: false });
      }
      }, [searchParams, router]);

  return (
    <footer className="pb-4">
      <div className="flex">
        <div className="w-4"></div>
        <div className="flex-1 text-center italic break-all">
          <span className="cursor-pointer" onClick={() => setShowHelpModal(true)}>Help</span>
        </div>
        <div
          className="text-foreground/5 cursor-pointer hover:text-foreground/50 transition-colors w-4 text-center"
          onClick={() => setShowTerminal(true)}
        >
          ₿
        </div>
      </div>

      {showTerminal && <Terminal onClose={() => setShowTerminal(false)} />}
        {/* Help Modal */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </footer>
  );
};

export default Footer;
