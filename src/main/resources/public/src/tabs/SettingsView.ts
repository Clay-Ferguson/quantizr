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
            case "openAi":
                modelSpecs = "OpenAI ChatGPT-4 (Chat): This is the default chatbot and is widely considered the most intelligent general-purpose AI on the market.";
                break;
            case "geminiAi":
                modelSpecs = "Gemini AI: This is Google's best general-purpose AI.";
                break;
            case "pplxAi":
                modelSpecs = "Perplexity AI: This is Perplexity's best high-end powerful general-purpose AI.";
                break;
            case "pplxAi_online":
                modelSpecs = "Perplexity AI: This is Perplexity's AI which has access to the latest news and content from from the web.";
                break;
            case "pplxAi_codeLlama":
                modelSpecs = "Code Llama: This is the well-known open source Code Llama, which is great for coding and programming tasks.";
                break;
            case "pplxAi_llama2":
                modelSpecs = "Llama 2: This is the well-known open source Llama 2, which is great for general-purpose tasks.";
                break;
        }

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
                this.sectionTitle("AI - Artificial Intelligence"),
                new FlexRowLayout([

                    // todo-1: need a way to warn user when something unsupported by their admin configuration is selected
                    new Div(null, { className: settingsCol }, [
                        new Selection(null, "AI Service", [
                            { key: "openAi", val: "OpenAI (Chat)" },
                            { key: "geminiAi", val: "Google Gemini (Chat)" },
                            { key: "pplxAi", val: "Perplexity (Chat)" },
                            { key: "pplxAi_online", val: "Perplexity (Recent News)" },
                            { key: "pplxAi_codeLlama", val: "Code Llama" },
                            { key: "pplxAi_llama2", val: "Llama 2" }
                        ], "aiServiceSelection", "bigMarginLeft bigMarginTop bigMarginBottom", {
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

                ], horzClass),

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

    settingsLink = (name: string, onClick: () => void, moreClasses: string = ""): Div => {
        return new Div(name, {
            className: "settingsLink " + moreClasses,
            onClick
        });
    }
}
