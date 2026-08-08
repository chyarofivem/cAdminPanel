import { Route, Switch } from 'wouter';
import Login from '../pages/auth/Login';
import { Card } from '../components/ui/card';
import { t } from '@/lib/i18n';

export default function AuthShell() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#111318_0%,#090a0d_100%)] px-4 py-8 sm:px-6">
            <div className="w-full max-w-lg">
                <Card className="overflow-hidden rounded-2xl border-white/10 bg-[#111318] shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                    <Switch>
                        <Route path="/login"><Login /></Route>
                        <Route path="/:fullPath*">
                            <div className="p-8 text-center text-muted-foreground">{t('404 | Not Found')}</div>
                        </Route>
                    </Switch>
                </Card>
                <footer className="mt-4 text-center text-[11px] text-zinc-700">
                    <span>&copy; {t('chyarogroup')} 2026</span>
                    <span className="mx-2">·</span>
                    <span>txAdmin v{window.txConsts.txaVersion}</span>
                    <span className="mx-2">·</span>
                    <span>FXServer b{window.txConsts.fxsVersion}</span>
                </footer>
            </div>
        </div>
    );
}
