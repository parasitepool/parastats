"use client";

import { useState, useEffect, useCallback, type MouseEvent } from "react";
import Image from "next/image";
import { useWallet, SignCancelledError } from "@/app/hooks/useWallet";
import { isValidBitcoinAddress, normalizeBitcoinAddress } from "@/app/utils/validators";
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

// Subset of the dispenser's AuctionInfo we need to badge and link a slot.
// `/api/dispenser/auctions` only returns live (open/extended) auctions.
interface LiveAuction {
    id: string;
    inscription_id: string;
    outpoint: string;
    end_time: number;
    current_high: number | null;
    min_next_bid: number;
}

// Auction terms are fixed server-side (the dispenser's `--auction-*` flags), so
// sellers never choose them. We fetch them purely to show what they're agreeing
// to before signing.
interface AuctionDefaults {
    reserve: number;
    increment: number;
    duration_secs: number;
    anti_snipe_secs: number;
}

// Subsets of the dispenser's /tiers and /assets responses, used to resolve
// which slots belong to a collection the operator allows auctioning.
interface TierInfo {
    name: string;
    asset: string;
}

interface AssetInfo {
    name: string;
    auctionable?: boolean;
    is_override_asset?: boolean;
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

function buildAuctionMessage(
    username: string,
    tier: string,
    tierSlotIndex: number,
): string {
    return `${username}|${tier}|${tierSlotIndex}|auction`;
}

// Surface real failures but stay quiet when the user simply cancels signing.
function getClaimErrorMessage(err: unknown): string | null {
    if (err instanceof SignCancelledError) {
        return null;
    }
    return err instanceof Error ? err.message : "Failed to claim";
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

// Auctions are keyed by both inscription id and outpoint so a slot resolves
// whichever identifier the eligibility response carries for it.
function buildAuctionIndex(auctions: LiveAuction[]): Map<string, LiveAuction> {
    const index = new Map<string, LiveAuction>();
    for (const auction of auctions) {
        if (auction.inscription_id) index.set(auction.inscription_id, auction);
        if (auction.outpoint) index.set(auction.outpoint, auction);
    }
    return index;
}

// Tier names whose backing asset the dispenser allows auctioning. Slots in any
// other tier get no auction button at all — the backend would reject them.
function buildAuctionableTiers(tiers: TierInfo[], assets: AssetInfo[]): Set<string> {
    const auctionableAssets = new Set(assets.filter((a) => a.auctionable).map((a) => a.name));
    const result = new Set<string>();
    for (const tier of tiers) {
        if (auctionableAssets.has(tier.asset)) result.add(tier.name);
    }
    // Whitelist slots draw from the override asset, which has no /tiers entry.
    const overrideAsset = assets.find((a) => a.is_override_asset);
    if (overrideAsset?.auctionable) result.add("override");
    return result;
}

function formatSats(sats: number): string {
    return sats.toLocaleString("en-US");
}

function formatDuration(seconds: number): string {
    const units: [number, string][] = [
        [86400, "day"],
        [3600, "hour"],
        [60, "minute"],
    ];
    for (const [size, label] of units) {
        if (seconds >= size) {
            const count = Math.round(seconds / size);
            return `${count} ${label}${count === 1 ? "" : "s"}`;
        }
    }
    return `${seconds} seconds`;
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
    const [showRewards, setShowRewards] = useState(false);
    // Auction flow
    const [auctionModalSlot, setAuctionModalSlot] = useState<Slot | null>(null);
    const [auctioningSlot, setAuctioningSlot] = useState<number | null>(null);
    const [auctionDefaults, setAuctionDefaults] = useState<AuctionDefaults | null>(null);
    const [auctionableTiers, setAuctionableTiers] = useState<Set<string>>(new Set());
    const [createdAuctionId, setCreatedAuctionId] = useState<string | null>(null);
    const [liveAuctions, setLiveAuctions] = useState<Map<string, LiveAuction>>(new Map());

    const isOwner = address === userId;
    const isManual = walletType === "manual";

    // Base URL of the standalone Leptos auction house
    const auctionHouseUrl = process.env.NEXT_PUBLIC_AUCTION_HOUSE_URL;

    // Without an auction house deployment there is nowhere to send a click, so
    // at-auction slots stay labelled but unlinked.
    const auctionLink = useCallback(
        (auctionId: string) =>
            auctionHouseUrl ? `${auctionHouseUrl.replace(/\/$/, "")}/auction/${auctionId}` : null,
        [auctionHouseUrl],
    );

    const slotAuction = useCallback(
        (slot: Slot): LiveAuction | null =>
            liveAuctions.get(slot.inscriptionId) ?? (slot.utxo ? liveAuctions.get(slot.utxo) ?? null : null),
        [liveAuctions],
    );

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

    const fetchAuctions = useCallback(async () => {
        try {
            const response = await fetch("/api/dispenser/auctions", { cache: "no-store" });
            if (!response.ok) return;
            const data: LiveAuction[] = await response.json();
            setLiveAuctions(buildAuctionIndex(Array.isArray(data) ? data : []));
        } catch (err) {
            // Auction state is decoration on top of the slot grid; a failure
            // here shouldn't surface as a claim error.
            console.error("Error fetching dispenser auctions:", err);
        }
    }, []);

    // Auction terms and the auctionable-asset whitelist are both operator
    // config, so they load once alongside the slot grid. On failure the
    // whitelist stays empty, which hides the auction action rather than
    // offering one the backend would reject.
    const fetchAuctionConfig = useCallback(async () => {
        try {
            const [defaultsRes, tiersRes, assetsRes] = await Promise.all([
                fetch("/api/dispenser/auction/defaults"),
                fetch("/api/dispenser/tiers"),
                fetch("/api/dispenser/assets"),
            ]);

            if (defaultsRes.ok) {
                setAuctionDefaults(await defaultsRes.json());
            }
            if (tiersRes.ok && assetsRes.ok) {
                const tiers: TierInfo[] = await tiersRes.json();
                const assets: AssetInfo[] = await assetsRes.json();
                setAuctionableTiers(
                    buildAuctionableTiers(
                        Array.isArray(tiers) ? tiers : [],
                        Array.isArray(assets) ? assets : [],
                    ),
                );
            }
        } catch (err) {
            console.error("Error fetching dispenser auction config:", err);
        }
    }, []);

    useEffect(() => {
        if (isInitialized) {
            fetchEligibility();
            fetchAuctions();
            fetchAuctionConfig();
        }
    }, [isInitialized, fetchEligibility, fetchAuctions, fetchAuctionConfig]);

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

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(data?.error || "Failed to submit claim");
        }

        return data ?? {};
    }, [userId]);

    // Reserve, increment and duration are set by the dispenser, not sent here.
    const submitAuction = useCallback(async (
        tier: string,
        tierSlotIndex: number,
        signature: string,
    ): Promise<{ id?: string }> => {
        const response = await fetch("/api/dispenser/auction/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: userId,
                tier,
                slot: tierSlotIndex,
                signature,
            }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(data?.error || "Failed to create auction");
        }

        return data ?? {};
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

            const data = await signMessage({
                address,
                message,
                submit: (signature: string) => submitClaim(tier, tierSlotIndex, destinationAddress, signature),
            });

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
        setManualSlot(null);
        setManualDestination("");
        setError(null);
    }, []);

    const handleManualClaim = async () => {
        if (!manualSlot) return;

        const destinationAddress = normalizeBitcoinAddress(manualDestination);
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

            const data = await signMessage({
                address: userId,
                message,
                submit: (signature: string) => submitClaim(slot.tier, slot.tierSlotIndex, destinationAddress, signature),
            });

            setLocalClaimed((prev) => new Set(prev).add(slot.index));
            setManualDestination("");

            // Link assets dispense a redemption URL, redirect to it
            if (data.claim_url) {
                window.location.assign(data.claim_url);
                return;
            }
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

    const handleAuction = async () => {
        if (!auctionModalSlot) return;

        const { tier, tierSlotIndex, index } = auctionModalSlot;

        setAuctioningSlot(index);
        setError(null);
        // Close the confirmation prompt so the signing modal is visible.
        setAuctionModalSlot(null);

        try {
            const message = buildAuctionMessage(userId, tier, tierSlotIndex);

            // Signs through the wallet abstraction so manual (self-supplied)
            // wallets get the paste-a-signature modal instead of a sats-connect
            // call they can't service. Submitting inside the callback keeps
            // failures retryable within that modal.
            const data = await signMessage({
                address: userId,
                message,
                submit: (signature: string) => submitAuction(tier, tierSlotIndex, signature),
            });

            // The slot is now reserved into the auction; reflect that locally.
            setLocalClaimed((prev) => new Set(prev).add(index));
            setCreatedAuctionId(data.id ?? null);
            // Pick up the new auction so the card links straight to it.
            fetchAuctions();
        } catch (err) {
            console.error("Auction error:", err);
            setError(getClaimErrorMessage(err));
        } finally {
            setAuctioningSlot(null);
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
            // Slots reserved into a live auction read as "Claimed" from the
            // eligibility response, so the auction lookup takes precedence.
            const auction = slotAuction(slot);
            const auctionUrl = auction ? auctionLink(auction.id) : null;

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
                                href={auctionUrl ?? `https://ordinals.com/inscription/${slot.inscriptionId}`}
                                title={auctionUrl ? "View auction" : "View inscription"}
                                className="block relative w-full aspect-square"
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
                                {auction && (
                                    <span className="absolute top-0 left-0 px-1.5 py-0.5 bg-amber-500 text-black text-[10px] font-bold uppercase tracking-wide">
                                        At auction
                                    </span>
                                )}
                            </a>
                        )}
                        <div className="flex items-center justify-between w-full gap-2">
                            <div className="min-w-0">
                                <p className="text-sm sm:text-base font-semibold">
                                    {auction ? (
                                        <span className="text-amber-500">At auction</span>
                                    ) : slot.claimed ? (
                                        <span className="text-green-500">Claimed</span>
                                    ) : (
                                        "Eligible"
                                    )}
                                </p>
                                {auction && (
                                    <p className="text-[11px] font-mono text-accent-2 truncate">
                                        {auction.current_high !== null && auction.current_high !== undefined
                                            ? `${formatSats(auction.current_high)} sats`
                                            : `no bids · ${formatSats(auction.min_next_bid)} sats`}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {auctionUrl && (
                                    <a
                                        href={auctionUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-2 py-1 border border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors text-xs font-medium flex-shrink-0"
                                        title="View auction"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                        Bid
                                    </a>
                                )}
                                {!auction && slot.claimed && isCodeAsset && isOwner && (
                                    <button
                                        onClick={() => isManual
                                            ? openManualClaim(slot)
                                            : handleClaim(slot.tier, slot.index, slot.tierSlotIndex)}
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
                                {!auction && slot.claimed && !isCodeAsset && (
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
                                {/* Auctions are only for on-chain UTXO assets (not
                                    redemption-code assets) from a collection the
                                    dispenser whitelists for auctioning. */}
                                {isOwner && !slot.claimed && !isCodeAsset && auctionableTiers.has(slot.tier) && (
                                    <button
                                        onClick={() => {
                                            setError(null);
                                            setCreatedAuctionId(null);
                                            setAuctionModalSlot(slot);
                                        }}
                                        disabled={claiming || claimingSlot !== null || auctioningSlot !== null}
                                        className="flex items-center gap-1 px-2 py-1 border border-border hover:bg-secondary-hover transition-colors text-xs font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Auction this asset"
                                    >
                                        Auction
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

            {!collapsed && error && !manualSlot && (
                <div className="mt-4 text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                    {error}
                </div>
            )}

            {!collapsed && createdAuctionId && (
                <div className="mt-4 text-sm text-green-500 bg-green-500/10 p-2 border border-green-500/20 flex items-center justify-between gap-2">
                    <span>Auction created.</span>
                    {auctionHouseUrl ? (
                        <a
                            href={`${auctionHouseUrl.replace(/\/$/, "")}/auction/${createdAuctionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline font-medium"
                        >
                            View auction
                        </a>
                    ) : (
                        <span className="font-mono text-xs opacity-70">{createdAuctionId}</span>
                    )}
                </div>
            )}

            {manualSlot && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            event.stopPropagation();
                            closeManualClaim();
                        }
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
        <DispenserRewards isOpen={showRewards} onClose={() => setShowRewards(false)} />
        {auctionModalSlot && (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                onClick={() => auctioningSlot === null && setAuctionModalSlot(null)}
            >
                <div
                    className="bg-background border border-border p-5 sm:p-6 w-full max-w-sm shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3 className="text-lg font-bold mb-1">Auction asset</h3>
                    <p className="text-xs text-accent-2 mb-4">
                        Reserve the asset into an auction. The winning bid is paid to your
                        L1 address; the inscription transfers to the winner.
                    </p>

                    {/* Auction terms are fixed by the dispenser and shown here for
                        confirmation only — there is nothing to fill in. */}
                    {auctionDefaults && (
                        <dl className="mb-4 bg-secondary border border-border divide-y divide-border text-sm">
                            <div className="flex items-center justify-between px-3 py-2">
                                <dt className="text-xs font-medium text-accent-2">Starting price</dt>
                                <dd className="font-mono">{formatSats(auctionDefaults.reserve)} sats</dd>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2">
                                <dt className="text-xs font-medium text-accent-2">Minimum increment</dt>
                                <dd className="font-mono">{formatSats(auctionDefaults.increment)} sats</dd>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2">
                                <dt className="text-xs font-medium text-accent-2">Duration</dt>
                                <dd className="font-mono">{formatDuration(auctionDefaults.duration_secs)}</dd>
                            </div>
                            {auctionDefaults.anti_snipe_secs > 0 && (
                                <div className="flex items-center justify-between px-3 py-2">
                                    <dt className="text-xs font-medium text-accent-2">Late-bid extension</dt>
                                    <dd className="font-mono">{formatDuration(auctionDefaults.anti_snipe_secs)}</dd>
                                </div>
                            )}
                        </dl>
                    )}

                    {error && (
                        <div className="mb-4 text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => setAuctionModalSlot(null)}
                            disabled={auctioningSlot !== null}
                            className="px-3 py-1.5 border border-border hover:bg-secondary-hover transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAuction}
                            disabled={auctioningSlot !== null}
                            className="px-3 py-1.5 bg-foreground text-background hover:bg-foreground/80 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {auctioningSlot !== null ? "Signing..." : "Start auction"}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
