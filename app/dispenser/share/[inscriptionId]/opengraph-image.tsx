import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default async function OgImage({
    params,
}: {
    params: Promise<{ inscriptionId: string }>;
}) {
    const { inscriptionId } = await params;
    const inscriptionUrl = `https://ordinals.com/content/${inscriptionId}`;

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0a0a0a",
                    fontFamily: "Courier New, monospace",
                }}
            >
                {/* Top bar */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "4px",
                        backgroundColor: "#444444",
                    }}
                />

                {/* Inscription image */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "320px",
                        height: "320px",
                        border: "2px solid #444444",
                        backgroundColor: "#222222",
                    }}
                >
                    <img
                        src={inscriptionUrl}
                        alt=""
                        width={300}
                        height={300}
                        style={{ imageRendering: "pixelated" }}
                    />
                </div>

                {/* Text */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        marginTop: "24px",
                        gap: "8px",
                    }}
                >
                    <div
                        style={{
                            fontSize: "32px",
                            fontWeight: 700,
                            color: "#ededed",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        Dispensed Asset
                    </div>
                    <div
                        style={{
                            fontSize: "18px",
                            color: "#777777",
                        }}
                    >
                        parasite.space
                    </div>
                </div>

                {/* Bottom bar */}
                <div
                    style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: "4px",
                        backgroundColor: "#444444",
                    }}
                />
            </div>
        ),
        { ...size }
    );
}
