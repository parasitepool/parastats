'use client';

import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';

/**
 * DEBUG COMPONENT
 * Use this to test Lightning Balance integration step by step
 * Add this to your page temporarily to debug
 */
export default function LightningBalanceDebug() {
  const { address, isConnected } = useWallet();
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const API_TOKEN = process.env.NEXT_PUBLIC_BITBIT_API_TOKEN || 'TOKEN_REDACTED';
  const API_BASE_URL = 'https://api.bitbit.bot';

  // Test 1: Check if API token is set
  const testApiToken = () => {
    if (!API_TOKEN || API_TOKEN === 'TOKEN_REDACTED') {
      setTestResult('❌ FAILED: API token not set in .env.local');
    } else {
      setTestResult(`✅ API token is set: ${API_TOKEN.substring(0, 10)}...`);
    }
  };

  // Test 2: Check wallet connection
  const testWalletConnection = () => {
    if (isConnected && address) {
      setTestResult(`✅ Wallet connected: ${address}`);
    } else {
      setTestResult('❌ Wallet not connected. Connect your wallet first.');
    }
  };

  // Test 3: Try to fetch nonce (Step 1 of auth flow)
  const testNonceFetch = async () => {
    if (!address) {
      setTestResult('❌ No address. Connect wallet first.');
      return;
    }

    setIsLoading(true);
    setTestResult('Testing nonce fetch...');

    try {
      const url = `${API_BASE_URL}/login/string:${address}/auth_sign/${API_TOKEN}`;
      console.log('Fetching nonce from:', url);
      console.log('NOTE: Docs say GET, but server returns 405 for GET. Trying POST...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      // Server returns 405 for GET, trying POST
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address,
          email: '',
          public_key: ''
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setTestResult(`✅ SUCCESS! Nonce received: ${data.nonce.substring(0, 20)}...`);
        console.log('Full response:', data);
      } else {
        const errorText = await response.text();
        setTestResult(`❌ API returned error (${response.status}): ${errorText}\n\nNOTE: Waiting for BitBit devs to clarify correct endpoint format.`);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        setTestResult('❌ TIMEOUT: API took too long to respond (>10s). Check if api.bitbit.bot is accessible.');
      } else if (error instanceof Error) {
        setTestResult(`❌ ERROR: ${error.message}`);
      } else {
        setTestResult('❌ ERROR: Unknown error occurred');
      }
      console.error('Full error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Test 4: Check if BitBit API is reachable at all
  const testApiReachability = async () => {
    setIsLoading(true);
    setTestResult('Checking if BitBit API is reachable...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Try a simple HEAD request to see if domain resolves
      const response = await fetch(API_BASE_URL, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      setTestResult(`✅ BitBit API is reachable (Status: ${response.status})`);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        setTestResult('❌ TIMEOUT: Cannot reach api.bitbit.bot. Network or CORS issue?');
      } else if (error instanceof Error) {
        setTestResult(`❌ Cannot reach BitBit API: ${error.message}`);
      } else {
        setTestResult('❌ Cannot reach BitBit API: Unknown error');
      }
      console.error('Full error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background p-6 border-4 border-red-500 shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-red-500">⚠️ LIGHTNING BALANCE DEBUG</h2>
      
      <div className="space-y-4">
        {/* Status Display */}
        <div className="bg-secondary p-4 border border-border">
          <h3 className="font-semibold mb-2">Current Status:</h3>
          <div className="space-y-1 text-sm">
            <p>Wallet Connected: <strong>{isConnected ? '✅ Yes' : '❌ No'}</strong></p>
            <p>Address: <strong>{address || 'Not connected'}</strong></p>
            <p>API Token Set: <strong>{API_TOKEN !== 'TOKEN_REDACTED' ? '✅ Yes' : '❌ No'}</strong></p>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="space-y-2">
          <button
            onClick={testApiToken}
            className="w-full bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
          >
            Test 1: Check API Token
          </button>

          <button
            onClick={testWalletConnection}
            className="w-full bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
          >
            Test 2: Check Wallet Connection
          </button>

          <button
            onClick={testApiReachability}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            Test 3: Check API Reachability
          </button>

          <button
            onClick={testNonceFetch}
            disabled={isLoading || !address}
            className="w-full bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            Test 4: Fetch Nonce (Full Test)
          </button>
        </div>

        {/* Results Display */}
        {testResult && (
          <div className="bg-black text-green-400 p-4 border border-green-400 font-mono text-sm">
            <pre className="whitespace-pre-wrap">{testResult}</pre>
          </div>
        )}

        {isLoading && (
          <div className="text-center text-yellow-500">
            Testing... Please wait...
          </div>
        )}

        {/* Instructions */}
        <div className="bg-yellow-100 text-yellow-900 p-4 border border-yellow-400 text-sm">
          <h4 className="font-bold mb-2">⚠️ KNOWN ISSUE - Waiting for BitBit Devs:</h4>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Documentation says Step 1 should be GET</li>
            <li>Server returns 405 (Method Not Allowed) for GET</li>
            <li>Server only accepts POST and OPTIONS</li>
            <li>POST with various field combinations returns &quot;Missing required fields&quot;</li>
            <li>Need clarification on correct token and required fields</li>
          </ul>
          <h4 className="font-bold mb-2">Test Instructions:</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>Run Test 1 to verify your API token is set</li>
            <li>Run Test 2 to verify your wallet is connected</li>
            <li>Run Test 3 to check if BitBit API is reachable</li>
            <li>Run Test 4 to test with current best guess (will likely fail until devs respond)</li>
          </ol>
          <p className="mt-2 font-semibold">
            Check your browser console (F12) for detailed error messages!
          </p>
        </div>
      </div>
    </div>
  );
}
