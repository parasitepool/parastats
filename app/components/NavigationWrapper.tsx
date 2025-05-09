'use client';

import { useRouter } from "next/navigation";
import Navigation from "./Navigation";
import { isValidBitcoinAddress } from "../utils/validators";
import { useState } from "react";

export default function NavigationWrapper() {
  const router = useRouter();
  
  // State for modal and input in the wrapper to persist across navigation
  const [address, setAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  // Handle address validation and navigation
  const handleAddressSubmit = async (submittedAddress: string) => {
    const trimmedAddress = submittedAddress.trim();
    
    if (!trimmedAddress) {
      setErrorMessage('Please enter a Bitcoin address');
      setShowModal(true);
      return;
    }
    
    if (isValidBitcoinAddress(trimmedAddress)) {
      try {
        // Try to add the address to monitoring
        const response = await fetch('/api/user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ address: trimmedAddress })
        });

        if (!response.ok && response.status !== 200) { // 200 means already monitored, which is fine
          const data = await response.json();
          if (response.status === 429) {
            setErrorMessage('Too many addresses added recently. Please try again later.');
            setShowModal(true);
            return;
          } else {
            console.error('Error adding address to monitoring:', data.error);
          }
        }

        // Proceed with navigation regardless of whether the address was newly added or already monitored
        setShowModal(false);
        router.push(`/user/${trimmedAddress}`);
      } catch (error) {
        console.error('Error adding address to monitoring:', error);
        setErrorMessage('Failed to add address to monitoring. Please try again.');
        setShowModal(true);
      }
    } else {
      setErrorMessage('Invalid Bitcoin address. Please check and try again.');
      setShowModal(true);
    }
  };
  
  return (
    <Navigation 
      address={address}
      setAddress={setAddress}
      errorMessage={errorMessage}
      showModal={showModal}
      setShowModal={setShowModal}
      onAddressSubmit={handleAddressSubmit}
    />
  );
} 