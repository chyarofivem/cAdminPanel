import { useRef, useState } from 'react';
import useSWR from 'swr';
import { Gavel, Mail, ShieldCheck, TriangleAlert, UserMinus } from 'lucide-react';
import { useLocation } from 'wouter';
import BanForm, { type BanFormType } from '@/components/BanForm';
import { txToast } from '@/components/TxToaster';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useAdminPerms } from '@/hooks/auth';
import { useOpenPromptDialog } from '@/hooks/dialogs';
import { useAuthedFetcher, useBackendApi } from '@/hooks/fetch';
import { t } from '@/lib/i18n';
import type { GenericApiOkResp } from '@shared/genericApiTypes';
import type { ApiAddLegacyBanReqSchema, GetBanTemplatesSuccessResp } from '@shared/otherTypes';
import { toCadminLicenseIdentifier } from '@/pages/CAdmin/api';

export type PlayerActionTarget = {
    license: string;
    name: string;
    isOnline: boolean;
    isRegistered: boolean;
    ids?: string[];
};

export function buildGiveAdminHref(target: PlayerActionTarget): string {
    const params = new URLSearchParams({
        autofill: 'true',
        name: target.name,
        license: target.license,
    });
    for (const id of target.ids ?? []) {
        if (id.startsWith('fivem:')) params.set('citizenfx', id);
        if (id.startsWith('discord:')) params.set('discord', id);
    }
    return `/admins?${params.toString()}`;
}

type Props = {
    target: PlayerActionTarget;
    extended?: boolean;
    onChanged?: () => void;
    className?: string;
};

export default function PlayerActions({ target, extended = false, onChanged, className }: Props) {
    const { hasPerm } = useAdminPerms();
    const openPromptDialog = useOpenPromptDialog();
    const fetcher = useAuthedFetcher();
    const setLocation = useLocation()[1];
    const banFormRef = useRef<BanFormType>(null);
    const [banOpen, setBanOpen] = useState(false);
    const [working, setWorking] = useState<string | null>(null);

    const kickApi = useBackendApi<GenericApiOkResp>({ method: 'POST', path: '/player/kick', throwGenericErrors: true });
    const warnApi = useBackendApi<GenericApiOkResp>({ method: 'POST', path: '/player/warn', throwGenericErrors: true });
    const messageApi = useBackendApi<GenericApiOkResp>({ method: 'POST', path: '/player/message', throwGenericErrors: true });
    const banApi = useBackendApi<GenericApiOkResp>({ method: 'POST', path: '/player/ban', throwGenericErrors: true });
    const identifierBanApi = useBackendApi<GenericApiOkResp, ApiAddLegacyBanReqSchema>({
        method: 'POST',
        path: '/history/addLegacyBan',
        throwGenericErrors: true,
    });
    const banTemplates = useSWR<GetBanTemplatesSuccessResp>(banOpen ? '/settings/banTemplates' : null, fetcher);

    const finish = () => {
        setWorking(null);
        onChanged?.();
    };

    const kick = () => openPromptDialog({
        title: t('Kick {name}', { name: target.name }),
        message: t('Enter a kick reason or leave it blank.'),
        placeholder: t('Kick reason'),
        submitLabel: t('Kick player'),
        onSubmit: reason => {
            setWorking('kick');
            void kickApi({
                queryParams: { license: target.license },
                data: { reason },
                toastLoadingMessage: t('Kicking player...'),
                genericHandler: { successMsg: t('Player kicked.') },
                success: finish,
                finally: () => setWorking(null),
            });
        },
    });

    const warn = () => openPromptDialog({
        title: t('Warn {name}', { name: target.name }),
        message: t('The warning is delivered now or when the player next connects.'),
        placeholder: t('Warning reason'),
        submitLabel: t('Warn player'),
        required: true,
        onSubmit: reason => {
            setWorking('warn');
            void warnApi({
                queryParams: { license: target.license },
                data: { reason },
                toastLoadingMessage: t('Warning player...'),
                genericHandler: { successMsg: t('Player warned.') },
                success: finish,
                finally: () => setWorking(null),
            });
        },
    });

    const message = () => openPromptDialog({
        title: t('Message {name}', { name: target.name }),
        message: t('Send a private in-game message to this player.'),
        placeholder: t('Message'),
        submitLabel: t('Send message'),
        required: true,
        onSubmit: input => {
            setWorking('message');
            void messageApi({
                queryParams: { license: target.license },
                data: { message: input },
                toastLoadingMessage: t('Sending message...'),
                genericHandler: { successMsg: t('Message sent.') },
                success: finish,
                finally: () => setWorking(null),
            });
        },
    });

    const applyBan = () => {
        const form = banFormRef.current;
        if (!form) return;
        const { reason, duration } = form.getData();
        if (!reason || reason.length < 3) {
            txToast.warning(t('The reason must be at least 3 characters long.'));
            form.focusReason();
            return;
        }

        setWorking('ban');
        const callbacks = {
            toastLoadingMessage: t('Banning player...'),
            genericHandler: { successMsg: t('Player banned.') },
            success: () => {
                setBanOpen(false);
                finish();
            },
            finally: () => setWorking(null),
        };
        if (target.isRegistered || target.isOnline) {
            void banApi({
                queryParams: { license: target.license },
                data: { reason, duration },
                ...callbacks,
            });
            return;
        }

        const identifier = toCadminLicenseIdentifier(target.license);
        if (!identifier) {
            setWorking(null);
            txToast.error(t('This player does not have a valid FiveM license identifier.'));
            return;
        }
        void identifierBanApi({
            data: { identifiers: [identifier], reason, duration },
            ...callbacks,
        });
    };

    const busy = working !== null;
    return <>
        <div className={className ?? 'flex flex-wrap gap-2'} onClick={event => event.stopPropagation()}>
            <Button
                size="sm"
                variant="outline"
                disabled={busy || !target.isOnline || !hasPerm('players.kick')}
                onClick={kick}
            >
                <UserMinus className="mr-1.5 size-4" />{t('Kick')}
            </Button>
            <Button
                size="sm"
                variant="destructive"
                disabled={busy || !hasPerm('players.ban')}
                onClick={() => setBanOpen(true)}
            >
                <Gavel className="mr-1.5 size-4" />{t('Ban')}
            </Button>
            <Button
                size="sm"
                variant="outline"
                disabled={busy || !hasPerm('manage.admins')}
                onClick={() => setLocation(buildGiveAdminHref(target))}
            >
                <ShieldCheck className="mr-1.5 size-4" />{t('Give Admin')}
            </Button>
            {extended && <>
                <Button size="sm" variant="outline" disabled={busy || !hasPerm('players.warn')} onClick={warn}>
                    <TriangleAlert className="mr-1.5 size-4" />{t('Warn')}
                </Button>
                <Button size="sm" variant="outline" disabled={busy || !target.isOnline || !hasPerm('players.direct_message')} onClick={message}>
                    <Mail className="mr-1.5 size-4" />{t('Message')}
                </Button>
            </>}
        </div>

        <Dialog open={banOpen} onOpenChange={open => !busy && setBanOpen(open)}>
            <DialogContent className="max-w-2xl border-white/10 bg-[#17191e]">
                <DialogHeader>
                    <DialogTitle>{t('Ban {name}', { name: target.name })}</DialogTitle>
                    <DialogDescription>{t('Choose a reason and duration. Active identifiers and hardware tokens are included when available.')}</DialogDescription>
                </DialogHeader>
                {banTemplates.error
                    ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{t('Unable to load ban templates.')}</div>
                    : <BanForm ref={banFormRef} banTemplates={banTemplates.data} disabled={busy} />}
                <DialogFooter>
                    <Button variant="outline" disabled={busy} onClick={() => setBanOpen(false)}>{t('Cancel')}</Button>
                    <Button variant="destructive" disabled={busy || Boolean(banTemplates.error)} onClick={applyBan}>
                        {working === 'ban' ? t('Banning...') : t('Apply Ban')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>;
}
