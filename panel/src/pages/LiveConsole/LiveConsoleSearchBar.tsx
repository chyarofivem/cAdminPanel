import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ISearchDecorationOptions, ISearchOptions, SearchAddon } from "@xterm/addon-search";
import { ArrowDownIcon, ArrowUpIcon, CaseSensitiveIcon, RegexIcon, WholeWordIcon, XIcon } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useEventListener } from "usehooks-ts";
import { t } from '@/lib/i18n';


type ButtonProps = {
    title?: string;
    onClick: () => void;
    isActive?: boolean;
    children: ReactNode;
};

function SearchBarButton({ title, onClick, isActive, children }: ButtonProps) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            className={cn(
                "rounded p-0.5",
                "hover:bg-secondary-foreground hover:text-secondary",
                "focus:outline-none focus:ring-1 focus:ring-secondary-foreground focus:ring-offset-1x focus:ring-offset-secondary-foreground",
                isActive && 'bg-muted-foreground text-secondary'
            )}
            onClick={onClick}
        >
            {children}
        </button>
    );
}


const labelNoResults = t('No results');
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
        <div className="absolute right-2 top-2 z-10 flex w-[calc(100%-1rem)] flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur xs:w-auto">
            <div className="relative">
                <Input
                    ref={inputRef}
                    className="h-8"
                    placeholder={t('Search console output')}
                    onKeyDown={handleInputKeyDown}
                    onChange={handleInputChange}
                    onBlur={() => { searchAddon.clearActiveDecoration() }}
                />
                <div className="absolute top-1/2 right-1 transform -translate-y-1/2 flex text-muted-foreground gap-2">
                    <SearchBarButton
                        title={t('Case sensitive')}
                        isActive={caseSensitive}
                        onClick={handleCaseSensitiveMode}
                    >
                        <CaseSensitiveIcon className="h-5 w-5" />
                    </SearchBarButton>
                    <SearchBarButton
                        title={t('Whole word')}
                        isActive={wholeWord}
                        onClick={handleWholeWordMode}
                    >
                        <WholeWordIcon className="h-5 w-5" />
                    </SearchBarButton>
                    <SearchBarButton
                        title={t('Regular expression')}
                        isActive={regex}
                        onClick={handleRegexMode}
                    >
                        <RegexIcon className="h-4 w-5" />
                    </SearchBarButton>
                </div>
            </div>
            <div className="flex grow text-sm text-muted-foreground whitespace-nowrap min-w-[8ch]">
                {resultCount}
            </div>
            <div className="flex gap-2 text-muted-foreground">
                <SearchBarButton
                    title={t('Previous result')}
                    onClick={handlePrevious}
                >
                    <ArrowUpIcon className="h-5 w-5" />
                </SearchBarButton>
                <SearchBarButton
                    title={t('Next result')}
                    onClick={handleNext}
                >
                    <ArrowDownIcon className="h-5 w-5" />
                </SearchBarButton>
                <SearchBarButton
                    title={t('Close')}
                    onClick={() => { setShow(false) }}
                >
                    <XIcon className="h-5 w-5" />
                </SearchBarButton>
            </div>
        </div>
    );
}
