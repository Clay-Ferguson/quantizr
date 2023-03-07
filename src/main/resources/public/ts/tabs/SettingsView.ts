import { getAs } from "../AppContext";
import { AppTab } from "../comp/AppTab";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Selection } from "../comp/core/Selection";
import { TabHeading } from "../comp/core/TabHeading";
import { ChangePasswordDlg } from "../dlg/ChangePasswordDlg";
import { ManageCryptoKeysDlg } from "../dlg/ManageCryptoKeysDlg";
import { ManageStorageDlg } from "../dlg/ManageStorageDlg";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";

export class SettingsView extends AppTab<any, SettingsView> {

    constructor(data: TabIntf<any, SettingsView>) {
        super(data);
        data.inst = this;
    }

    preRender(): void {
        const ast = getAs();

        this.setChildren([
            // WARNING: headingBar has to be a child of the actual scrollable panel for stickyness to work.
            this.headingBar = new TabHeading([
                new Div("Settings", { className: "tabTitle" })
            ]),

            new Div("Account", { className: "settingsSectionTitle" }),

            this.settingsLink("Logout", S.user.userLogout), //
            this.settingsLink("Edit Profile", () => { new UserProfileDlg(null).open(); }), //
            this.settingsLink("Show Storage Space", () => { new ManageStorageDlg().open(); }), //
            this.settingsLink("Manage Hashtags", S.edit.editHashtags),
            S.crypto.avail ? this.settingsLink("Manage Keys", () => { new ManageCryptoKeysDlg().open(); }) : null, //
            this.settingsLink("Change Password", () => { new ChangePasswordDlg(null).open(); }), //

            new Div("View Options", { className: "settingsSectionTitle" }),

            new Checkbox("Show Sensitive Content", { className: "bigMarginLeft" }, {
                setValue: (checked: boolean) => S.util.saveUserPrefs(s => s.userPrefs.nsfw = checked),
                getValue: (): boolean => ast.userPrefs.nsfw
            }),

            new Checkbox("Show Parent", { className: "bigMarginLeft" }, {
                setValue: async (checked: boolean) => {
                    await S.util.saveUserPrefs(s => s.userPrefs.showParents = checked);
                },
                getValue: (): boolean => ast.userPrefs.showParents
            }),

            new Checkbox("Show Comments", { className: "bigMarginLeft" }, {
                setValue: async (checked: boolean) => S.edit.setShowReplies(checked),
                getValue: (): boolean => ast.userPrefs.showReplies
            }),

            // NOTE: not yet needed.
            // new Checkbox("Show Properties", { className: "bigMarginLeft" }, {
            //     setValue: async (checked: boolean) => S.util.saveUserPrefs(s => s.userPrefs.showProps = checked),
            //     getValue: (): boolean => ast.userPrefs.showProps
            // })

            /* The mouse effect shows a grapical animation for each mouse click but I decided I don't like the fact
             that I have to impose an intentional performance lag to let the animation show up, so in order to have the
             absolute fastest snappiest response of the app, I'm just not using this mouseEffect for now but let's leave
             the code in place for future reference. */
            new Checkbox("Mouse Effects", { className: "bigMarginLeft" }, {
                setValue: async (checked: boolean) => S.domUtil.setMouseEffect(checked),
                getValue: (): boolean => S.domUtil.mouseEffect
            }),

            // todo-0: just display this browser info inline here....
            // new MenuItem("Browser Info", MenuPanel.browserInfo), //

            new Selection(null, "Content Width", [
                { key: "4", val: "Narrowest" },
                { key: "5", val: "Narrow" },
                { key: "6", val: "Normal" },
                { key: "7", val: "Wider" },
                { key: "8", val: "Widest" }
            ], "contentWidthSelection", "bigMarginLeft", {
                setValue: (val: string) => S.edit.setMainPanelCols(parseInt(val)),
                getValue: (): string => "" + getAs().userPrefs.mainPanelCols
            }),
            this.settingsLink(ast.mobileMode ? "Switch to Desktop Browser" : "Switch to Moble Browser", S.util.switchBrowsingMode, "marginTop"),

            // menuItem("Full Repository Export", "fullRepositoryExport", "
            // S.edit.fullRepositoryExport();") + //

            new Div("Danger Zone", { className: "settingsSectionTitle" }),
            this.settingsLink("Bulk Delete", () => { S.edit.bulkDelete(); }), //
            this.settingsLink("Close Account", () => { S.user.closeAccount(); }) //
        ]);
    }

    settingsLink = (name: string, onClick: Function, moreClasses: string = ""): Div => {
        return new Div(name, {
            className: "settingsLink " + moreClasses,
            onClick
        });
    }
}
