import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/auth';
import { useAccountModal } from '@/hooks/dialogs';
import { ExternalLink } from 'lucide-react';
import { t } from '@/lib/i18n';

export default function AccountDialog() {
    const { authData } = useAuth();
    const { isAccountModalOpen, setAccountModalOpen } = useAccountModal();
    if (!authData) return null;

    return (
        <Dialog open={isAccountModalOpen} onOpenChange={setAccountModalOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('Your Account — {name}', { name: authData.name })}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                    {t('Authentication and linked identities are managed by chyarologin. Panel roles and permissions remain local to this server.')}
                </p>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setAccountModalOpen(false)}>{t('Close')}</Button>
                    <Button onClick={() => window.open(window.txConsts.chyaroUrl, '_blank', 'noopener,noreferrer')}>
                        <ExternalLink className="mr-2 h-4 w-4" /> {t('Open chyarologin')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
