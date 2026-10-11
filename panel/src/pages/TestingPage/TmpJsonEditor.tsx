import { useState, useEffect } from "react"
import { Editor, loader } from "@monaco-editor/react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import TxAnchor from "@/components/TxAnchor"
import InlineCode from "@/components/InlineCode"
import { PageHeader } from "@/components/page-header"
import { editorThemeColors } from "@/lib/monacoTheme"

const beautifyJson = (json: string) => JSON.stringify(JSON.parse(json), null, 4)

type SheetBackdropProps = {
    isOpen: boolean;
    closeSheet: () => void;
}

function SheetBackdrop({ isOpen, closeSheet }: SheetBackdropProps) {
    return (
        <div
            className={cn(
                'absolute inset-0 z-20 bg-black/60',
                isOpen ? 'block' : 'hidden',
            )}
            data-state={isOpen ? 'open' : 'closed'}
            onClick={closeSheet}
        />
    )
}

interface JSONConfigEditorProps {
    description: React.ReactNode
    initialConfig?: string
    defaultConfig: string
    onSave: (config: string) => void
    onBack: () => void
    placeholders: Record<string, string>
}

// Configure monaco editor default theme
loader.init().then(monaco => {
    monaco.editor.defineTheme('txadmin-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: editorThemeColors,
    });
});

function DiscordJsonEditor({
    initialConfig = "{}",
    defaultConfig,
    onSave,
    onBack,
    description,
    placeholders,
}: JSONConfigEditorProps) {
    const [config, setConfig] = useState(initialConfig)
    const [error, setError] = useState<string | null>(null)
    const [isPanelOpen, setIsPanelOpen] = useState(false)

    useEffect(() => {
        try {
            JSON.parse(config)
            setError(null)
        } catch (e) {
            setError("Invalid JSON: " + (e as Error).message)
        }
    }, [config])

    const handleSave = () => {
        setError("Invalid JSON: xxx")
        // if (!error) {
        //     onSave(config)
        // }
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            {/* <div className="px-2 md:px-0">
                {description} <br />
                <span className="text-muted-foreground italic">
                    TIP: You can also drag and drop to reorder the list. <br />
                </span>
            </div> */}
            <div className="flex-none space-y-2 mb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{description}</p>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsPanelOpen(!isPanelOpen)}
                        className="flex-none"
                    >
                        {isPanelOpen ? "Hide placeholders" : "Show placeholders"}
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative flex-1 overflow-hidden rounded-lg bg-sunken">
                {/* Overlay Panel */}
                <div className="absolute inset-0 rounded-[inherit]">
                    <SheetBackdrop isOpen={isPanelOpen} closeSheet={() => setIsPanelOpen(false)} />
                    <div
                        className={cn(
                            "absolute right-0 top-0 z-20 h-full w-full max-w-80 bg-modal",
                            isPanelOpen ? "block" : "hidden",
                        )}
                    >
                        <ScrollArea className="h-full">
                            <div className="p-4 mr-4 space-y-2">
                                <h3 className="text-base font-semibold text-white">Available placeholders</h3>
                                <ul className="space-y-4">
                                    {Object.entries(placeholders).map(([pString, pDesc]) => (
                                        <li key={pString}>
                                            <InlineCode
                                                className="mb-1 block py-1"
                                            >
                                                {`{{${pString}}}`}
                                            </InlineCode>
                                            <span className="text-sm text-muted-foreground">{pDesc}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </ScrollArea>
                    </div>
                </div>
                {/* Editor */}
                <Editor
                    defaultLanguage="json"
                    value={config}
                    onChange={(value) => setConfig(value || "")}
                    theme="txadmin-dark"
                    beforeMount={(monaco) => {
                        monaco.editor.setTheme('txadmin-dark');
                    }}
                    options={{
                        automaticLayout: true,
                        minimap: { enabled: false },
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        theme: "vs-dark",
                    }}
                />
            </div>

            {/* Footer */}
            <div className="flex-none mt-4">
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handleSave} disabled={!!error}>Save changes</Button>
                    <Button variant="secondary" onClick={() => setConfig(initialConfig)}>Discard changes</Button>
                    <Button variant="secondary" onClick={() => setConfig(defaultConfig)}>Reset to default</Button>
                    <Button variant="secondary" onClick={onBack}>Back</Button>
                </div>
            </div>
        </div>
    )
}

const placeholderDescriptions = {
    serverCfxId: 'The Cfx.re id of your server, this is tied to your `sv_licenseKey` and detected at runtime.',
    serverJoinUrl: 'The direct join URL of your server. Example: `https://cfx.re/join/xxxxxx`.',
    serverBrowserUrl: 'The FiveM Server browser URL of your server. Example: `https://servers.fivem.net/servers/detail/xxxxxx`.',
    serverClients: 'The number of players online in your server.',
    serverMaxClients: 'The `sv_maxclients` of your server, detected at runtime.',
    serverName: 'This is the panel-given name for this server. Can be changed in `Settings > General`.',
    statusColor: 'A hex-encoded color, from the Config JSON.',
    statusString: 'A text to be displayed with the server status, from the Config JSON.',
    uptime: 'For how long is the server online. Example: `1 hr, 50 mins`.',
    nextScheduledRestart: 'String with when is the next scheduled restart. Example: `in 2 hrs, 48 mins`.',
};


export default function TmpJsonEditor() {
    return (
        <div className="w-full h-full flex flex-col max-h-contentvh">
            <PageHeader
                    title="Embed Editor"
                    parentName="Settings"
                    parentLink="/settings"
                />
            <div className="grow px-0 xs:px-3 md:px-0 w-full max-w-screen-lg mx-auto max-h-minx h-32">
                <DiscordJsonEditor
                    defaultConfig={beautifyJson('{}')}
                    initialConfig={beautifyJson('{}')} //just for testing
                    placeholders={placeholderDescriptions}
                    onSave={(config) => console.log("Saved config:", config)}
                    onBack={() => console.log("Back")}
                    description={(<>
                        The server status embed is customizable by editing the JSON below. <br />
                        You can use the placeholders to include dynamic server information in the embed. <br />
                        For information refer to <TxAnchor href="https://github.com/chyarofivem/cAdminPanel/blob/master/docs/discord-status.md">our docs</TxAnchor>.
                    </>)}
                />
            </div>
        </div>
    )
}
