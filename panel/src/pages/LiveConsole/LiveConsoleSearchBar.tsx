import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import type { ISearchDecorationOptions, ISearchOptions, SearchAddon } from "@xterm/addon-search";
import { ArrowDownIcon, ArrowUpIcon, CaseSensitiveIcon, RegexIcon, WholeWordIcon, XIcon } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useEventListener } from "usehooks-ts";
import { t } from '@/lib/i18n';


type ButtonProps = {
    title: string;
    onClick: () => void;
    isActive?: boolean;
    children: ReactNode;
};

//Toggles show their on-state on raise-2, like an active tab.
function SearchBarButton({ title, onClick, isActive, children }: ButtonProps) {
    return (
        <IconButton
            label={title}
            icon={children}
            variant={isActive ? 'secondary' : 'ghost'}
            aria-pressed={isActive === undefined ? undefined : isActive}
            className="size-11 sm:size-9"
            onClick={onClick}
        />
    );
}


const labelNoResults = t('No results');
//NOTE: these are drawn inside the xterm canvas (console content), which only accepts
//opaque #RRGGBB values, so they cannot read the CSS tokens.
const xtermDecorations = {
    activeMatchBackground: '#FF00DC',
    activeMatchColorOverviewRuler: '#FF00DC',
    matchBackground: '#732268',
    matchOverviewRuler: '#732268',
} satisfies ISearchDecorationOptions;

type LiveConsoleSearchBarProps = {
    show: boolean;
    setShow: (show: boolean) => void;
    searchAddon: SearchAddon;
};

export default function LiveConsoleSearchBar({ show, setShow, searchAddon }: LiveConsoleSearchBarProps) {
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [wholeWord, setWholeWord] = useState(false);
    const [regex, setRegex] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [resultCount, setResultCount] = useState(labelNoResults);

    //helpers
    const clearSearchState = (newStatus?: string) => {
        searchAddon.clearDecorations();
        if (newStatus) {
            setResultCount(newStatus);
        }
    }
    const getSearchOptions = (overrides?: Partial<ISearchOptions>): ISearchOptions => ({
        decorations: xtermDecorations,
        caseSensitive,
        wholeWord,
        regex,
        ...overrides,
    })

    //autofocus the input
    useEffect(() => {
        if (show) {
            inputRef.current?.focus();
        } else {
            clearSearchState(labelNoResults);
        }
    }, [show]);

    //listens to the result count change
    useEffect(() => {
        if (!searchAddon) return;
        const dispose = searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
            if (resultIndex === -1) {
                setResultCount(labelNoResults);
            } else {
                setResultCount(`${resultIndex + 1}/${resultCount}`);
            }
        });
        return () => {
            dispose.dispose();
        }
    }, []);

    //Handlers
    const handlePrevious = () => {
        if (!inputRef.current || !inputRef.current.value) return;
        console.log('backward search for', inputRef.current.value);
        searchAddon.findPrevious(inputRef.current.value, getSearchOptions());
    }
    const handleNext = () => {
        if (!inputRef.current || !inputRef.current.value) return;
        console.log('forward search for', inputRef.current.value);
        searchAddon.findNext(inputRef.current.value, getSearchOptions());
    }
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!inputRef.current) return;
        console.log('search input keydown', e.code);
        if (e.code === 'Enter') {
            if (e.shiftKey) {
                handlePrevious();
            } else {
                handleNext();
            }
            e.preventDefault();
        }
    }
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!inputRef.current) return;
        handleNext();
    }

    const handleCaseSensitiveMode = () => {
        if (!inputRef.current) return;
        setCaseSensitive(!caseSensitive);
        clearSearchState();
        searchAddon.findNext(inputRef.current.value, getSearchOptions({ caseSensitive: !caseSensitive }));
    }
    const handleWholeWordMode = () => {
        if (!inputRef.current) return;
        setWholeWord(!wholeWord);
        clearSearchState();
        searchAddon.findNext(inputRef.current.value, getSearchOptions({ wholeWord: !wholeWord }));
    }
    const handleRegexMode = () => {
        if (!inputRef.current) return;
        setRegex(!regex);
        clearSearchState();
        searchAddon.findNext(inputRef.current.value, getSearchOptions({ regex: !regex }));
    }

    //This is required so hotkeys in the page also apply in here
    useEventListener('message', (e: TxMessageEvent) => {
        if (e.data.type !== 'liveConsoleSearchHotkey') return;
        if (e.data.action === 'previous') {
            handlePrevious();
        } else if (e.data.action === 'next') {
            handleNext();
        } else if (e.data.action === 'focus') {
            inputRef.current?.focus();
        }
    });

    if (!show) return null;
    return (
        <div className="absolute right-2 top-2 z-10 flex w-[calc(100%-1rem)] flex-wrap items-center gap-1 rounded-md bg-menu p-2 font-sans shadow-menu xs:w-auto">
            <Input
                ref={inputRef}
                className="min-w-0 basis-full text-dense xs:w-56 xs:basis-auto sm:h-9"
                aria-label={t('Search console output')}
                placeholder={t('Search console output')}
                onKeyDown={handleInputKeyDown}
                onChange={handleInputChange}
                onBlur={() => { searchAddon.clearActiveDecoration() }}
            />
            <SearchBarButton
                title={t('Case sensitive')}
                isActive={caseSensitive}
                onClick={handleCaseSensitiveMode}
            >
                <CaseSensitiveIcon />
            </SearchBarButton>
            <SearchBarButton
                title={t('Whole word')}
                isActive={wholeWord}
                onClick={handleWholeWordMode}
            >
                <WholeWordIcon />
            </SearchBarButton>
            <SearchBarButton
                title={t('Regular expression')}
                isActive={regex}
                onClick={handleRegexMode}
            >
                <RegexIcon />
            </SearchBarButton>
            <div className="min-w-[8ch] grow whitespace-nowrap px-1 text-dense tabular-nums text-muted-foreground" aria-live="polite">
                {resultCount}
            </div>
            <SearchBarButton
                title={t('Previous result')}
                onClick={handlePrevious}
            >
                <ArrowUpIcon />
            </SearchBarButton>
            <SearchBarButton
                title={t('Next result')}
                onClick={handleNext}
            >
                <ArrowDownIcon />
            </SearchBarButton>
            <SearchBarButton
                title={t('Close')}
                onClick={() => { setShow(false) }}
            >
                <XIcon />
            </SearchBarButton>
        </div>
    );
}
