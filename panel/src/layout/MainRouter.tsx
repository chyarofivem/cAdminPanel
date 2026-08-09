import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Route as WouterRoute, Switch, useRoute } from "wouter";
import { PageErrorFallback } from "@/components/ErrorFallback";
import { useAtomValue, useSetAtom } from "jotai";
import { contentRefreshKeyAtom, pageErrorStatusAtom, useSetPageTitle } from "@/hooks/pages";
import { navigate as setLocation } from 'wouter/use-browser-location';
import { useAdminPerms } from "@/hooks/auth";

import Iframe from "@/pages/Iframe";
import NotFound from "@/pages/NotFound";
import TestingPage from "@/pages/TestingPage/TestingPage";
import LiveConsolePage from "@/pages/LiveConsole/LiveConsolePage";
import HistoryPage from "@/pages/History/HistoryPage";
import BanTemplatesPage from "@/pages/BanTemplates/BanTemplatesPage";
import AddLegacyBanPage from "@/pages/AddLegacyBanPage";
import DashboardPage from "@/pages/Dashboard/DashboardPage";
import PlayerDropsPage from "@/pages/PlayerDropsPage/PlayerDropsPage";
import SettingsPage from "@/pages/Settings/SettingsPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import DiagnosticsPage from "@/pages/Diagnostics/DiagnosticsPage";
import AdvancedPage from "@/pages/AdvancedPage";
import CadminUsersPage from '@/pages/CAdmin/UsersPage';
import AdminsPage from '@/pages/Admins/AdminsPage';
import AllowlistPage from '@/pages/Allowlist/AllowlistPage';
import CfgEditorPage from '@/pages/CfgEditor/CfgEditorPage';
import PlayerDetailPage from '@/pages/PlayerManagement/PlayerDetailPage';
import PlayerManagementPage from '@/pages/PlayerManagement/PlayerManagementPage';
import ResourcesPage from '@/pages/Resources/ResourcesPage';
import TxAdminLogPage from '@/pages/TxAdminLogPage';
import SetupPage from '@/pages/Setup/SetupPage';
import { t } from '@/lib/i18n';
import UserSettingsPage from '@/pages/UserSettingsPage';
import MasterActionsPage from '@/pages/MasterActions/MasterActionsPage';


type RouteType = {
    path: string;
    title: string;
    permission?: string;
    Page: JSX.Element;
    requiresCadmin?: boolean;
};

const allRoutes: RouteType[] = [
    //Global Routes
    {
        path: '/administration/players',
        title: 'Player Management',
        Page: <PlayerManagementPage />,
    },
    {
        path: '/administration/players/:license',
        title: 'Player Management',
        Page: <PlayerDetailPage />,
    },
    {
        path: '/history',
        title: 'History',
        Page: <HistoryPage />
    },
    {
        path: '/allowlist',
        title: 'Allowlist',
        Page: <LegacyRedirect to="/system/allowlist" />,
    },
    {
        path: '/players',
        title: 'Player Management',
        Page: <LegacyRedirect to="/administration/players" />,
    },
    {
        path: '/cadmin/players',
        title: 'Player Management',
        Page: <LegacyRedirect to="/administration/players" />,
    },
    {
        path: '/cadmin/player/:identifier',
        title: 'Player Management',
        Page: <LegacyPlayerRedirect />,
    },
    {
        path: '/cadmin/garage',
        title: 'Player Management',
        Page: <LegacyRedirect to="/administration/players" />,
    },
    {
        path: '/cadmin/users',
        title: 'Linked Accounts',
        permission: 'master',
        requiresCadmin: true,
        Page: <CadminUsersPage />,
    },
    {
        path: '/insights/player-drops',
        title: 'Player Drops',
        Page: <PlayerDropsPage />
    },
    {
        path: '/system/allowlist',
        title: 'Allowlist',
        Page: <AllowlistPage />,
    },
    {
        path: '/admins',
        title: 'Staff & Permissions',
        permission: 'manage.admins',
        Page: <AdminsPage />
    },
    {
        path: '/user-settings',
        title: 'User settings',
        Page: <UserSettingsPage />,
    },
    {
        path: '/settings',
        title: 'Settings',
        permission: 'settings.view',
        Page: <SettingsPage />
    },
    {
        path: '/system/master-actions',
        title: 'Master Actions',
        permission: 'master',
        Page: <MasterActionsPage />
    },
    {
        path: '/system/diagnostics',
        title: 'Diagnostics',
        Page: <DiagnosticsPage />
    },
    {
        path: '/system/txadmin-log',
        title: 'txAdmin Log',
        permission: 'txadmin.log.combined',
        Page: <TxAdminLogPage />,
    },

    //Server Routes
    {
        path: '/',
        title: 'Dashboard',
        Page: <DashboardPage />
    },
    {
        path: '/server/console-log',
        title: 'Console Log',
        permission: 'console.view',
        Page: <LiveConsolePage />,
    },
    {
        path: '/server/resources',
        title: 'Resources',
        Page: <ResourcesPage />,
    },
    {
        path: '/server/cfg-editor',
        title: 'CFG Editor',
        permission: 'master',
        Page: <CfgEditorPage />,
    },
    {
        path: '/server/setup',
        title: 'Setup Wizard',
        permission: 'master', //FIXME: eithger change to all_permissions or create a new Setup/Deploy permission
        Page: <SetupPage />
    },
    {
        path: '/server/deployer',
        title: 'Setup Wizard',
        permission: 'master', //FIXME: eithger change to all_permissions or create a new Setup/Deploy permission
        Page: <Iframe legacyUrl="deployer" />
    },
    {
        path: '/advanced',
        title: 'Advanced',
        permission: 'all_permissions',
        Page: <AdvancedPage />
    },

    // Retain old bookmarks while keeping every document URL separate from JSON APIs.
    {
        path: '/server/console',
        title: 'Console Log',
        Page: <LegacyRedirect to="/server/console-log" />,
    },
    {
        path: '/system/console-log',
        title: 'Console Log',
        Page: <LegacyRedirect to="/server/console-log" />,
    },
    {
        path: '/system/action-log',
        title: 'txAdmin Log',
        Page: <LegacyRedirect to="/system/txadmin-log" />,
    },
    {
        path: '/server/server-log',
        title: 'txAdmin Log',
        Page: <LegacyRedirect to="/system/txadmin-log" />,
    },
    {
        path: '/cadmin/logs',
        title: 'txAdmin Log',
        Page: <LegacyRedirect to="/system/txadmin-log" />,
    },

    //No nav routes
    {
        path: '/settings/ban-templates',
        title: 'Ban Templates',
        //NOTE: content is readonly for unauthorized accounts
        Page: <BanTemplatesPage />
    },
    {
        path: '/ban-identifiers',
        title: 'Ban Identifiers',
        Page: <AddLegacyBanPage />
    },
    //FIXME: decide on how to organize the url for the player drops page - /server/ prefix?
    //       This will likely be a part of the insights page, eventually
    // {
    //     path: '/player-crashes',
    //     title: 'Player Crashes',
    //     children: <PlayerCrashesPage />
    // },
];

function LegacyRedirect({ to }: { to: string }) {
    useEffect(() => setLocation(to, { replace: true }), [to]);
    return null;
}

function LegacyPlayerRedirect() {
    const [, params] = useRoute('/cadmin/player/:identifier');
    const identifier = params?.identifier ? decodeURIComponent(params.identifier) : '';
    return <LegacyRedirect to={`/administration/players?mode=playerIds&q=${encodeURIComponent(identifier)}`} />;
}


function Route(route: RouteType) {
    const { hasPerm } = useAdminPerms();
    const setPageTitle = useSetPageTitle();
    setPageTitle(t(route.title));
    const nodeToRender = route.requiresCadmin && !window.txConsts.cadminEnabled
        ? <UnauthorizedPage pageName={t(route.title)} permission={t('Character Management enabled')} />
        : route.permission && !hasPerm(route.permission)
        ? <UnauthorizedPage pageName={t(route.title)} permission={route.permission} />
        : route.Page;
    return <WouterRoute path={route.path}>{nodeToRender}</WouterRoute>
}


export function MainRouterInner() {
    return (
        <Switch>
            {allRoutes.map((route) => <Route key={route.path} {...route} />)}

            {/* Other Routes - they need to set the title manuually */}
            {import.meta.env.DEV && (
                <WouterRoute path="/test"><TestingPage /></WouterRoute>
            )}
            <WouterRoute component={NotFound} />
        </Switch>
    );
}


export default function MainRouter() {
    const setPageErrorStatus = useSetAtom(pageErrorStatusAtom);
    const contentRefreshKey = useAtomValue(contentRefreshKeyAtom);

    return (
        <ErrorBoundary
            key={contentRefreshKey}
            FallbackComponent={PageErrorFallback}
            onError={() => {
                console.log('Page ErrorBoundary caught an error');
                setPageErrorStatus(true);
            }}
            onReset={() => {
                console.log('Page ErrorBoundary reset');
                setLocation('/');
                setPageErrorStatus(false);
            }}
        >
            <MainRouterInner />
        </ErrorBoundary>
    );
}
