import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import useWarningBar from "@/hooks/useWarningBar";

export default function TmpWarningBarState() {
    const {
        offlineWarning, setOfflineWarning,
    } = useWarningBar();

    return (
        <Card className="w-min">
            <CardHeader>
                <CardTitle>Warning Bar States</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                    <div className="flex justify-start gap-3">
                        <Button size="sm" variant="secondary" onClick={() => setOfflineWarning(false)}>
                            Socket On
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setOfflineWarning(true)}>
                            Socket Off
                        </Button>
                    </div>
                    <pre className="rounded-sm bg-sunken p-3 font-mono text-xs text-body">
                        {JSON.stringify(offlineWarning, null, 2)}
                    </pre>
                </div>

            </CardContent>
        </Card>
    );
}
