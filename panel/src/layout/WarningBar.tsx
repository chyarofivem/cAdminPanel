import useWarningBar from "@/hooks/useWarningBar";
import { cn } from "@/lib/utils";
import { CloudOffIcon } from "lucide-react";

type InnerWarningBarProps = {
    titleIcon: React.ReactNode;
    title: React.ReactNode;
    description: React.ReactNode;
    isImportant: boolean;
};

export function InnerWarningBar({ titleIcon, title, description, isImportant }: InnerWarningBarProps) {
    return (
        <div className='fixed top-navbarvh w-full flex justify-center z-40'>
            <div className={cn(
                "w-full sm:w-[28rem] min-h-9 hover:min-h-32 overflow-hidden sm:rounded-b-md",
                "flex flex-col justify-center items-center p-1",
                "group cursor-default transition-[height] shadow-xl",
                isImportant ? 'bg-destructive text-destructive-foreground' : 'bg-info text-info-foreground'
            )}>
                <h2 className="text-md text-center group-hover:font-medium">
                    {titleIcon}
                    {title}
                </h2>

                <span className='hidden group-hover:block text-center text-sm'>
                    {description}
                </span>
            </div>
        </div>
    );
}


export default function WarningBar() {
    const { offlineWarning } = useWarningBar();

    if (offlineWarning) {
        return <InnerWarningBar
            titleIcon={<CloudOffIcon className="inline h-[1.2rem] -mt-1 mr-1" />}
            title="Socket connection lost."
            description={<>
                The connection to the cAdminPanel server has been lost. <br />
                If you closed FXServer, please restart it.
            </>}
            isImportant={true}
        />
    } else {
        return null;
    }
}
