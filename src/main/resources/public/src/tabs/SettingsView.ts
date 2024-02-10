import { getAs } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { Button } from "../comp/core/Button";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { Heading } from "../comp/core/Heading";
import { Selection } from "../comp/core/Selection";
import { TabHeading } from "../comp/core/TabHeading";
import { ChangePasswordDlg } from "../dlg/ChangePasswordDlg";
import { ManageCryptoKeysDlg } from "../dlg/ManageCryptoKeysDlg";
import { ManageStorageDlg } from "../dlg/ManageStorageDlg";
import { MediaRecorderDlg } from "../dlg/MediaRecorderDlg";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";
import * as J from "../JavaIntf";

export class SettingsView extends AppTab<any, SettingsView> {

    constructor(data: TabIntf<any, SettingsView>) {
        super(data);
        data.inst = this;
    }

    sectionTitle(title: string): Heading {
        return new Heading(6, title, { className: "settingsSectionTitle alert alert-primary" });
    }

    override preRender = (): boolean => {
        const ast = getAs();
        const horzClass = "marginTop marginBottom settingsSection";
        const settingsCol = getAs().mobileMode ? "mobileSettingsCol" : "settingsCol";

        let modelSpecs = "";
        switch (getAs().userPrefs.aiService) {
            case J.AIServiceName.OPENAI:
                modelSpecs = "OpenAI ChatGPT-4 (Chat): This is the default chatbot and is widely considered the most intelligent general-purpose AI on the market.";
                break;
            case J.AIServiceName.GEMINI:
                modelSpecs = "Gemini AI: This is Google's best general-purpose AI.";
                break;
            case J.AIServiceName.PPLX:
                modelSpecs = "Perplexity AI: This is Perplexity's best high-end powerful general-purpose AI.";
                break;
            case J.AIServiceName.PPLX_ONLINE:
                modelSpecs = "Perplexity AI: This is Perplexity's AI which has access to the latest news and content from from the web.";
                break;
            case J.AIServiceName.PPLX_CODE_LLAMA:
                modelSpecs = "Code Llama: This is the well-known open source Code Llama, which is great for coding and programming tasks.";
                break;
            case J.AIServiceName.PPLX_LLAMA2:
                modelSpecs = "Llama 2: This is the well-known open source Llama 2, which is great for general-purpose tasks.";
                break;
        }
        const aiOptions = this.getAiOptions();

        this.setChildren([
            this.headingBar = new TabHeading([
                new Div("Settings", { className: "tabTitle" })
            ], null),

            new Div(null, { className: "settingsPanel" }, [
                // -----------------------
                this.sectionTitle("Account"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Logout", S.user.logout), //
                        this.settingsLink("Edit Profile", () => new UserProfileDlg(null).open()),
                        this.settingsLink("Change Password", () => new ChangePasswordDlg(null).open()),
                        this.settingsLink("Server Storage Space", () => new ManageStorageDlg().open())
                    ]),
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Clear Browser Storage", async () => {
                            await S.localDB.clearStores();
                            S.util.showMessage("Browser Storage cleared successfully");
                        }),
                        this.settingsLink("Manage Hashtags", S.edit.editHashtags),
                        this.settingsLink("Blocked Words", S.edit.editBlockedWords),
                        S.crypto.avail ? this.settingsLink("Manage Keys", () => new ManageCryptoKeysDlg().open()) : null
                    ])
                ], horzClass),

                // -----------------------
                this.sectionTitle("View"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        new Checkbox("Comments", { className: "bigMarginLeft" }, {
                            setValue: async (checked: boolean) => S.edit.setShowReplies(checked),
                            getValue: (): boolean => ast.userPrefs.showReplies
                        })
                    ]),

                    new Div(null, { className: settingsCol }, [
                        new Checkbox("Properties", { className: "bigMarginLeft" }, {
                            setValue: async (checked: boolean) => S.util.saveUserPrefs(s => s.userPrefs.showProps = checked),
                            getValue: (): boolean => ast.userPrefs.showProps
                        }),
                    ])
                ], horzClass),

                new Selection(null, "Content Width", [
                    { key: "4", val: "Very Narrow" },
                    { key: "5", val: "Narrow" },
                    { key: "6", val: "Medium" },
                    { key: "7", val: "Wide" },
                    { key: "8", val: "Very Wide" }
                ], "contentWidthSelection", "bigMarginLeft bigMarginTop bigMarginBottom", {
                    setValue: (val: string) => S.edit.setMainPanelCols(parseInt(val)),
                    getValue: (): string => "" + getAs().userPrefs.mainPanelCols
                }),

                this.settingsLink(ast.mobileMode ? "Switch to Desktop Browser" : "Switch to Moble Browser", S.util.switchBrowsingMode, "marginTop"),

                // menuItem("Full Repository Export", "fullRepositoryExport", "
                // S.edit.fullRepositoryExport();") + //

                // -----------------------
                aiOptions?.length ? this.sectionTitle("AI - Artificial Intelligence") : null,
                aiOptions?.length ? new FlexRowLayout([
                    // todo-1: need a way to warn user when something unsupported by their admin configuration is selected
                    new Div(null, { className: settingsCol }, [
                        new Selection(null, "AI Service", aiOptions, "aiServiceSelection", "bigMarginLeft bigMarginTop bigMarginBottom", {
                            setValue: (val: string) => S.edit.setAiService(val),
                            getValue: (): string => "" + getAs().userPrefs.aiService
                        }),
                        modelSpecs ? new Div(modelSpecs, { className: "bigMarginLeft" }) : null
                    ]),
                    new Div(null, { className: settingsCol }, [
                        ast.userProfile?.balance ? this.settingsLink("Credit: $" + ast.userProfile.balance?.toFixed(6), () => { }) : null,
                        S.quanta.config.paymentLink ?
                            new Button("Add Credit", S.user.addAccountCredit, null, "btn btn-primary settingsButton") : null,
                    ])

                ], horzClass) : null,

                // -----------------------
                this.sectionTitle("Tools"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Test Microphone", () => new MediaRecorderDlg(false, false).open()), //
                        this.settingsLink("Test Web Cam", () => new MediaRecorderDlg(true, false).open())
                    ]),
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("My GEO Location", S.nav.geoLocation), //
                        this.settingsLink("About Browser", S.util.showBrowserInfo)
                    ])
                ], horzClass),

                // -----------------------
                this.sectionTitle("Danger Zone"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Bulk Delete", S.edit.bulkDelete)
                    ]),
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Close Account", S.user.closeAccount)
                    ])
                ], horzClass)
            ])
        ]);
        return true;
    }

    private getAiOptions = (): any[] => {
        const aiOptions = [];
        if (S.quanta.config.useOpenAi) {
            aiOptions.push({ key: J.AIServiceName.OPENAI, val: "OpenAI (Chat)" });
        }

        if (S.quanta.config.useGeminiAi) {
            aiOptions.push({ key: J.AIServiceName.GEMINI, val: "Google Gemini (Chat)" });
        }

        if (S.quanta.config.usePplxAi) {
            aiOptions.push(//
                { key: J.AIServiceName.PPLX, val: "Perplexity (Chat)" },
                { key: J.AIServiceName.PPLX_ONLINE, val: "Perplexity (Recent News)" },
                { key: J.AIServiceName.PPLX_CODE_LLAMA, val: "Code Llama" },
                { key: J.AIServiceName.PPLX_LLAMA2, val: "Llama 2" });
        }
        return aiOptions;
    }

    settingsLink = (name: string, onClick: () => void, moreClasses: string = ""): Div => {
        return new Div(name, {
            className: "settingsLink " + moreClasses,
            onClick
        });
    }
}
