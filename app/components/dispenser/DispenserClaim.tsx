"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/app/hooks/useWallet";

interface Eligibility {
    username: string;
    tier_shares: Record<string, number>;
    override_slots: number;
    total_slots: number;
    assigned_utxos: Record<string, string[]>;
    assigned_inscription_ids: Record<string, string[]>;
    claims: Record<string, number[]>;
}

interface Slot {
    tier: string;
    utxo: string | null;
    inscriptionId: string;
    claimed: boolean;
    index: number;
    tierSlotIndex: number;
}

interface DispenserClaimProps {
    userId: string;
    className?: string;
}

function buildSlots(data: Eligibility): Slot[] {
    const slots: Slot[] = [];
    for (const [tier, inscriptionIds] of Object.entries(data.assigned_inscription_ids ?? {})) {
        const utxos = data.assigned_utxos?.[tier] ?? [];
        const claimedIndices = new Set(data.claims?.[tier] ?? []);
        for (let i = 0; i < inscriptionIds.length; i++) {
            slots.push({
                tier,
                utxo: utxos[i] ?? null,
                inscriptionId: inscriptionIds[i],
                claimed: claimedIndices.has(i),
                tierSlotIndex: i,
                index: slots.length,
            });
        }
    }
    return slots;
}

export default function DispenserClaim({ userId, className = "" }: DispenserClaimProps) {
    const { address, isInitialized } = useWallet();
    const [eligibility, setEligibility] = useState<Eligibility | null>(null);
    const [loading, setLoading] = useState(true);
    const [claimingSlot, setClaimingSlot] = useState<number | null>(null);
    const [localClaimed, setLocalClaimed] = useState<Set<number>>(new Set());
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
                setLocalClaimed(new Set());
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

    const handleClaim = async (tier: string, slotIndex: number, tierSlotIndex: number) => {
        if (!address) return;

        setClaimingSlot(slotIndex);
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
            const message = `${userId}|${tier}|${tierSlotIndex}|${destinationAddress}`;

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
                    slot: tierSlotIndex,
                    destination_address: destinationAddress,
                    signature,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to submit claim");
            }

            setTxHex(data.hex);
            setLocalClaimed((prev) => new Set(prev).add(slotIndex));
        } catch (err) {
            console.error("Claim error:", err);
            setError(err instanceof Error ? err.message : "Failed to claim");
        } finally {
            setClaimingSlot(null);
        }
    };

    // Don't render anything while loading or if not eligible
    if (loading || !eligibility) return null;

    const slots = buildSlots(eligibility).map((slot) => ({
        ...slot,
        claimed: slot.claimed || localClaimed.has(slot.index),
    }));

    if (slots.length === 0) return null;

    // Group slots by tier for display
    const tiers = [...new Set(slots.map((s) => s.tier))];

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

            {tiers.map((tier) => {
                const tierSlots = slots.filter((s) => s.tier === tier);
                return (
                    <div key={tier} className="mb-6 last:mb-0">
                        <h3 className="text-sm font-medium text-accent-2 mb-3">{tier} Tier</h3>
                        <div className="grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {tierSlots.map((slot) => {
                                const claiming = claimingSlot === slot.index;

                                return (
                                    <div key={slot.index} className="flex flex-col">
                                        <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex flex-col items-center gap-3">
                                            {slot.inscriptionId && (
                                                <a target="_blank" rel="noopener noreferrer" href={`https://ordinals.com/inscription/${slot.inscriptionId}`}>
                                                    <img
                                                        src={`https://ordinals.com/content/${slot.inscriptionId}`}
                                                        alt={`${slot.tier} inscription`}
                                                        className="w-full aspect-square bg-transparent"
                                                        style={{ imageRendering: "pixelated" }}
                                                    />
                                                </a>
                                            )}
                                            <div className="flex items-center justify-between w-full">
                                                <p className="text-sm sm:text-base font-semibold">
                                                    {slot.claimed ? (
                                                        <span className="text-green-500">Claimed</span>
                                                    ) : (
                                                        "Eligible"
                                                    )}
                                                </p>
                                                {isOwner && !slot.claimed && (
                                                    <button
                                                        onClick={() => handleClaim(slot.tier, slot.index, slot.tierSlotIndex)}
                                                        disabled={claiming || claimingSlot !== null}
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
                    </div>
                );
            })}

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
