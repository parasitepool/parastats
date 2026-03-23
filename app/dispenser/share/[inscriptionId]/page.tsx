import type { Metadata } from "next";
import Link from "next/link";

interface Props {
    params: Promise<{ inscriptionId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { inscriptionId } = await params;
    const title = "Parasite Pool – Dispensed Asset";
    const description = `Inscription ${inscriptionId.slice(0, 8)}… claimed from the Parasite bitcoin mining pool dispenser.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: "website",
            images: [
                {
                    url: `/dispenser/share/${inscriptionId}/opengraph-image`,
                    width: 1200,
                    height: 630,
                    alt: "Parasite Dispensed Asset",
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
        },
    };
}

export default async function DispenserSharePage({ params }: Props) {
    const { inscriptionId } = await params;

    return (
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
            <div className="bg-secondary border border-border p-6 sm:p-8 max-w-md w-full flex flex-col items-center gap-6">
                <h1 className="text-xl sm:text-2xl font-bold text-center">
                    Dispensed Asset
                </h1>
                <a
                    href={`https://ordinals.com/inscription/${inscriptionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <img
                        src={`https://ordinals.com/content/${inscriptionId}`}
                        alt="Inscription"
                        className="w-64 h-64 bg-transparent"
                        style={{ imageRendering: "pixelated" }}
                    />
                </a>
                <p className="text-sm text-accent-2 text-center">
                    Claimed from the{" "}
                    <Link href="/" className="text-foreground underline">
                        Parasite
                    </Link>{" "}
                    bitcoin mining pool dispenser.
                </p>
                <a
                    href={`https://ordinals.com/inscription/${inscriptionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent-3 font-mono break-all hover:text-foreground transition-colors"
                >
                    {inscriptionId}
                </a>
            </div>
        </main>
    );
}
