import { useCloseAllSheets } from "@/hooks/sheets";
import { pageErrorStatusAtom, useContentRefresh } from "@/hooks/pages";
import { useAtomValue } from "jotai";
import { forwardRef } from "react";
import { Link, useRoute } from "wouter";


type MainPageLinkProps = {
    isActive?: boolean;
    href: string;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    'aria-current'?: 'page' | undefined;
};

function MainPageLinkInner(
    props: MainPageLinkProps,
    ref: React.ForwardedRef<HTMLAnchorElement>
) {
    const isPageInError = useAtomValue(pageErrorStatusAtom);
    const refreshContent = useContentRefresh();
    const closeAllSheets = useCloseAllSheets();
    const checkOnClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        if (props.disabled) {
            e.preventDefault();
            return;
        }
        closeAllSheets();
        if (props.isActive || isPageInError) {
            console.log('Page is already active or in error state. Forcing error boundry + router re-render.');
            refreshContent();
            e.preventDefault();
        }
    }

    return (
        <Link
            // @ts-ignore - idk why this errors
            ref={ref}
            href={props.href}
            onClick={checkOnClick}
            className={props.className}
            aria-current={props['aria-current']}
        >
            {props.children}
        </Link>
    );
}

const MainPageLink = forwardRef(MainPageLinkInner);
export default MainPageLink;


type NavLinkProps = {
    href: string;
    children: React.ReactNode;
    className?: string;
};

export function NavLink({ href, children, className }: NavLinkProps) {
    const [isActive] = useRoute(href);

    return (
        <MainPageLink
            href={href}
            isActive={isActive}
            className={className}
        >
            {children}
        </MainPageLink>
    )
}
