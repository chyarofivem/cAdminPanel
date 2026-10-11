import { Button } from "@/components/ui/button";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/auth";

export default function TmpAuthState() {
    const { authData, setAuthData, logout } = useAuth();

    const toggleIsMaster = () => {
        if(!authData) return;
        setAuthData({
            ...authData,
            isMaster: !authData.isMaster,
        });
    }
    const toggleIsTmpPassword = () => {
        if(!authData) return;
        setAuthData({
            ...authData,
            isTempPassword: !authData.isTempPassword,
        });
    }
    const changeCsrfToken = () => {
        if(!authData) return;
        setAuthData({
            ...authData,
            csrfToken: Math.random().toString(36).substring(2),
        });
    }

    return (
        <Card className="w-min">
            <CardHeader>
                <CardTitle>Update State</CardTitle>
            </CardHeader>
            <CardContent>
                <pre className="rounded-sm bg-sunken p-3 font-mono text-xs text-body">
                    {JSON.stringify(authData, null, 2)}
                </pre>
            </CardContent>
            <CardFooter className="gap-3">
                <Button size="sm" onClick={() => toggleIsMaster()}>
                    Toggle isMaster
                </Button>
                <Button size="sm" variant="secondary" onClick={() => toggleIsTmpPassword()}>
                    Toggle isTempPassword
                </Button>
                <Button size="sm" variant="secondary" onClick={() => changeCsrfToken()}>
                    Change CSRF Token
                </Button>
                <Button size="sm" variant="outline-destructive" onClick={() => setAuthData(false)}>
                    Erase Auth
                </Button>
            </CardFooter>
        </Card>
    );
}
