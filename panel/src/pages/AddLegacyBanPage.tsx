import { useAdminPerms } from "@/hooks/auth";
import { useRef, useState } from "react";
import { ApiAddLegacyBanReqSchema, GetBanTemplatesSuccessResp, SaveBanTemplatesReq } from "@shared/otherTypes";
import { useBackendApi } from "@/hooks/fetch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import BanForm, { BanFormType } from "@/components/BanForm";
import { txToast } from "@/components/TxToaster";
import { GenericApiOkResp } from "@shared/genericApiTypes";
import useSWR from "swr";
import { t } from "@/lib/i18n";


export default function AddLegacyBanPage() {
    const idsTextareaRef = useRef<HTMLTextAreaElement>(null);
    const banFormRef = useRef<BanFormType>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { hasPerm } = useAdminPerms();

    const getBanTemplatesApi = useBackendApi<GetBanTemplatesSuccessResp>({
        method: 'GET',
        path: `/settings/banTemplates`,
        throwGenericErrors: true,
    });

    const legacyBanApi = useBackendApi<GenericApiOkResp, ApiAddLegacyBanReqSchema>({
        method: 'POST',
        path: `/history/addLegacyBan`,
        throwGenericErrors: true,
    });


    const handleSave = () => {
        if (!idsTextareaRef.current || !banFormRef.current) return;
        const { reason, duration } = banFormRef.current.getData();

        if (!reason || reason.length < 3) {
            txToast.warning(t('The reason must be at least 3 characters long.'));
            banFormRef.current.focusReason();
            return;
        }
        const rawIds = idsTextareaRef.current.value;
        if (!rawIds) {
            txToast.warning(t('You must enter at least one identifier.'));
            idsTextareaRef.current.focus();
            return;
        }
        const identifiers = rawIds
            .toLowerCase()
            .split(/[,;\s\n]+/g)
            .map(id => id.trim())
            .filter(Boolean);
        if (!identifiers.length) {
            txToast.warning(t('You must enter at least one valid identifier.'));
            idsTextareaRef.current.focus();
            return;
        }

        setIsSaving(true);
        legacyBanApi({
            data: { identifiers, reason, duration },
            toastLoadingMessage: t('Banning identifiers...'),
            genericHandler: {
                successMsg: t('Identifiers banned.'),
            },
            finally: () => setIsSaving(false),
            success: (data) => {
                idsTextareaRef.current!.value = '';
                idsTextareaRef.current!.focus();
            },
            error: (error) => {
                idsTextareaRef.current!.focus();
            },
        });
    };

    const swrBanTemplates = useSWR('/settings/banTemplates', async () => {
        const data = await getBanTemplatesApi({});
        if (!data) throw new Error('No data returned');
        return data;
    });

    const canBan = hasPerm('players.ban');
    return (
        <div className="w-full pb-8">
            <PageHeader
                title={t('Ban Identifiers')}
                subtitle={t('Ban identifiers such as license and discord without searching for a registered player.')}
            />
            <div className="flex w-full max-w-screen-lg flex-col gap-6">
                {!canBan && <Alert variant="warning">
                    <AlertDescription>{t('Read-only: you need the Player: Ban permission to ban identifiers.')}</AlertDescription>
                </Alert>}
                <section className="grid gap-6 rounded-lg bg-raise p-4 sm:p-6 lg:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="banIdentifiers">
                            {t('Identifiers')}
                        </Label>
                        <Textarea
                            id="banIdentifiers"
                            ref={idsTextareaRef}
                            className="min-h-32 flex-1 font-mono"
                            disabled={isSaving || !canBan}
                            placeholder="discord:xxxx, fivem:xxxx, license:xxxx, steam:xxxx, etc..."
                        />
                        <p className="text-dense text-muted-foreground">
                            {t('Bans without a license identifier are legacy bans. Avoid them when you can.')}
                        </p>
                    </div>
                    <BanForm
                        ref={banFormRef}
                        banTemplates={swrBanTemplates.data}
                        disabled={isSaving || !canBan}
                    />
                </section>
                <div className="flex flex-wrap gap-2">
                    <Button
                        disabled={isSaving || !canBan}
                        onClick={handleSave}
                    >
                        {isSaving ? t('Banning...') : t('Apply Ban')}
                    </Button>
                    <Button
                        variant="secondary"
                        disabled={isSaving || !canBan}
                        onClick={() => {
                            banFormRef.current?.clearData()
                        }}
                    >
                        {t('Clear')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
