import type { ResourceBackupInfo, ResourceInfo } from '@shared/resourceManagerTypes';
import TxAnchor from '@/components/TxAnchor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { tsToLocaleDateTimeString } from '@/lib/dateTime';
import { t } from '@/lib/i18n';
import { checkErrorCopy } from './resourceCopy';

type ResourceDetailsProps = {
    id: string;
    resource: ResourceInfo;
    isMaster: boolean;
    /** An update or rollback is running somewhere on the page. */
    isBusy: boolean;
    onUpdate: (resource: ResourceInfo) => void;
    onRollback: (resource: ResourceInfo, backup: ResourceBackupInfo) => void;
};

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="min-w-0">
        <dt className="text-dense text-muted-foreground">{label}</dt>
        <dd className="mt-1 text-sm text-white">{children}</dd>
    </div>;
}

function Muted({ children }: { children: React.ReactNode }) {
    return <span className="text-muted-foreground">{children}</span>;
}

/**
 * The update status as a word in a badge, plus why a check failed.
 */
export function UpdateStatus({ resource }: { resource: ResourceInfo }) {
    const update = resource.update;
    if (!resource.githubRepo) {
        return <p className="text-dense text-muted-foreground">
            {t('Add a GitHub repository to the manifest to check this resource for updates.')}
        </p>;
    }
    if (!update) {
        return <p className="text-dense text-muted-foreground">
            {resource.canUpdate
                ? t('Not checked yet. Use Check for updates.')
                : t('Not checked, because the panel cannot replace this resource.')}
        </p>;
    }

    const published = update.publishedAt ? Date.parse(update.publishedAt) : NaN;
    return <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {update.hasUpdate
                ? <Badge variant="info">{t('Update available: {version}', { version: update.latest ?? '' })}</Badge>
                : update.error
                    ? <Badge variant="warning">{t('Could not check')}</Badge>
                    : <Badge variant="success">{t('Up to date')}</Badge>}
            {update.latest && !update.hasUpdate && <span className="font-mono text-xs text-muted-foreground">
                {t('Latest release: {version}', { version: update.latest })}
            </span>}
            {!Number.isNaN(published) && <span className="text-xs tabular-nums text-muted-foreground">
                {t('Released {date}', { date: tsToLocaleDateTimeString(published, 'medium', 'short') })}
            </span>}
            {update.releaseUrl && <TxAnchor href={update.releaseUrl} className="text-dense">{t('Release notes')}</TxAnchor>}
        </div>
        {update.error && <p className="text-dense text-muted-foreground">{t(checkErrorCopy[update.error])}</p>}
    </div>;
}

/**
 * Version, authorship, dependency edges, repository, update status and backups of one resource.
 */
export default function ResourceDetails({ id, resource, isMaster, isBusy, onUpdate, onRollback }: ResourceDetailsProps) {
    const canOfferUpdate = resource.canUpdate && Boolean(resource.githubRepo) && Boolean(resource.update?.hasUpdate) && !resource.pendingRestart;
    const showMasterNotice = !isMaster && resource.canUpdate && (canOfferUpdate || resource.backups.length > 0);

    return <div id={id} className="flex flex-col gap-6 border-t border-hairline pt-4">
        <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem label={t('Version')}>
                {resource.version ? <span className="break-all font-mono text-dense">{resource.version}</span> : <Muted>{t('Not set')}</Muted>}
            </DetailItem>
            <DetailItem label={t('Author')}>
                {resource.author ? <span className="break-words">{resource.author}</span> : <Muted>{t('Not set')}</Muted>}
            </DetailItem>
            <DetailItem label={t('Dependencies')}>
                {resource.dependencies.length ? <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {resource.dependencies.map((dependency) => <li key={dependency.name} className="flex items-center gap-2">
                        <span className="break-all font-mono text-dense">{dependency.name}</span>
                        {dependency.missing && <Badge variant="danger">{t('Missing')}</Badge>}
                    </li>)}
                </ul> : <Muted>{t('None')}</Muted>}
            </DetailItem>
            <DetailItem label={t('Required by')}>
                {resource.dependents.length ? <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {resource.dependents.map((name) => <li key={name} className="break-all font-mono text-dense">{name}</li>)}
                </ul> : <Muted>{t('None')}</Muted>}
            </DetailItem>
            <DetailItem label={t('Repository')}>
                {resource.repositoryUrl
                    ? <TxAnchor href={resource.repositoryUrl} className="break-all text-sm">{resource.githubRepo ?? resource.repository}</TxAnchor>
                    : resource.repository
                        ? <span className="break-all font-mono text-dense">{resource.repository}</span>
                        : <Muted>{t('Not set')}</Muted>}
            </DetailItem>
            <DetailItem label={t('Updates')}>
                <UpdateStatus resource={resource} />
            </DetailItem>
        </dl>

        {(resource.canUpdate || resource.backups.length > 0) ? <div className="flex flex-col gap-3">
            {canOfferUpdate && isMaster && <div>
                <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => onUpdate(resource)}>
                    {t('Update to {version}', { version: resource.update?.latest ?? '' })}
                </Button>
            </div>}
            {showMasterNotice && <p className="text-dense text-muted-foreground">
                {t('Only the master account can update or roll back resources.')}
            </p>}

            <div className="flex flex-col gap-2">
                <h3 className="text-dense font-medium text-white">{t('Backups')}</h3>
                {resource.backups.length ? <ul className="flex flex-col divide-y divide-hairline">
                    {resource.backups.map((backup) => <li key={backup.id} className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 py-2">
                        <span className="break-all font-mono text-dense text-white">{backup.version}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                            {tsToLocaleDateTimeString(backup.createdAt, 'medium', 'short')}
                        </span>
                        {isMaster && resource.canUpdate && <Button
                            size="sm"
                            variant="secondary"
                            className="ml-auto"
                            disabled={isBusy}
                            onClick={() => onRollback(resource, backup)}
                        >
                            {t('Roll back')}
                        </Button>}
                    </li>)}
                </ul> : <p className="text-dense text-muted-foreground">{t('No backups yet. One is kept each time the panel replaces this resource.')}</p>}
            </div>
        </div> : <p className="text-dense text-muted-foreground">
            {t('System resources, the monitor and resources outside the server data folder cannot be replaced from the panel.')}
        </p>}
    </div>;
}
