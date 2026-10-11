import { ConfigChangelogEntry } from "@shared/otherTypes";
import { Fragment, useMemo, useState } from "react";
import { dateToLocaleDateString, dateToLocaleTimeString, isDateToday, tsToLocaleDateTimeString } from "@/lib/dateTime";
import TxAnchor from "@/components/TxAnchor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { t } from '@/lib/i18n';


//MARK: PageHeaderChangelog
type PageHeaderChangelogProps = {
    changelogData?: ConfigChangelogEntry[];
}
export function PageHeaderChangelog({ changelogData }: PageHeaderChangelogProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const mostRecent = useMemo(() => {
        if (!changelogData?.length) return null;
        const last = changelogData[changelogData.length - 1];
        const lastDate = new Date(last.ts);
        const timeStr = dateToLocaleTimeString(lastDate, '2-digit', '2-digit');
        const dateStr = dateToLocaleDateString(lastDate, 'long');
        return {
            author: last.author,
            dateTime: isDateToday(lastDate) ? timeStr : dateStr,
        }
    }, [changelogData]);

    const reversedChangelog = useMemo(() => {
        if (!changelogData) return null;
        return [...changelogData].reverse();
    }, [changelogData]);

    const placeholder = Array.isArray(changelogData) ? t('No changes yet') : t('loading...');

    return (<>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-dense">
            <span className="text-muted-foreground">
                {t('Last Updated')}: <span className="tabular-nums text-white">{mostRecent?.dateTime ?? placeholder}</span>
            </span>
            {reversedChangelog?.length ? (
                <Button variant="link" className="text-dense" onClick={() => setIsModalOpen(true)}>
                    {t('View Changelog')}
                </Button>
            ) : null}
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>{t('Recent Changes')}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[70vh] space-y-2 overflow-auto">
                    {reversedChangelog?.map((entry, i) => <ChangelogEntry key={i} entry={entry} />)}
                </div>
            </DialogContent>
        </Dialog>
    </>)
}


function ChangelogEntry({ entry }: { entry: ConfigChangelogEntry }) {
    return (
        <div className="flex flex-col gap-2 rounded-lg bg-raise px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-white">{entry.author}</div>
                <div className="text-dense tabular-nums text-muted-foreground">
                    {tsToLocaleDateTimeString(entry.ts, 'short', 'short')}
                </div>
            </div>
            <div className="flex flex-wrap gap-1 text-dense">
                {entry.keys.length ? entry.keys.map((cfg) => (
                    <code key={cfg} className="rounded-xs bg-raise-2 px-1.5 py-0.5 font-mono text-xs text-body">{cfg}</code>
                )) : (
                    <span className="text-muted-foreground">{t('No changes')}</span>
                )}
            </div>
        </div>
    )
}


//MARK: PageHeaderLinks
type PageHeaderLinksProps = {
    topLabel: string;
    topLink: string;
    bottomLabel: string;
    bottomLink: string;
}
export function PageHeaderLinks(props: PageHeaderLinksProps) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
            <TxAnchor href={props.topLink} className="text-sm">{props.topLabel}</TxAnchor>
            <TxAnchor href={props.bottomLink} className="text-sm">{props.bottomLabel}</TxAnchor>
        </div>
    )
}


//MARK: Breadcrumbs
export type BreadcrumbItem = {
    label: string;
    href?: string;
};
/**
 * Breadcrumbs: raise background, radius-md, 8px x 16px, 13px muted text with the
 * current page in white.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
    if (!items.length) return null;
    return (
        <nav aria-label={t('Breadcrumb')} className="w-fit max-w-full rounded-md bg-raise px-4 py-2">
            <ol className="flex flex-wrap items-center gap-x-2 text-dense text-muted-foreground">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return <Fragment key={`${index}-${item.label}`}>
                        <li className={isLast ? 'min-w-0 truncate text-white' : undefined} aria-current={isLast ? 'page' : undefined}>
                            {!isLast && item.href
                                ? <Link href={item.href} className="transition-colors duration-150 hover:text-white">{item.label}</Link>
                                : item.label}
                        </li>
                        {!isLast && <li aria-hidden="true">/</li>}
                    </Fragment>;
                })}
            </ol>
        </nav>
    );
}


//MARK: PageHeader
type PageHeaderProps = {
    title: string;
    subtitle?: React.ReactNode;
    /** Renders breadcrumbs above the title, ending at this page. */
    parentName?: string;
    parentLink?: string;
    /** Page actions: right-aligned on desktop, wrapped under the title on phones. */
    children?: React.ReactNode;
}
/**
 * Page header: 20px/600 white title, 16px muted subtitle, actions on the same row.
 * No icons.
 */
export function PageHeader({ title, subtitle, parentName, parentLink, children }: PageHeaderProps) {
    return (
        <header className="mb-6 mt-4 flex flex-col gap-4 sm:mt-6">
            {parentName && parentLink && <Breadcrumbs items={[{ label: parentName, href: parentLink }, { label: title }]} />}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
                <div className="min-w-0">
                    <h1 className="break-words text-xl font-semibold leading-tight text-white">{title}</h1>
                    {subtitle && <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>}
                </div>
                {children && <div className="flex flex-wrap items-center gap-2 md:justify-end">{children}</div>}
            </div>
        </header>
    )
}
