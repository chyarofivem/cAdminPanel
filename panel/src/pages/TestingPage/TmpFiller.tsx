export default function TmpFiller({ count = 96, maxWidth = 48 }: { count?: number, maxWidth?: number }) {
    const fillerLines: any[] = [];
    for (let i = 0; i < count; i++) {
        const text = '='.repeat(i % maxWidth);
        const hue = Math.floor((i / 50) * 180);
        fillerLines.push(<div key={i} style={{ backgroundColor: `hsl(${hue}deg 75% 65%)`, height: '1.5rem' }}>{text}</div>);
    }
    return (
        <div className="mx-auto break-all rounded-lg bg-raise text-center font-mono text-bg-bottom">
            {fillerLines}
        </div>
    );
}
