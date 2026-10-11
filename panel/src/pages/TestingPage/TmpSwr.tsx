import InlineCode from "@/components/InlineCode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import useSWR from "swr";
import useSWRImmutable from "swr/immutable";
import useSWRMutation from 'swr/mutation';

export default function TmpSwr() {
    const [counter, setCounter] = useState(0);
    const renderTime = Date.now();
    const swr = useSWR(`/whatever?counter=${counter}`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
        console.log('Request: ', `/whatever?counter=${counter}`);
        return {
            ts: renderTime,
            counter: counter,
            rand: Math.random().toString(36).substring(2, 8),
        };
    }, {});

    // const mut = useSWRMutation(`/whatever?counter=${counter}`, async (url: string) => {
    //     await new Promise((resolve) => setTimeout(resolve, 250));
    //     console.log('Request: ', `/whatever?counter=${counter}`, url);
    //     return {
    //         ts: renderTime,
    //         counter: 999,
    //         rand: 'aaa',
    //     };
    // });

    const isDataFresh = swr.data?.ts && renderTime - swr.data.ts < 1000;
    return (
        <div className="w-full">
            <div className="flex flex-col justify-center items-center gap-4">
                <p>
                    Note how there is no useEffect to do swr.mutate() on counter change.
                </p>

                <div className="flex items-center gap-3 font-mono">
                    <Button size={'sm'} variant="secondary" onClick={() => setCounter((curr) => curr - 1)}>--</Button>
                    <div className="min-w-[4ch] rounded-sm bg-raise-2 px-2 py-1.5 text-center tabular-nums text-white">{counter}</div>
                    <Button size={'sm'} variant="secondary" onClick={() => setCounter((curr) => curr + 1)}>++</Button>
                    {/* <Button size={'sm'} onClick={() => mut.trigger()}>mut</Button> */}
                </div>
                <table className="overflow-hidden rounded-lg bg-raise text-left text-sm">
                    <tbody>
                        <tr>
                            <th className="p-2 font-medium text-white">Data</th>
                            <td className="min-w-[8ch] p-2 text-center tabular-nums">
                                {swr.data?.counter}
                            </td>
                        </tr>
                        <tr>
                            <th className="bg-raise p-2 font-medium text-white">Rand</th>
                            <td className="bg-raise p-2 text-center font-mono">
                                {swr.data?.rand}
                            </td>
                        </tr>
                        <tr>
                            <th className="p-2 font-medium text-white">Status</th>
                            <td className={cn(
                                "p-2 text-center",
                                swr.data ? isDataFresh ? 'bg-success/15 text-success-text' : 'bg-danger/15 text-danger-text' : 'bg-raise-2 text-muted-foreground',
                                swr.data ? 'opacity-100' : 'opacity-50'
                            )}>
                                {swr.data ? isDataFresh ? 'Fresh' : 'Stale' : ''}
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div>
                    {JSON.stringify(swr.data)}
                </div>
            </div>
        </div>
    );
}
