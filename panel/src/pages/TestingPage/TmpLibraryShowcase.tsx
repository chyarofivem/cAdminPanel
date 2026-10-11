import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import SwitchText from "@/components/SwitchText";
import InlineCode from "@/components/InlineCode";
import TxAnchor from "@/components/TxAnchor";
import DateTimeCorrected from "@/components/DateTimeCorrected";
import { DynamicNewBadge, DynamicNewItem } from "@/components/DynamicNewBadge";
import { IconButton } from "@/components/ui/icon-button";
import { CopyIcon } from "lucide-react";

export default function TmpLibraryShowcase() {
    return (
        <div className="mx-4 space-y-8 pb-8">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-xl font-semibold text-white">UI Library Showcase</h1>
                <p className="text-muted-foreground">A <i>not at all</i> comprehensive overview of some UI components</p>
            </div>

            {/* Buttons Section */}
            <section className="space-y-6">
                <h2 className="border-b border-hairline pb-2 text-base font-semibold text-white">Buttons</h2>
                
                {/* Button Variants */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white">Variants</h3>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="default">Primary</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="outline-destructive">Destructive on a page</Button>
                        <Button variant="destructive">Confirm dialog only</Button>
                        <Button variant="link">Link</Button>
                        <IconButton label="Ghost icon button" icon={<CopyIcon />} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        One primary per section. Legacy variant names render as the closest of these.
                    </p>
                </div>

                {/* Button Sizes */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white">Sizes</h3>
                    <div className="flex flex-wrap items-center gap-3">
                        <IconButton label="Icon" icon={<CopyIcon />} />
                        <Button size="inline">Inline</Button>
                        <Button size="xs">Extra Small</Button>
                        <Button size="sm">Small</Button>
                        <Button size="default">Default</Button>
                        <Button size="lg">Large</Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        <InlineCode>inline</InlineCode> is custom - useful for inline text buttons like "click <Button size="inline" variant="link">here</Button> to continue".
                    </p>
                </div>

                {/* Button States */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white">States</h3>
                    <div className="flex flex-wrap gap-3">
                        <Button>Normal</Button>
                        <Button disabled>Disabled</Button>
                    </div>
                </div>
            </section>

            {/* Form Inputs Section */}
            <section className="space-y-6">
                <h2 className="border-b border-hairline pb-2 text-base font-semibold text-white">Form Inputs</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Text Inputs */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-white">Text Inputs</h3>
                        <div className="space-y-3">
                            <Input placeholder="Default input" />
                            <Input placeholder="Email input" type="email" />
                            <Input placeholder="Password input" type="password" />
                            <Input placeholder="Disabled input" disabled />
                            <Input placeholder="Input with value" defaultValue="Sample text" />
                        </div>
                    </div>

                    {/* Textarea */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-white">Textarea</h3>
                        <div className="space-y-3">
                            <Textarea placeholder="Default textarea" />
                            <Textarea placeholder="Disabled textarea" disabled />
                            <Textarea placeholder="Textarea with content" defaultValue="This is some sample content in the textarea component." />
                        </div>
                    </div>
                </div>

                {/* Checkboxes and Switches */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-white">Checkboxes</h3>
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="checkbox1" />
                                <label htmlFor="checkbox1" className="text-sm font-medium">Default checkbox</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="checkbox2" defaultChecked />
                                <label htmlFor="checkbox2" className="text-sm font-medium">Checked checkbox</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="checkbox3" disabled />
                                <label htmlFor="checkbox3" className="text-sm font-medium text-muted-foreground">Disabled checkbox</label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-white">Switches</h3>
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <Switch id="switch1" />
                                <label htmlFor="switch1" className="text-sm font-medium">Default switch</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="switch2" defaultChecked />
                                <label htmlFor="switch2" className="text-sm font-medium">Checked switch</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="switch3" disabled />
                                <label htmlFor="switch3" className="text-sm font-medium text-muted-foreground">Disabled switch</label>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Badges Section */}
            <section className="space-y-6">
                <h2 className="border-b border-hairline pb-2 text-base font-semibold text-white">Badges</h2>
                
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white">Badge Variants</h3>
                    <div className="flex flex-wrap gap-3">
                        <Badge variant="default">Default</Badge>
                        <Badge variant="accent">Accent</Badge>
                        <Badge variant="success">Online</Badge>
                        <Badge variant="warning">Starting</Badge>
                        <Badge variant="danger">Stopped</Badge>
                        <Badge variant="info">Info</Badge>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white">Usage Examples</h3>
                    <div className="flex flex-wrap gap-3">
                        <Badge>New</Badge>
                        <Badge variant="danger">Error</Badge>
                        <Badge>Beta</Badge>
                        <Badge>v2.1.0</Badge>
                        <Badge variant="success">Online</Badge>
                    </div>
                </div>
            </section>

            {/* Alerts Section */}
            <section className="space-y-6">
                <h2 className="border-b border-hairline pb-2 text-base font-semibold text-white">Alerts</h2>
                
                <div className="space-y-4">
                    <Alert variant="default">
                        <AlertTitle>Default Alert</AlertTitle>
                        <AlertDescription>
                            This is a default alert with some information for the user.
                        </AlertDescription>
                    </Alert>

                    <Alert variant="info">
                        <AlertTitle>Information</AlertTitle>
                        <AlertDescription>
                            This is an informational alert that provides helpful context.
                        </AlertDescription>
                    </Alert>

                    <Alert variant="success">
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>
                            Your action was completed successfully!
                        </AlertDescription>
                    </Alert>

                    <Alert variant="warning">
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>
                            Please review this information carefully before proceeding.
                        </AlertDescription>
                    </Alert>

                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                            An error occurred while processing your request. Please try again.
                        </AlertDescription>
                    </Alert>
                </div>
            </section>

            {/* SwitchText Section */}
            <section className="space-y-6">
                <h2 className="border-b border-hairline pb-2 text-base font-semibold text-white">SwitchText <Badge>Custom</Badge></h2>
                <p className="text-sm text-muted-foreground">
                    A custom Switch component that shows different labels based on state, with semantic color variants.
                </p>
                
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white">Color Variants</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <SwitchText checkedLabel="Default On" uncheckedLabel="Default Off" defaultChecked />
                            <p className="text-xs text-muted-foreground">variant="default"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="checkedGreen" checkedLabel="Enabled" uncheckedLabel="Disabled" defaultChecked />
                            <p className="text-xs text-muted-foreground">variant="checkedGreen"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="checkedYellow" checkedLabel="Warning On" uncheckedLabel="Warning Off" defaultChecked />
                            <p className="text-xs text-muted-foreground">variant="checkedYellow"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="checkedRed" checkedLabel="Danger On" uncheckedLabel="Danger Off" defaultChecked />
                            <p className="text-xs text-muted-foreground">variant="checkedRed"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="uncheckedGreen" checkedLabel="Off" uncheckedLabel="Safe" />
                            <p className="text-xs text-muted-foreground">variant="uncheckedGreen"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="uncheckedYellow" checkedLabel="Off" uncheckedLabel="Warning" />
                            <p className="text-xs text-muted-foreground">variant="uncheckedYellow"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="uncheckedRed" checkedLabel="Off" uncheckedLabel="Danger" />
                            <p className="text-xs text-muted-foreground">variant="uncheckedRed"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="redGreen" checkedLabel="Enabled" uncheckedLabel="Disabled" defaultChecked />
                            <p className="text-xs text-muted-foreground">variant="redGreen"</p>
                        </div>
                        <div className="space-y-2">
                            <SwitchText variant="greenRed" checkedLabel="Danger!" uncheckedLabel="Safe" />
                            <p className="text-xs text-muted-foreground">variant="greenRed"</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* InlineCode & TxAnchor Section */}
            <section className="space-y-6">
                <h2 className="border-b border-hairline pb-2 text-base font-semibold text-white">Text Components <Badge>Custom</Badge></h2>
                
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white">InlineCode</h3>
                    <p className="text-sm">
                        Use <InlineCode>InlineCode</InlineCode> for inline code snippets like <InlineCode>npm install</InlineCode> or variable names like <InlineCode>myVariable</InlineCode>.
                    </p>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-white">TxAnchor</h3>
                    <p className="text-muted-foreground">
                        Smart anchor component that handles internal navigation and external links properly.
                    </p>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Normal text size:</h4>
                        <p>
                            Lorem ipsum dolor <TxAnchor href="/players">Example</TxAnchor>: internal link.
                        </p>
                        <p>
                            Lorem ipsum dolor <TxAnchor href="https://github.com/chyarofivem/cAdminPanel">Example</TxAnchor>: external link.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Small text size (text-sm):</h4>
                        <p className="text-sm">
                            Lorem ipsum dolor <TxAnchor href="/dashboard">Example</TxAnchor>: internal link.
                        </p>
                        <p className="text-sm">
                            Lorem ipsum dolor <TxAnchor href="https://example.com">Example</TxAnchor>: external link.
                        </p>
                    </div>
                </div>
            </section>

            {/* DateTimeCorrected Section */}
            <section className="space-y-6">
                <h2 className="border-b border-hairline pb-2 text-base font-semibold text-white">DateTimeCorrected <Badge>Custom</Badge></h2>
                <p className="text-sm text-muted-foreground">
                    Displays timestamps corrected for server/client clock drift. Hover for full date/time.
                </p>
                
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-6">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Date + Time (default)</p>
                            <DateTimeCorrected 
                                tsFetch={Date.now()} 
                                tsObject={Date.now() - 3600000} 
                                serverTime={Date.now()} 
                            />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Date only</p>
                            <DateTimeCorrected 
                                tsFetch={Date.now()} 
                                tsObject={Date.now() - 86400000 * 3} 
                                serverTime={Date.now()}
                                isDateOnly
                            />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">With clock drift warning</p>
                            <DateTimeCorrected 
                                tsFetch={Date.now()} 
                                tsObject={Date.now() - 3600000} 
                                serverTime={Date.now() + 600000}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* DynamicNewBadge Section */}
            <section className="space-y-6">
                <h2 className="border-b border-hairline pb-2 text-base font-semibold text-white">DynamicNewBadge & DynamicNewItem <Badge>Custom</Badge></h2>
                
                <div className="space-y-4">
                    <Alert variant="info">
                        <AlertTitle>Time-based visibility</AlertTitle>
                        <AlertDescription>
                            These components show content for a limited time after first view. The timestamp is stored in localStorage per feature name.
                            In dev mode (<InlineCode>showAdvanced</InlineCode>), they always show.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-white">DynamicNewBadge</h3>
                        <p className="text-sm text-muted-foreground">
                            Shows a "NEW" badge for X days (default 3) after first seen. Use for highlighting new features in menus/settings.
                        </p>
                        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-raise p-3">
                            <span>Feature Name</span>
                            <DynamicNewBadge featName="showcase-example-1" durationDays={365} />
                            <span className="text-muted-foreground">|</span>
                            <span>Another Feature</span>
                            <DynamicNewBadge featName="showcase-example-2" size="xs" durationDays={365} />
                        </div>
                        <pre className="overflow-x-auto rounded-sm bg-sunken p-3 font-mono text-xs text-body">
{`<DynamicNewBadge featName="unique-feature-id" durationDays={14} />
<DynamicNewBadge featName="another-feature" size="xs" badgeText="BETA" />`}
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-white">DynamicNewItem</h3>
                        <p className="text-sm text-muted-foreground">
                            Wrapper that conditionally renders children for X days. Use for temporary promotional content or feature highlights.
                        </p>
                        <div className="rounded-lg bg-raise p-3">
                            <DynamicNewItem featName="showcase-example-3" durationDays={365}>
                                <Alert variant="success">
                                    <AlertTitle>This entire alert is wrapped in DynamicNewItem</AlertTitle>
                                    <AlertDescription>It will disappear after the duration expires.</AlertDescription>
                                </Alert>
                            </DynamicNewItem>
                        </div>
                        <pre className="overflow-x-auto rounded-sm bg-sunken p-3 font-mono text-xs text-body">
{`<DynamicNewItem featName="promo-banner" durationDays={7}>
    <Alert>Your promotional content here</Alert>
</DynamicNewItem>`}
                        </pre>
                    </div>
                </div>
            </section>
        </div>
    );
}
