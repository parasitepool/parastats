"use client";

import { useState, useEffect, useCallback, type MouseEvent } from "react";
import Image from "next/image";
import { useWallet } from "@/app/hooks/useWallet";
import { isValidBitcoinAddress } from "@/app/utils/validators";
import { getCollapsibleContainerClassName, shouldToggleCollapse } from "@/app/components/collapsible";

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
    collapsed?: boolean;
    onToggle?: () => void;
}

function buildClaimMessage(
    username: string,
    tier: string,
    tierSlotIndex: number,
    destinationAddress: string,
): string {
    return `${username}|${tier}|${tierSlotIndex}|${destinationAddress}`;
}

// Surface real failures but stay quiet when the user simply cancels signing.
function getClaimErrorMessage(err: unknown): string | null {
    const message = err instanceof Error ? err.message : "Failed to claim";
    if (message.toLowerCase().includes("cancel")) {
        return null;
    }
    return message;
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

export default function DispenserClaim({ userId, className = "", collapsed = false, onToggle }: DispenserClaimProps) {
    const { address, walletType, isInitialized, signMessage } = useWallet();
    const [eligibility, setEligibility] = useState<Eligibility | null>(null);
    const [loading, setLoading] = useState(true);
    const [claimingSlot, setClaimingSlot] = useState<number | null>(null);
    const [localClaimed, setLocalClaimed] = useState<Set<number>>(new Set());
    const [error, setError] = useState<string | null>(null);
    // const [txHex, setTxHex] = useState<string | null>(null);
    const [copiedSlot, setCopiedSlot] = useState<number | null>(null);
    // Manual wallets can't auto-supply an Ordinals address, so they enter a
    // destination address before signing the claim.
    const [manualSlot, setManualSlot] = useState<Slot | null>(null);
    const [manualDestination, setManualDestination] = useState("");

    const isOwner = address === userId;
    const isManual = walletType === "manual";

    const handleCopyLink = async (inscriptionId: string, slotIndex: number) => {
        const url = `${window.location.origin}/dispenser/share/${inscriptionId}`;
        await navigator.clipboard.writeText(url);
        setCopiedSlot(slotIndex);
        setTimeout(() => setCopiedSlot(null), 2000);
    };

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

    const submitClaim = useCallback(async (
        tier: string,
        tierSlotIndex: number,
        destinationAddress: string,
        signature: string,
    ) => {
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

        return data;
    }, [userId]);

    const handleClaim = async (tier: string, slotIndex: number, tierSlotIndex: number) => {
        if (!address) return;

        setClaimingSlot(slotIndex);
        setError(null);
        // setTxHex(null);

        try {
            const { request, AddressPurpose } = await import("@sats-connect/core");

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
            const message = buildClaimMessage(userId, tier, tierSlotIndex, destinationAddress);

            const signature = await signMessage({ address, message });

            await submitClaim(tier, tierSlotIndex, destinationAddress, signature);

            // setTxHex(data.hex);
            setLocalClaimed((prev) => new Set(prev).add(slotIndex));

            // Link assets dispense a redemption URL, redirect to it
            if (data.claim_url) {
                window.location.assign(data.claim_url);
                return;
            }
        } catch (err) {
            console.error("Claim error:", err);
            setError(getClaimErrorMessage(err));
        } finally {
            setClaimingSlot(null);
        }
    };

    const openManualClaim = (slot: Slot) => {
        setManualSlot(slot);
        setManualDestination("");
        setError(null);
    };

    const closeManualClaim = useCallback(() => {
        if (claimingSlot !== null) return;
        setManualSlot(null);
        setManualDestination("");
    }, [claimingSlot]);

    const handleManualClaim = async () => {
        if (!manualSlot) return;

        const destinationAddress = manualDestination.trim();
        if (!isValidBitcoinAddress(destinationAddress)) {
            setError("Enter a valid destination Bitcoin address");
            return;
        }

        const slot = manualSlot;
        setClaimingSlot(slot.index);
        setError(null);
        // Close the destination prompt so the signing modal is visible.
        setManualSlot(null);

        try {
            const message = buildClaimMessage(userId, slot.tier, slot.tierSlotIndex, destinationAddress);

            const signature = await signMessage({ address: userId, message });

            await submitClaim(slot.tier, slot.tierSlotIndex, destinationAddress, signature);

            setLocalClaimed((prev) => new Set(prev).add(slot.index));
            setManualDestination("");
        } catch (err) {
            console.error("Manual claim error:", err);
            setError(getClaimErrorMessage(err));
        } finally {
            setClaimingSlot(null);
        }
    };

    useEffect(() => {
        if (!manualSlot) return;

        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeManualClaim();
        };

        window.addEventListener("keydown", handleEscKey);
        return () => window.removeEventListener("keydown", handleEscKey);
    }, [manualSlot, closeManualClaim]);

    // Don't render anything while loading or if not eligible
    if (loading || !eligibility) return null;

    const slots = buildSlots(eligibility).map((slot) => ({
        ...slot,
        claimed: slot.claimed || localClaimed.has(slot.index),
    }));

    if (slots.length === 0) return null;

    const miningSlots = slots.filter((s) => s.tier !== "override");
    const whitelistSlots = slots.filter((s) => s.tier === "override");
    const firstVisibleInscriptionSlotIndex = [...miningSlots, ...whitelistSlots].find((slot) => slot.inscriptionId)?.index;

    const renderSlots = (slotsToRender: typeof slots) =>
        slotsToRender.map((slot) => {
            const claiming = claimingSlot === slot.index;
            const isCodeAsset = !slot.inscriptionId;

            return (
                <div key={slot.index} className="flex flex-col">
                    <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex flex-col items-center gap-3">
                        {isCodeAsset ? (
                            <div className="w-full aspect-square flex flex-col items-center justify-center gap-2 bg-background border border-border text-accent-2">
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-xs font-medium">Redemption code</span>
                            </div>
                        ) : (
                            <a
                                target="_blank"
                                rel="noopener noreferrer"
                                href={`https://ordinals.com/inscription/${slot.inscriptionId}`}
                                className="block w-full aspect-square"
                            >
                                <Image
                                    src={`https://ordinals.com/content/${slot.inscriptionId}`}
                                    alt="inscription"
                                    width={512}
                                    height={512}
                                    loading={slot.index === firstVisibleInscriptionSlotIndex ? "eager" : "lazy"}
                                    unoptimized
                                    className="w-full h-full object-contain bg-transparent"
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
                            <div className="flex items-center gap-2">
                                {slot.claimed && isCodeAsset && isOwner && (
                                    <button
                                        onClick={() => handleClaim(slot.tier, slot.index, slot.tierSlotIndex)}
                                        disabled={claiming || claimingSlot !== null}
                                        className="flex items-center gap-1 px-2 py-1 border border-border hover:bg-secondary-hover transition-colors text-xs font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Reopen claim page"
                                    >
                                        {claiming ? (
                                            "Opening..."
                                        ) : (
                                            <>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                </svg>
                                                Link
                                            </>
                                        )}
                                    </button>
                                )}
                                {slot.claimed && !isCodeAsset && (
                                    <button
                                        onClick={() => handleCopyLink(slot.inscriptionId, slot.index)}
                                        className="flex items-center gap-1 px-2 py-1 border border-border hover:bg-secondary-hover transition-colors text-xs font-medium flex-shrink-0"
                                        title="Copy share link"
                                    >
                                        {copiedSlot === slot.index ? (
                                            <>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Copied
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                </svg>
                                                Link
                                            </>
                                        )}
                                    </button>
                                )}
                                {isOwner && !slot.claimed && (
                                    <button
                                        onClick={() => isManual
                                            ? openManualClaim(slot)
                                            : handleClaim(slot.tier, slot.index, slot.tierSlotIndex)}
                                        disabled={claiming || claimingSlot !== null}
                                        className="flex items-center gap-1 px-2 py-1 bg-foreground text-background hover:bg-foreground/80 transition-colors text-xs font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {claiming ? "Signing..." : "Claim"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        });

    const containerClassName = getCollapsibleContainerClassName(
        `bg-background p-4 sm:p-6 shadow-md border border-border ${className}`,
        collapsed,
        Boolean(onToggle),
    );

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!onToggle || !shouldToggleCollapse(event)) {
            return;
        }
        onToggle();
    };

    return (
        <div className={containerClassName} onClick={handleClick}>
            <div className={`flex items-center ${collapsed ? '' : 'mb-4 sm:mb-6'}`}>
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

            {!collapsed && miningSlots.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-accent-2 mb-3">Mining Reward</h3>
                    <div className="grid gap-4 sm:gap-6 grid-cols-3">
                        {renderSlots(miningSlots)}
                    </div>
                </div>
            )}

            {!collapsed && whitelistSlots.length > 0 && (
                <div className="mb-6 last:mb-0">
                    <h3 className="text-sm font-medium text-accent-2 mb-3">Whitelist</h3>
                    <div className="grid gap-4 sm:gap-6 grid-cols-3">
                        {renderSlots(whitelistSlots)}
                    </div>
                </div>
            )}

            {/**txHex && (
                <div className="mt-4">
                    <h3 className="text-sm font-medium text-accent-2 mb-2">Transaction</h3>
                    <div className="bg-secondary p-3 sm:p-4 border border-border">
                        <p className="text-xs font-mono break-all text-foreground/70">{txHex}</p>
                    </div>
                </div>
            )**/}

            {!collapsed && error && !manualSlot && (
                <div className="mt-4 text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                    {error}
                </div>
            )}

            {manualSlot && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) closeManualClaim();
                    }}
                >
                    <div
                        className="bg-background border border-foreground p-4 sm:p-6 max-w-md w-full mx-4 shadow-xl max-h-[calc(100vh-2rem)] overflow-y-auto"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex justify-between items-start gap-4 mb-4">
                            <h2 className="text-xl sm:text-2xl font-bold text-accent-3">Claim Inscription</h2>
                            <button
                                onClick={closeManualClaim}
                                className="text-gray-400 hover:text-gray-500 focus:outline-none"
                                title="Close"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-secondary border border-border p-3 text-sm text-foreground/80">
                                Enter the Ordinals address where the inscription should be sent. You&apos;ll then
                                sign a message with your mining address to authorize the claim.
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-accent-2 mb-2" htmlFor="manual-dispenser-destination">
                                    Destination Ordinals address
                                </label>
                                <input
                                    id="manual-dispenser-destination"
                                    value={manualDestination}
                                    onChange={(event) => setManualDestination(event.target.value)}
                                    placeholder="bc1p..."
                                    autoFocus
                                    className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent-3 font-mono text-sm"
                                />
                            </div>

                            {error && (
                                <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
                                    {error}
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                                <button
                                    onClick={closeManualClaim}
                                    className="px-4 py-2 border border-border hover:bg-secondary-hover text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleManualClaim}
                                    disabled={!manualDestination.trim()}
                                    className="px-4 py-2 bg-foreground text-background hover:bg-foreground/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
