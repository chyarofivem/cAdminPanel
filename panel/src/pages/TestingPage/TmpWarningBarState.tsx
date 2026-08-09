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
                <div className="space-y-2 divide-y-2 rounded border p-2">
                    <div className="flex justify-start gap-3">
                        <Button size="sm" onClick={() => setOfflineWarning(false)}>
                            Socket On
                        </Button>
                        <Button size="sm" onClick={() => setOfflineWarning(true)}>
                            Socket Off
                        </Button>
                    </div>
                    <pre className="bg-muted p-2">
                        {JSON.stringify(offlineWarning, null, 2)}
                    </pre>
                </div>

            </CardContent>
        </Card>
    );
}
