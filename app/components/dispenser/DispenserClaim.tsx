"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@/app/hooks/useWallet";
import { isValidBitcoinAddress } from "@/app/utils/validators";

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

interface ManualClaim {
    tier: string;
    slotIndex: number;
    tierSlotIndex: number;
}

type BitcoinProviderWindow = Window & {
    BitcoinProvider?: unknown;
    XverseProviders?: {
        BitcoinProvider?: unknown;
    };
};

function hasInjectedBitcoinWallet(): boolean {
    if (typeof window === "undefined") return false;

    const bitcoinWindow = window as BitcoinProviderWindow;
    return Boolean(bitcoinWindow.XverseProviders?.BitcoinProvider || bitcoinWindow.BitcoinProvider);
}

function buildClaimMessage(
    username: string,
    tier: string,
    tierSlotIndex: number,
    destinationAddress: string,
): string {
    return `${username}|${tier}|${tierSlotIndex}|${destinationAddress}`;
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
    // const [txHex, setTxHex] = useState<string | null>(null);
    const [copiedSlot, setCopiedSlot] = useState<number | null>(null);
    const [hasWalletProvider, setHasWalletProvider] = useState(false);
    const [manualClaim, setManualClaim] = useState<ManualClaim | null>(null);
    const [manualDestination, setManualDestination] = useState("");
    const [manualSignature, setManualSignature] = useState("");
    const [copiedManualMessage, setCopiedManualMessage] = useState(false);
    const [manualSubmitting, setManualSubmitting] = useState(false);

    const isOwner = address === userId;
    const manualDestinationAddress = manualDestination.trim();
    const manualSignatureValue = manualSignature.trim();
    const manualMessage = useMemo(() => {
        if (!manualClaim || !manualDestinationAddress) return "";

        return buildClaimMessage(
            userId,
            manualClaim.tier,
            manualClaim.tierSlotIndex,
            manualDestinationAddress,
        );
    }, [manualClaim, manualDestinationAddress, userId]);

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

    const closeManualClaim = useCallback(() => {
        if (manualSubmitting) return;

        setManualClaim(null);
        setManualDestination("");
        setManualSignature("");
        setCopiedManualMessage(false);
    }, [manualSubmitting]);

    useEffect(() => {
        const updateWalletProvider = () => setHasWalletProvider(hasInjectedBitcoinWallet());

        updateWalletProvider();
        const timeoutId = window.setTimeout(updateWalletProvider, 800);

        return () => window.clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        if (!manualClaim) return;

        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeManualClaim();
            }
        };

        window.addEventListener("keydown", handleEscKey);
        return () => window.removeEventListener("keydown", handleEscKey);
    }, [closeManualClaim, manualClaim]);

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
            const message = buildClaimMessage(userId, tier, tierSlotIndex, destinationAddress);

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

            await submitClaim(tier, tierSlotIndex, destinationAddress, signature);

            // setTxHex(data.hex);
            setLocalClaimed((prev) => new Set(prev).add(slotIndex));
        } catch (err) {
            console.error("Claim error:", err);
            setError(err instanceof Error ? err.message : "Failed to claim");
        } finally {
            setClaimingSlot(null);
        }
    };

    const openManualClaim = (tier: string, slotIndex: number, tierSlotIndex: number) => {
        setManualClaim({ tier, slotIndex, tierSlotIndex });
        setManualDestination("");
        setManualSignature("");
        setCopiedManualMessage(false);
        setError(null);
    };

    const handleCopyManualMessage = async () => {
        if (!manualMessage) return;

        await navigator.clipboard.writeText(manualMessage);
        setCopiedManualMessage(true);
        setTimeout(() => setCopiedManualMessage(false), 2000);
    };

    const handleManualClaim = async () => {
        if (!manualClaim) return;

        if (!isValidBitcoinAddress(manualDestinationAddress)) {
            setError("Enter a valid Bitcoin destination address");
            return;
        }

        if (!manualSignatureValue) {
            setError("Paste a BIP322 signature");
            return;
        }

        setManualSubmitting(true);
        setClaimingSlot(manualClaim.slotIndex);
        setError(null);

        try {
            await submitClaim(
                manualClaim.tier,
                manualClaim.tierSlotIndex,
                manualDestinationAddress,
                manualSignatureValue,
            );

            setLocalClaimed((prev) => new Set(prev).add(manualClaim.slotIndex));
            closeManualClaim();
        } catch (err) {
            console.error("Manual claim error:", err);
            setError(err instanceof Error ? err.message : "Failed to claim");
        } finally {
            setManualSubmitting(false);
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

    const miningSlots = slots.filter((s) => s.tier !== "override");
    const whitelistSlots = slots.filter((s) => s.tier === "override");

    const renderSlots = (slotsToRender: typeof slots) =>
        slotsToRender.map((slot) => {
            const claiming = claimingSlot === slot.index;
            const showWalletClaim = isOwner && hasWalletProvider;

            return (
                <div key={slot.index} className="flex flex-col">
                    <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex flex-col items-center gap-3">
                        {slot.inscriptionId && (
                            <a target="_blank" rel="noopener noreferrer" href={`https://ordinals.com/inscription/${slot.inscriptionId}`}>
                                <img
                                    src={`https://ordinals.com/content/${slot.inscriptionId}`}
                                    alt="inscription"
                                    className="w-full min-w-[200px] aspect-square bg-transparent"
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
                                {slot.claimed && (
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
                                {showWalletClaim && !slot.claimed && (
                                    <button
                                        onClick={() => handleClaim(slot.tier, slot.index, slot.tierSlotIndex)}
                                        disabled={claiming || claimingSlot !== null}
                                        className="flex items-center gap-1 px-2 py-1 bg-foreground text-background hover:bg-foreground/80 transition-colors text-xs font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {claiming ? "Signing..." : "Claim"}
                                    </button>
                                )}
                                {!slot.claimed && (
                                    <button
                                        onClick={() => openManualClaim(slot.tier, slot.index, slot.tierSlotIndex)}
                                        disabled={claiming || claimingSlot !== null}
                                        className={`flex items-center gap-1 px-2 py-1 transition-colors text-xs font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                                            showWalletClaim
                                                ? "border border-border hover:bg-secondary-hover"
                                                : "bg-foreground text-background hover:bg-foreground/80"
                                        }`}
                                    >
                                        {showWalletClaim ? "Manual" : claiming ? "Claiming..." : "Claim"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        });

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

            {miningSlots.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-accent-2 mb-3">Mining Reward</h3>
                    <div className="grid gap-4 sm:gap-6 grid-cols-3">
                        {renderSlots(miningSlots)}
                    </div>
                </div>
            )}

            {whitelistSlots.length > 0 && (
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

            {error && !manualClaim && (
                <div className="mt-4 text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                    {error}
                </div>
            )}

            {manualClaim && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            closeManualClaim();
                        }
                    }}
                >
                    <div
                        className="bg-background border border-foreground p-4 sm:p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[calc(100vh-2rem)] overflow-y-auto"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex justify-between items-start gap-4 mb-4">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-accent-3">Manual Claim</h2>
                                <div className="mt-2 flex flex-col gap-1">
                                    <span className="text-xs uppercase text-foreground/50">Sign with mining address</span>
                                    <span className="inline-block max-w-full border border-border bg-secondary px-2 py-1 font-mono text-xs text-foreground break-all">
                                        {userId}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={closeManualClaim}
                                disabled={manualSubmitting}
                                className="text-gray-400 hover:text-gray-500 focus:outline-none disabled:opacity-50"
                                title="Close"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-secondary border border-border p-3 text-sm text-foreground/80 space-y-3">
                                <p>
                                    {hasWalletProvider
                                        ? "Use this if you want to claim with Sparrow or another wallet instead of the detected browser wallet."
                                        : "No Xverse or Bitcoin browser wallet was detected. You can still try claiming with Sparrow or another wallet that supports BIP322 message signing."}
                                </p>
                                <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm">
                                    <li>Enter the destination address where the inscription should be sent.</li>
                                    <li>Copy the generated message.</li>
                                    <li>In Sparrow, sign that message with the mining address shown above.</li>
                                    <li>Paste the BIP322 signature here and submit the claim.</li>
                                </ol>
                                <p className="text-xs text-foreground/60">
                                    The signing address proves you own the eligible miner account. The destination address only tells the dispenser where to send the inscription.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-accent-2 mb-2" htmlFor="manual-destination-address">
                                    Destination Ordinals address
                                </label>
                                <input
                                    id="manual-destination-address"
                                    value={manualDestination}
                                    onChange={(event) => setManualDestination(event.target.value)}
                                    placeholder="bc1q..."
                                    className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent-3 font-mono text-sm"
                                    disabled={manualSubmitting}
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <label className="text-sm font-medium text-accent-2" htmlFor="manual-claim-message">
                                        Message
                                    </label>
                                    <button
                                        onClick={handleCopyManualMessage}
                                        disabled={!manualMessage || manualSubmitting}
                                        className="px-2 py-1 border border-border hover:bg-secondary-hover transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {copiedManualMessage ? "Copied" : "Copy"}
                                    </button>
                                </div>
                                <textarea
                                    id="manual-claim-message"
                                    value={manualMessage}
                                    readOnly
                                    rows={3}
                                    className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none font-mono text-xs resize-none"
                                    placeholder="Enter destination address first"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-accent-2 mb-2" htmlFor="manual-signature">
                                    BIP322 signature
                                </label>
                                <textarea
                                    id="manual-signature"
                                    value={manualSignature}
                                    onChange={(event) => setManualSignature(event.target.value)}
                                    rows={4}
                                    className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent-3 font-mono text-xs resize-y"
                                    disabled={manualSubmitting}
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
                                    disabled={manualSubmitting}
                                    className="px-4 py-2 border border-border hover:bg-secondary-hover text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleManualClaim}
                                    disabled={manualSubmitting}
                                    className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {manualSubmitting ? "Submitting..." : "Submit Claim"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
