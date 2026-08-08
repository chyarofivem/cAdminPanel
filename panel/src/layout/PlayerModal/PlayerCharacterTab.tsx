import useSWR from 'swr';
import { ExternalLinkIcon, UserRoundCogIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalTabInner, ModalTabMessage } from '@/components/modal-tabs';
import GenericSpinner from '@/components/GenericSpinner';
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

    if (!license) return <ModalTabMessage>{t('This txAdmin record has no FiveM license to match to a character.')}</ModalTabMessage>;
    if (swr.isLoading) return <ModalTabMessage><GenericSpinner msg={t('Loading character...')} /></ModalTabMessage>;
    if (swr.error || !players?.length) return <ModalTabMessage><span className="text-destructive-inline">{swr.error?.message || t('No framework character was found for this license.')}</span></ModalTabMessage>;

    const openFullProfile = (player: CadminPlayer) => {
        const txAdminLicense = toTxAdminLicense(player.playerLicense ?? player.identifier) ?? license;
        if (!txAdminLicense) return;
        closeModal();
        const characterId = cadminCharacterIdentifier(player);
        navigate(`/administration/players/${encodeURIComponent(txAdminLicense)}?character=${encodeURIComponent(characterId)}`);
    };

    return <ModalTabInner>
        <div className="space-y-2">{players.map(player => {
            const characterId = cadminCharacterIdentifier(player);
            return <div key={characterId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-4">
                <div><div className="flex items-center gap-2"><UserRoundCogIcon className="size-4 text-brand-400" /><p className="font-medium text-white">{player.name || t('Unnamed character')}</p><span className={player.online ? 'text-xs text-green-400' : 'text-xs text-zinc-500'}>{player.online ? t('Online') : t('Offline')}</span></div><p className="mt-1 font-mono text-[11px] text-zinc-500">{characterId}</p></div>
                <Button size="sm" variant="outline" onClick={() => openFullProfile(player)}>{t('Full profile')}<ExternalLinkIcon className="ml-2 size-3.5" /></Button>
            </div>;
        })}</div>
    </ModalTabInner>;
}
