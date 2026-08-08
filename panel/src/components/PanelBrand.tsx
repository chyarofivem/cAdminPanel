import { cn } from '@/lib/utils';

type PanelBrandProps = {
    compact?: boolean;
    className?: string;
    useLogo?: boolean;
};

export default function PanelBrand({ compact = false, className, useLogo = false }: PanelBrandProps) {
    const src = useLogo ? window.txConsts.logoUrl : window.txConsts.bannerUrl;
    return (
        <img
            src={src}
            alt={window.txConsts.panelName}
            title={window.txConsts.panelName}
            className={cn(
                'object-contain transition-transform hover:scale-[1.02]',
                compact ? 'size-9' : 'h-9 max-w-56',
                className,
            )}
        />
    );
}
