"use client";

import { useState, useEffect, useCallback, type MouseEvent } from "react";
import Image from "next/image";
import { useWallet } from "@/app/hooks/useWallet";
import { getCollapsibleContainerClassName, shouldToggleCollapse } from "@/app/components/collapsible";
import DispenserRewards from "@/app/components/dispenser/DispenserRewards";

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

// Code/redemption assets carry no on-chain inscription image. We currently
// have a single code-redemption type, so all code slots share one fixed
// graphic from the public folder (public/dispenser/<asset>.webp), falling back
// to a generic placeholder if the file is missing. If more code-redemption
// assets are added, plumb the asset name through the eligibility response and
// derive this path per slot instead.
const CODE_ASSET_IMAGE = "/dispenser/homeminers.webp";

function CodeAssetImage() {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return (
            <div className="w-full aspect-square flex flex-col items-center justify-center gap-2 bg-background border border-border text-accent-2">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-medium">Redemption code</span>
            </div>
        );
    }

    return (
        <div className="w-full aspect-square">
            <Image
                src={CODE_ASSET_IMAGE}
                alt="redemption asset"
                width={512}
                height={512}
                onError={() => setFailed(true)}
                className="w-full h-full object-contain bg-transparent"
            />
        </div>
    );
}

export default function DispenserClaim({ userId, className = "", collapsed = false, onToggle }: DispenserClaimProps) {
    const { address, isInitialized } = useWallet();
    const [eligibility, setEligibility] = useState<Eligibility | null>(null);
    const [loading, setLoading] = useState(true);
    const [claimingSlot, setClaimingSlot] = useState<number | null>(null);
    const [localClaimed, setLocalClaimed] = useState<Set<number>>(new Set());
    const [error, setError] = useState<string | null>(null);
    // const [txHex, setTxHex] = useState<string | null>(null);
    const [copiedSlot, setCopiedSlot] = useState<number | null>(null);
    const [showRewards, setShowRewards] = useState(false);

    const isOwner = address === userId;

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

            // setTxHex(data.hex);
            setLocalClaimed((prev) => new Set(prev).add(slotIndex));

            // Link assets dispense a redemption URL, redirect to it
            if (data.claim_url) {
                window.location.assign(data.claim_url);
                return;
            }
        } catch (err) {
            console.error("Claim error:", err);
            setError(err instanceof Error ? err.message : "Failed to claim");
        } finally {
            setClaimingSlot(null);
        }
    };

    // The panel is always shown so users can browse available rewards
    const slots = eligibility
        ? buildSlots(eligibility).map((slot) => ({
            ...slot,
            claimed: slot.claimed || localClaimed.has(slot.index),
        }))
        : [];

    const hasRewards = slots.length > 0;
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
                        {/* Fixed square media box keeps every card the same height
                            (regardless of inscription dimensions) so the status
                            row below stays aligned across the grid. */}
                        {isCodeAsset ? (
                            <CodeAssetImage />
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
        <>
        <div className={containerClassName} onClick={handleClick}>
            <div className={`flex items-center justify-between ${collapsed ? '' : 'mb-4 sm:mb-6'}`}>
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
                {!collapsed && (
                    <button
                        onClick={() => setShowRewards(true)}
                        className="px-3 py-1.5 border border-border hover:bg-secondary-hover transition-colors text-xs sm:text-sm font-medium flex-shrink-0"
                    >
                        View rewards
                    </button>
                )}
            </div>

            {!collapsed && !loading && !hasRewards && (
                <p className="text-sm text-accent-2">
                    No rewards yet. Keep mining, then check back — or view the available rewards above.
                </p>
            )}

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

            {!collapsed && error && (
                <div className="mt-4 text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                    {error}
                </div>
            )}
        </div>
        <DispenserRewards isOpen={showRewards} onClose={() => setShowRewards(false)} />
        </>
    );
}
