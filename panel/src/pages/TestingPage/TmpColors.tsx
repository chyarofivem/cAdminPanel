import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TmpHexHslConverter from "./TmpHexHslConverter";
import TxAnchor from "@/components/TxAnchor";

//Every swatch uses a design token from globals.css / tailwind.config.cjs.
const accentSwatches = [
    ['bg-accent', 'accent (fill)'],
    ['bg-accent-hover', 'accent-hover'],
    ['bg-accent-soft', 'accent-soft'],
    ['bg-accent-tint', 'accent-tint'],
    ['bg-accent-edge', 'accent-edge'],
] as const;

const surfaceSwatches = [
    ['bg-sidebar', 'sidebar'],
    ['bg-menu', 'menu'],
    ['bg-modal', 'modal'],
    ['bg-raise', 'raise'],
    ['bg-raise-2', 'raise-2'],
    ['bg-raise-3', 'raise-3'],
    ['bg-sunken', 'sunken'],
] as const;

const textSwatches = [
    ['text-white', 'text (headings, values)'],
    ['text-body', 'text-body'],
    ['text-muted-foreground', 'text-muted'],
    ['text-faint', 'text-faint'],
    ['text-accent-text', 'accent-text'],
    ['text-accent-glow', 'accent-glow'],
] as const;

const statusSwatches = [
    ['bg-success/15 text-success-text', 'success'],
    ['bg-warning/15 text-warning-text', 'warning'],
    ['bg-danger/15 text-danger-text', 'danger'],
    ['bg-info/15 text-info-text', 'info'],
] as const;

function SwatchGroup({ title, children }: { title: string, children: React.ReactNode }) {
    return <section className="flex w-56 flex-col gap-2">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        {children}
    </section>;
}

export default function TmpColors() {
    return <>
        <div className="mx-4 space-y-8">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold text-white">Design tokens</h2>
                <p className="text-sm text-muted-foreground">Accent, surfaces, text and status colours. See docs/design-system.md.</p>
            </div>

            <div className="flex flex-wrap gap-8">
                <SwatchGroup title="Accent">
                    {accentSwatches.map(([cls, label]) => <div key={cls} className={`rounded-sm p-3 text-sm text-white ${cls}`}>{label}</div>)}
                </SwatchGroup>

                <SwatchGroup title="Surfaces">
                    {surfaceSwatches.map(([cls, label]) => <div key={cls} className={`rounded-sm p-3 text-sm text-white ${cls}`}>{label}</div>)}
                </SwatchGroup>

                <SwatchGroup title="Text">
                    <div className="flex flex-col gap-2 rounded-lg bg-raise p-3">
                        {textSwatches.map(([cls, label]) => <span key={cls} className={`text-sm ${cls}`}>{label}</span>)}
                    </div>
                </SwatchGroup>

                <SwatchGroup title="Status">
                    {statusSwatches.map(([cls, label]) => <div key={label} className={`rounded-sm p-3 text-sm ${cls}`}>{label}</div>)}
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="success">Online</Badge>
                        <Badge variant="warning">Starting</Badge>
                        <Badge variant="danger">Stopped</Badge>
                        <Badge variant="info">Info</Badge>
                    </div>
                </SwatchGroup>

                <SwatchGroup title="Buttons and links">
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm">primary</Button>
                        <Button size="sm" variant="secondary">secondary</Button>
                        <Button size="sm" variant="outline-destructive">outline-destructive</Button>
                        <Button size="sm" variant="link">link</Button>
                        <Button size="sm" disabled>disabled</Button>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                        <TxAnchor href="/settings">internal link</TxAnchor>
                        <TxAnchor href="https://www.google.com">external link</TxAnchor>
                    </div>
                </SwatchGroup>
            </div>

            <div className="border-t border-hairline pt-6">
                <h3 className="mb-3 text-base font-semibold text-white">Color converter</h3>
                <TmpHexHslConverter />
            </div>
        </div>
    </>;
}
