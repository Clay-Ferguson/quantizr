import { getAs } from "../AppContext";
import { S } from "../Singletons";
import { AppTab } from "../comp/AppTab";
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
import { TabBase } from "../intf/TabBase";

export class SettingsView extends AppTab<any, SettingsView> {
    constructor(data: TabBase<any, SettingsView>) {
        super(data);
        data.inst = this;
    }

    sectionTitle(title: string): Heading {
        return new Heading(6, title, { className: "settingsSectionTitle alert alert-primary" });
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const horzClass = "marginTop marginBottom settingsSection";
        const settingsCol = getAs().mobileMode ? "mobileSettingsCol" : "settingsCol";

        this.children = [
            this.headingBar = new TabHeading([
                new Div("Settings", { className: "tabTitle" })
            ], null),

            new Div(null, { className: "settingsPanel" }, [
                
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
        ];
        return true;
    }

    settingsLink(name: string, onClick: () => void, moreClasses: string = ""): Div {
        return new Div(name, {
            className: "settingsLink " + moreClasses,
            onClick
        });
    }
}
