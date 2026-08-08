const modulename = 'WebCtxUtils';
import fsp from "node:fs/promises";
import path from "node:path";
import type { InjectedTxConsts, ThemeType } from '@shared/otherTypes';
import { txEnv, txDevEnv, txHostConfig } from "@core/globalData";
import { AuthedCtx, CtxWithVars } from "./ctxTypes";
import consts from "@shared/consts";
import consoleFactory from '@lib/console';
import { AuthedAdminType, checkRequestAuth } from "./authLogic";
import { isString } from "@modules/CacheStore";
import {
    escapeHtmlAttribute,
    escapeHtmlContent,
    escapeHtmlRawText,
    sanitizeClassToken,
    sanitizeCssVarName,
    sanitizeCssVarValue,
} from "@lib/htmlRenderSafety";
import { accentOptions, accentVars, resolveAccent } from "@lib/theme";
import { brandingViewLocals } from "@lib/branding";
const console = consoleFactory(modulename);

// NOTE: it's not possible to remove the hardcoded import of the entry point in the index.html file
// even if you set the entry point manually in the vite config.
// Therefore, it was necessary to tag it with `data-prod-only` so it can be removed in dev mode.

//Consts
const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

//Cache the index.html file unless in dev mode
let htmlFile: string;

// NOTE: https://vitejs.dev/guide/backend-integration.html
const viteOrigin = txDevEnv.VITE_URL ?? 'doesnt-matter';
const devModulesScript = `<script type="module">
        import { injectIntoGlobalHook } from "${viteOrigin}/@react-refresh";
        injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
        window.__vite_plugin_react_preamble_installed__ = true;
    </script>
    <script type="module" src="${viteOrigin}/@vite/client"></script>
    <script type="module" src="${viteOrigin}/src/main.tsx"></script>`;


//Custom themes placeholder
export const tmpDefaultTheme = 'dark';
export const tmpDefaultThemes = ['dark', 'light'];
export const tmpCustomThemes: ThemeType[] = accentOptions().map(option => ({
    name: option.id,
    isDark: true,
    style: option.vars,
}));



/**
 * Returns the react index.html file with placeholders replaced
 * FIXME: add favicon
 */
export default async function getReactIndex(ctx: CtxWithVars | AuthedCtx) {
    //Read file if not cached
    if (txDevEnv.ENABLED || !htmlFile) {
        try {
            const indexPath = txDevEnv.ENABLED
                ? path.join(txDevEnv.SRC_PATH, '/panel/index.html')
                : path.join(txEnv.txaPath, 'panel/index.html')
            const rawHtmlFile = await fsp.readFile(indexPath, 'utf-8');

            //Remove tagged lines (eg hardcoded entry point) depending on env
            if (txDevEnv.ENABLED) {
                htmlFile = rawHtmlFile.replaceAll(/.+data-prod-only.+\r?\n/gm, '');
            } else {
                htmlFile = rawHtmlFile.replaceAll(/.+data-dev-only.+\r?\n/gm, '');
            }
        } catch (error) {
            if ((error as any).code == 'ENOENT') {
                return `<h1>⚠ index.html not found:</h1><pre>You probably deleted the 'citizen/system_resources/monitor/panel/index.html' file, or the folders above it.</pre>`;
            } else {
                return `<h1>⚠ index.html load error:</h1><pre>${(error as Error).message}</pre>`
            }
        }
    }

    //Checking if already logged in
    const authResult = checkRequestAuth(
        ctx.request.headers,
        ctx.ip,
        ctx.txVars.isLocalRequest,
        ctx.sessTools
    );
    let authedAdmin: AuthedAdminType | false = false;
    if (authResult.success) {
        authedAdmin = authResult.admin;
    }

    //Preparing vars
    const basePath = (ctx.txVars.isWebInterface) ? '/' : consts.nuiWebpipePath;
    const branding = brandingViewLocals();
    const injectedConsts: InjectedTxConsts = {
        //env
        fxsVersion: txEnv.fxsVersionTag,
        fxsOutdated: txCore.updateChecker.fxsUpdateData,
        txaVersion: txEnv.txaVersion,
        txaOutdated: txCore.updateChecker.txaUpdateData,
        serverTimezone,
        isWindows: txEnv.isWindows,
        isWebInterface: ctx.txVars.isWebInterface,
        showAdvanced: (txDevEnv.ENABLED || console.isVerbose),
        hasMasterAccount: txCore.adminStore.hasAdmins(true),
        chyaroConfigured: txConfig.chyaro.apiKey.length > 0,
        chyaroUrl: txConfig.chyaro.apiUrl,
        cadminEnabled: txConfig.cadmin.enabled,
        uiLocale: txConfig.general.language === 'hr' ? 'hr' : 'en',
        defaultTheme: tmpDefaultTheme,
        customThemes: tmpCustomThemes.map(({ name, isDark }) => ({ name, isDark })),
        accent: branding.accent,
        accents: accentOptions(),
        panelName: branding.panelName,
        logoUrl: branding.logoUrl,
        faviconUrl: branding.faviconUrl,
        bannerUrl: branding.bannerUrl,
        providerLogo: txHostConfig.providerLogo,
        providerName: txHostConfig.providerName,
        hostConfigSource: txHostConfig.sourceName,

        //Login page info
        server: {
            name: txCore.cacheStore.getTyped('fxsRuntime:projectName', isString) ?? txConfig.general.serverName,
            game: txCore.cacheStore.getTyped('fxsRuntime:gameName', isString),
            icon: txCore.cacheStore.getTyped('fxsRuntime:iconFilename', isString),
        },

        //auth
        preAuth: authedAdmin && authedAdmin.getAuthData(),
    };

    //Prepare placeholders
    const replacers: { [key: string]: string } = {};
    replacers.basePath = `<base href="${escapeHtmlAttribute(basePath)}">`;
    replacers.panelName = escapeHtmlContent(branding.panelName);
    replacers.faviconUrl = escapeHtmlAttribute(branding.faviconUrl);
    replacers.ogTitle = escapeHtmlAttribute(branding.panelName);
    replacers.ogDescripttion = escapeHtmlAttribute(`Manage and monitor ${branding.panelName} atop FXServer ${txEnv.fxsVersion}.`);
    replacers.txConstsInjection = `<script>window.txConsts = ${escapeHtmlRawText(JSON.stringify(injectedConsts))};</script>`;
    replacers.devModules = txDevEnv.ENABLED ? devModulesScript : '';

    //Prepare custom themes style tag
    const selectedAccentVars = accentVars(resolveAccent(txConfig.general.accent));
    const configuredAccentCss = Object.entries(selectedAccentVars)
        .map(([name, value]) => `--${name}: ${value};`)
        .join(' ');
    replacers.customThemesStyle = `<style>:root { ${escapeHtmlRawText(configuredAccentCss)} }</style>`;
    if (tmpCustomThemes.length) {
        const cssThemes = [];
        for (const theme of tmpCustomThemes) {
            const cssVars = [];
            const safeThemeName = sanitizeClassToken(theme.name);
            if (!safeThemeName) continue;
            for (const [name, value] of Object.entries(theme.style)) {
                const safeName = sanitizeCssVarName(name);
                const safeValue = sanitizeCssVarValue(value);
                if (!safeName || !safeValue) continue;
                cssVars.push(`--${safeName}: ${safeValue};`);
            }
            cssThemes.push(`.theme-${safeThemeName} { ${cssVars.join(' ')} }`);
        }
        replacers.customThemesStyle = `<style>:root { ${escapeHtmlRawText(configuredAccentCss)} } ${escapeHtmlRawText(cssThemes.join('\n'))}</style>`;
    }

    //Setting the theme class from the cookie
    let htmlClasses = tmpDefaultTheme;
    const themeCookie = ctx.cookies.get(consts.cookies.theme);
    if (themeCookie) {
        if (tmpDefaultThemes.includes(themeCookie)) {
            htmlClasses = themeCookie;
        } else {
            const selectedCustomTheme = tmpCustomThemes.find((theme) => theme.name === themeCookie);
            if (!selectedCustomTheme) {
                htmlClasses = tmpDefaultTheme;
            } else {
                const lightDarkSelector = selectedCustomTheme.isDark ? 'dark' : 'light';
                htmlClasses = `${lightDarkSelector} theme-${selectedCustomTheme.name}`;
            }
        }
    }
    replacers.htmlClasses = escapeHtmlAttribute(htmlClasses);

    //Replace
    let htmlOut = htmlFile;
    for (const [placeholder, value] of Object.entries(replacers)) {
        const replacerRegex = new RegExp(`(<!--\\s*)?{{${placeholder}}}(\\s*-->)?`, 'g');
        htmlOut = htmlOut.replaceAll(replacerRegex, value);
    }

    //If in prod mode and NUI, replace the entry point with the local one
    //This is required because of how badly the WebPipe handles "large" files
    if (!txDevEnv.ENABLED) {
        const base = ctx.txVars.isWebInterface ? `./` : `nui://monitor/panel/`;
        htmlOut = htmlOut.replaceAll(/(src|href)="\.\/(\w+)-(\w+(?:\.v\d+)?)\.(js|css)"/g, `$1="${base}$2-$3.$4"`);
    }

    return htmlOut;
}
