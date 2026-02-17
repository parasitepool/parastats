"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/app/hooks/useWallet";

interface Eligibility {
    username: string;
    has_1t: boolean;
    has_10t: boolean;
    slots: number;
    assigned_utxos: string[];
    assigned_inscription_ids: string[];
    claimed_tiers: string[];
}

interface DispenserClaimProps {
    userId: string;
    className?: string;
}

export default function DispenserClaim({ userId, className = "" }: DispenserClaimProps) {
    const { address, isInitialized } = useWallet();
    const [eligibility, setEligibility] = useState<Eligibility | null>(null);
    const [loading, setLoading] = useState(true);
    const [claimingTier, setClaimingTier] = useState<string | null>(null);
    const [claimedTiers, setClaimedTiers] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [txHex, setTxHex] = useState<string | null>(null);

    const isOwner = address === userId;

    const fetchEligibility = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/dispenser/eligibility/${encodeURIComponent(userId)}`, {
                cache: "no-store",
            });
            if (response.ok) {
                const data: Eligibility = await response.json();
                setEligibility(data);
                if (data.claimed_tiers?.length) {
                    setClaimedTiers((prev) => {
                        const next = new Set(prev);
                        data.claimed_tiers.forEach((t) => next.add(t));
                        return next;
                    });
                }
            } else {
                setEligibility(null);
            }
        } catch (err) {
            console.error("Error fetching dispenser eligibility:", err);
            setEligibility(null);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (isInitialized) {
            fetchEligibility();
        }
    }, [isInitialized, fetchEligibility]);

    const handleClaim = async (tier: string) => {
        if (!address) return;

        setClaimingTier(tier);
        setError(null);
        setTxHex(null);

        try {
            const { request, MessageSigningProtocols, AddressPurpose } = await import("@sats-connect/core");

            const accountsResponse = await request("getAccounts", {
                purposes: [AddressPurpose.Ordinals],
                message: "Select your Ordinals address for the dispenser",
            });

            if (accountsResponse.status !== "success") {
                throw new Error("Failed to get Ordinals address from wallet");
            }

            const ordinalsAccount = accountsResponse.result.find(
                (addr) => addr.purpose === AddressPurpose.Ordinals
            );

            if (!ordinalsAccount) {
                throw new Error("No Ordinals address found in wallet");
            }

            const destinationAddress = ordinalsAccount.address;
            const message = `${userId}|${tier}|${destinationAddress}`;

            const signResponse = await request("signMessage", {
                address: address,
                message: message,
                protocol: MessageSigningProtocols.BIP322,
            });

            if (signResponse.status !== "success") {
                throw new Error("Failed to sign message");
            }

            let signature: string;
            if (
                signResponse.result &&
                typeof signResponse.result === "object" &&
                "signature" in signResponse.result
            ) {
                signature = signResponse.result.signature;
            } else {
                throw new Error("Unexpected signature format");
            }

            const response = await fetch("/api/dispenser/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: userId,
                    tier,
                    destination_address: destinationAddress,
                    signature,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to submit claim");
            }

            setTxHex(data.hex);
            setClaimedTiers((prev) => new Set(prev).add(tier));
        } catch (err) {
            console.error("Claim error:", err);
            setError(err instanceof Error ? err.message : "Failed to claim");
        } finally {
            setClaimingTier(null);
        }
    };

    // Don't render anything while loading or if not eligible
    if (loading || !eligibility) return null;

    const tiers: { key: string; label: string; eligible: boolean; index: number }[] = [
        { key: "1T", label: "1 Tera", eligible: eligibility.has_1t, index: 0 },
        { key: "10T", label: "10 Tera", eligible: eligibility.has_10t, index: 1 },
    ];

    const maxSlots = eligibility.assigned_utxos?.length ?? 0;
    const eligibleTiers = tiers.filter((t) => t.eligible).slice(0, maxSlots);
    if (eligibleTiers.length === 0) return null;

    return (
        <div className={`bg-background p-4 sm:p-6 shadow-md border border-border ${className}`}>
            <div className="flex items-center mb-4 sm:mb-6">
                <div className="flex items-center">
                    <div className="mr-2 text-accent-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                            />
                        </svg>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold">Dispenser</h2>
                </div>
            </div>

            <div className={`grid gap-4 sm:gap-6 ${eligibleTiers.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {eligibleTiers.map((tier) => {
                    const claimed = claimedTiers.has(tier.key);
                    const claiming = claimingTier === tier.key;
                    const inscriptionId =
                        eligibility.assigned_inscription_ids?.[tier.index] ?? null;

                    return (
                        <div key={tier.key} className="flex flex-col">
                            <h3 className="text-sm font-medium text-accent-2 mb-2">{tier.label} Tier</h3>
                            <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex flex-col items-center gap-3">
                                {inscriptionId && (
                                    <a href={`https://ordinals.com/inscription/${inscriptionId}`}>
                                        <img
                                            src={`https://ordinals.com/content/${inscriptionId}`}
                                            alt={`${tier.label} inscription`}
                                            className="w-full max-w-[200px] aspect-square bg-transparent"
                                            style={{ imageRendering: "pixelated" }}
                                        />
                                    </a>
                                )}
                                <div className="flex items-center justify-between w-full">
                                    <p className="text-lg sm:text-xl font-semibold">
                                        {claimed ? (
                                            <span className="text-green-500">Claimed</span>
                                        ) : (
                                            "Eligible"
                                        )}
                                    </p>
                                    {isOwner && !claimed && (
                                        <button
                                            onClick={() => handleClaim(tier.key)}
                                            disabled={claiming || claimingTier !== null}
                                            className="flex items-center gap-1 px-2 py-1 bg-foreground text-background hover:bg-foreground/80 transition-colors text-xs font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {claiming ? "Signing..." : "Claim"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {txHex && (
                <div className="mt-4">
                    <h3 className="text-sm font-medium text-accent-2 mb-2">Transaction</h3>
                    <div className="bg-secondary p-3 sm:p-4 border border-border">
                        <p className="text-xs font-mono break-all text-foreground/70">{txHex}</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-4 text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                    {error}
                </div>
            )}
        </div>
    );
}