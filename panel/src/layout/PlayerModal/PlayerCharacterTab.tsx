import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListRow, ListRows } from '@/components/ListRow';
import { ModalTabInner, ModalTabMessage } from '@/components/modal-tabs';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useClosePlayerModal } from '@/hooks/playerModal';
import { navigate } from 'wouter/use-browser-location';
import {
    cadminApiPath,
    cadminCharacterIdentifier,
    cadminData,
    toCadminLicenseIdentifier,
    toTxAdminLicense,
    type CadminPlayer,
    type CadminResponse,
} from '@/pages/CAdmin/api';
import { t } from '@/lib/i18n';

export default function PlayerCharacterTab({ license }: { license: string | null }) {
    const fetcher = useAuthedFetcher();
    const closeModal = useClosePlayerModal();
    const cadminIdentifier = toCadminLicenseIdentifier(license);
    const url = cadminIdentifier ? `${cadminApiPath(`player/${encodeURIComponent(cadminIdentifier)}`)}?scope=player` : null;
    const swr = useSWR(url, async () => cadminData(await fetcher<CadminResponse<CadminPlayer[]>>(url!)));
    const players = swr.data;
    const retry = () => void swr.mutate().catch(() => undefined);

    if (!license) return <ModalTabMessage className="text-center text-sm">{t('This panel record has no FiveM license to match to a character.')}</ModalTabMessage>;
    if (swr.isLoading) return <ModalTabMessage className="text-sm"><span role="status">{t('Loading character...')}</span></ModalTabMessage>;
    if (swr.error) return <ModalTabMessage className="flex-col gap-4 text-center text-sm">
        <span role="alert" className="text-danger-text">{swr.error.message}</span>
        <Button size="sm" variant="secondary" disabled={swr.isValidating} onClick={retry}>
            {swr.isValidating ? t('Loading...') : t('Try again')}
        </Button>
    </ModalTabMessage>;
    if (!players?.length) return <ModalTabMessage className="flex-col gap-4 text-center text-sm">
        <span>{t('No framework character was found for this license.')}</span>
        <Button size="sm" variant="secondary" disabled={swr.isValidating} onClick={retry}>
            {swr.isValidating ? t('Loading...') : t('Try again')}
        </Button>
    </ModalTabMessage>;

    const openFullProfile = (player: CadminPlayer) => {
        const txAdminLicense = toTxAdminLicense(license);
        if (!txAdminLicense) return;
        closeModal();
        const characterId = cadminCharacterIdentifier(player);
        navigate(`/administration/players/${encodeURIComponent(txAdminLicense)}?character=${encodeURIComponent(characterId)}`);
    };

    return <ModalTabInner>
        <ListRows>{players.map(player => {
            const characterId = cadminCharacterIdentifier(player);
            return <ListRow key={characterId} className="flex-wrap justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{player.name || t('Unnamed character')}</p>
                        <Badge variant={player.online ? 'success' : 'default'}>{player.online ? t('Online') : t('Offline')}</Badge>
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{characterId}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => openFullProfile(player)}>{t('Full profile')}</Button>
            </ListRow>;
        })}</ListRows>
    </ModalTabInner>;
}
