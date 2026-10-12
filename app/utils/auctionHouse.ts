// Base URL of the standalone auction house (parabid). Links render inert
// when it is not configured.
export const auctionHouseUrl = process.env.NEXT_PUBLIC_AUCTION_HOUSE_URL?.replace(/\/$/, '');
