import { Route, Switch } from 'wouter';
import Login from '../pages/auth/Login';
import { t } from '@/lib/i18n';

export default function AuthShell() {
    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-8 md:px-6">
            <div className="w-full max-w-md">
                <div className="rounded-lg bg-raise">
                    <Switch>
                        <Route path="/login"><Login /></Route>
                        <Route path="/:fullPath*">
                            <p className="p-6 text-sm text-muted-foreground">{t('404 | Not Found')}</p>
                        </Route>
                    </Switch>
                </div>
                <footer className="mt-4 text-center text-micro text-faint">
                    <div>Powered by cAdminPanel</div>
                    <div className="mt-0.5 uppercase tracking-widest">Panel v{window.txConsts.txaVersion} · FX b{window.txConsts.fxsVersion}</div>
                </footer>
            </div>
        </div>
    );
}
