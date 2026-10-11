import { cn } from "@/lib/utils";
import { openExternalLink } from '@/lib/navigation';
import { useLocation } from "wouter";


type TxAnchorType = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    className?: string;
    rel?: string;
};
export default function TxAnchor({ children, href, className, rel, ...rest }: TxAnchorType) {
    const setLocation = useLocation()[1];
    const isExternal = href?.startsWith('http') || href?.startsWith('//');
    const onClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        if (!href) return;
        e.preventDefault();
        if (isExternal) {
            openExternalLink(href);
        } else {
            setLocation(href ?? '/');
        }
    }
    return (
        <a
            {...rest}
            rel={rel ?? 'noopener noreferrer'}
            href={href}
            className={cn(
                //Text link: accent text, glow and underline on hover. No external-link icon.
                'cursor-pointer text-accent-text no-underline underline-offset-4 transition-colors duration-150 hover:text-accent-glow hover:underline',
                className
            )}
            onClick={onClick}
        >
            {children}
        </a>
    );
}
