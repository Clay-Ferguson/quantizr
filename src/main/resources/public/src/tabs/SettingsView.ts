import { getAs } from "../AppContext";
import { S } from "../Singletons";
import { Tailwind } from "../Tailwind";
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

export class SettingsView extends AppTab<any> {
    constructor(data: TabBase<any>) {
        super(data);
        data.inst = this;
    }

    sectionTitle(title: string): Heading {
        return new Heading(6, title, { className: "settingsSectionTitle " + Tailwind.alertPrimary });
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const horzClass = "mt-3 mb-3 settingsSection";
        const settingsCol = "settingsCol";

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
                        this.settingsLink("Manage Hashtags", S.edit._editHashtags),
                        this.settingsLink("Blocked Words", S.edit._editBlockedWords),
                        S.crypto.avail ? this.settingsLink("Manage Keys", () => new ManageCryptoKeysDlg().open()) : null
                    ])
                ], horzClass),

                this.sectionTitle("View"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        new Checkbox("Comments", { className: "ml-6" }, {
                            setValue: async (checked: boolean) => S.edit.setShowReplies(checked),
                            getValue: (): boolean => ast.userPrefs.showReplies
                        })
                    ]),

                    new Div(null, { className: settingsCol }, [
                        new Checkbox("Properties", { className: "ml-6" }, {
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
                ], "ml-6 mt-6 mb-6", {
                    setValue: (val: string) => S.edit.setMainPanelCols(parseInt(val)),
                    getValue: (): string => "" + getAs().userPrefs.mainPanelCols
                }),

                // menuItem("Full Repository Export", "fullRepositoryExport", "
                // S.edit.fullRepositoryExport();") + //

                this.sectionTitle("Tools"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Test Microphone", () => new MediaRecorderDlg(false, false).open()), //
                        this.settingsLink("Test Web Cam", () => new MediaRecorderDlg(true, false).open())
                    ]),
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("My GEO Location", S.nav._geoLocation), //
                        this.settingsLink("About Browser", S.util._showBrowserInfo)
                    ])
                ], horzClass),

                this.sectionTitle("Danger Zone"),
                new FlexRowLayout([
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Bulk Delete", S.edit._bulkDelete)
                    ]),
                    new Div(null, { className: settingsCol }, [
                        this.settingsLink("Close Account", S.user._closeAccount)
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
