import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSocket } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

const BUFFER_TRIM_SIZE = 128 * 1024; // 128kb



export default function TmpSocket() {
    const socketRef = useRef<Socket | null>(null);
    const [consoleData, setConsoleData] = useState('[empty]');
    const [isOffline, setIsOffline] = useState(true);

    const ingestConsoleData = (incomingData: string) => {
        setConsoleData((currData) => {
            console.log(currData.length, incomingData.length);
            let _consoleData = currData + incomingData;
            _consoleData = (_consoleData.length > BUFFER_TRIM_SIZE)
                ? _consoleData.slice(-0.5 * BUFFER_TRIM_SIZE) // grab the last half
                : _consoleData; // no need to trim
            _consoleData = _consoleData.substring(_consoleData.indexOf("\n"));
            return _consoleData;
        });
    }

    const sendPing = () => {
        socketRef.current?.emit('consoleCommand', 'txaPing');
    }
    const clearTerminal = () => {
        setConsoleData('[cleared]');
    }

    useEffect(() => {
        socketRef.current = getSocket('liveconsole');
        socketRef.current.on('connect', () => {
            console.log("Console Socket.IO Connected.");
            setIsOffline(false);
        });
        socketRef.current.on('disconnect', (message) => {
            console.log("Console Socket.IO Disonnected:", message);
            setIsOffline(true);
        });
        socketRef.current.on('error', (error) => {
            console.log('Console Socket.IO', error);
        });
        socketRef.current.on('consoleData', function (data) {
            ingestConsoleData(data);
        });

        return () => {
            socketRef.current?.removeAllListeners();
            socketRef.current?.disconnect();
        }
    }, []);

    return <>
        <div className="flex flex-wrap items-center gap-3">
            <Button onClick={sendPing}>Send Ping</Button>
            <Button variant="secondary" onClick={clearTerminal}>Clear</Button>
            <Badge variant={isOffline ? 'danger' : 'success'}>{isOffline ? 'Offline' : 'Online'}</Badge>
        </div>
        <pre className="rounded-sm bg-sunken p-3 font-mono text-xs text-body">
            {consoleData}
        </pre>
    </>;
}
