import type { AuthedCtx } from '@modules/WebServer/ctxTypes';

const dangerousPermissions = new Set([
    'all_permissions',
    'manage.admins',
    'console.write',
    'settings.write',
]);

/** JSON data for the native Staff & Permissions page. */
export default async function AdminManagerData(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('manage.admins', 'WebServer:AdminManagerData')) {
        return ctx.send({ success: false, error: 'You do not have permission to manage staff.' });
    }

    const admins = txCore.adminStore.getAdminsList().map((admin: any) => {
        const isSelf = ctx.admin.name.toLowerCase() === admin.name.toLowerCase();
        return {
            name: admin.name,
            master: admin.master,
            isSelf,
            disableEdit: !ctx.admin.isMaster && admin.master,
            disableDelete: admin.master || isSelf,
            citizenfxId: admin.providers.citizenfx?.id ?? '',
            citizenfxIdentifier: admin.providers.citizenfx?.identifier ?? '',
            discordId: admin.providers.discord?.id ?? '',
            permissions: admin.permissions,
        };
    });

    const permissions = Object.entries(txCore.adminStore.getPermissionsList()).map(([id, label]) => ({
        id,
        label,
        dangerous: dangerousPermissions.has(id),
        section: id.startsWith('cadmin.')
            ? 'Character Management'
            : id.startsWith('players.') || id.startsWith('menu.')
                ? 'In-game Menu'
                : 'Panel & Server',
    }));

    return ctx.send({ success: true, data: { admins, permissions } });
}
