import { PageHeader, PageHeaderChangelog, PageHeaderLinks } from "@/components/page-header";

const Divider = () => <div className="border-b border-hairline" role="separator" />
const Wrapper = ({ children }: { children: React.ReactNode }) => <div className="rounded-sm ring-1 ring-transparent hover:ring-hairline">{children}</div>

export default function TmpPageHeader() {
    return (
        <div className="w-full h-full flex flex-col gap-4">
            <Wrapper>
                <PageHeader title="Simple" />
            </Wrapper>
            <Divider />
            <Wrapper>
                <PageHeader title="Simple + custom">
                    <div className="text-xs">
                        example
                    </div>
                </PageHeader>
            </Wrapper>
            <Divider />
            <Wrapper>
                <PageHeader title="Simple + links">
                    <PageHeaderLinks
                        topLabel="Documentation"
                        topLink="https://github.com/chyarofivem/cAdminPanel"
                        bottomLabel="Repository"
                        bottomLink="https://github.com/chyarofivem/cAdminPanel"
                    />
                </PageHeader>
            </Wrapper>
            <Divider />
            <Wrapper>
                <PageHeader title="Simple + changelog">
                    <PageHeaderChangelog
                        changelogData={[{ author: 'chyarogroup', keys: [], ts: Date.now() }]}
                    />
                </PageHeader>
            </Wrapper>
            <Divider />
            <Wrapper>
                <PageHeader
                    title="Breadcrumbs"
                    parentName="Parent"
                    parentLink="/parent"
                />
            </Wrapper>
            <Divider />
            <Wrapper>
                <PageHeader
                    title="Breadcrumbs"
                    parentName="Parent"
                    parentLink="/parent"
                >
                    <PageHeaderChangelog
                        changelogData={[{ author: 'chyarogroup', keys: [], ts: 1741168243520 }]}
                    />
                </PageHeader>
            </Wrapper>
            <Divider />
            <Wrapper>
                <PageHeader title="Simple + empty changelog">
                    <PageHeaderChangelog
                        changelogData={[]}
                    />
                </PageHeader>
            </Wrapper>
        </div>
    )
}
