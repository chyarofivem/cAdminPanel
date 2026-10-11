import { cn } from "@/lib/utils";
import { AvatarFallback, AvatarImage, Avatar as ShadcnAvatar } from "./ui/avatar";

//Modified code from from @wowjeeez
//It's impossible to be inclusive to different alphabets and also have meaningful initials, but I tried my best 
const getInitials = (username: string) => {
    username = username.normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
    let letters = '';
    if (/^[A-Z][a-z]*((?:[A-Z][a-z]*)+)$/.test(username)) {
        // pascal
        const upperCaseLetters = username.match(/[A-Z]/g);
        letters = upperCaseLetters ? upperCaseLetters.slice(0, 2).join('') : '??';
    } else if (/^[a-z]+([_\-.][a-z]+)+$/.test(username)) {
        // snake, kebab, dot
        const words = username.split(/[_\-.]/);
        letters = words[0][0] + words[1][0];
    } else {
        // default
        const justAlphanumerics = username.replace(/[^a-zA-Z0-9]/g, '');
        if (justAlphanumerics.length === 0) {
            letters = username.length ? username[0] : '??';
        } else if (justAlphanumerics.length <= 2) {
            letters = justAlphanumerics;
        } else {
            letters = justAlphanumerics[0] + justAlphanumerics[justAlphanumerics.length - 1];
        }
    }
    return letters.toLocaleUpperCase();
};

type Props = {
    username: string;
    profilePicture?: string;
    className?: string;
};
export default function Avatar({ username, profilePicture, className }: Props) {
    return <ShadcnAvatar
        className={cn(
            'bg-raise-2 text-white',
            className
        )}
    >
        {
            profilePicture &&
            <AvatarImage
                src={profilePicture}
                alt={username}
            />
        }
        {/* Initials on raise-2: avatars do not invent per-user colours. */}
        <AvatarFallback
            className={className}
            delayMs={profilePicture ? 1000 : undefined}
        >
            {getInitials(username)}
        </AvatarFallback>
    </ShadcnAvatar>;
}
