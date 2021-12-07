import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { CollapsiblePanel } from "../comp/CollapsiblePanel";
import { PieChart } from "../comp/PieChart";
import { TextContent } from "../comp/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    info: string;
    binQuota: number;
    binTotal: number;
}

export class ManageAccountDlg extends DialogBase {

    constructor(state: AppState) {
        super("Manage Account", "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        let state: any = this.getState<LS>();

        let data = null;
        if (state.binQuota) {
            let available = state.binQuota - state.binTotal;
            data = [
                { label: "Used: " + S.util.formatMemory(state.binTotal), value: state.binTotal, color: "#377eb8" },
                { label: "Available: " + S.util.formatMemory(available), value: available, color: "#4daf4a" }];
        }

        return [
            new TextContent(this.getState<LS>().info, null, true),
            data ? new PieChart(data) : null,

            new CollapsiblePanel(null, null, null, [
                new Button("Close Account", this.closeAccount),
                new Button("Change Password", this.changePassword)
            ], false, null, false, "float-end"),

            new ButtonBar([
                new Button("Close", this.close)
            ], "marginTop")
        ];
    }

    async preLoad(): Promise<void> {
        let res: J.GetUserAccountInfoResponse = await S.util.ajax<J.GetUserAccountInfoRequest, J.GetUserAccountInfoResponse>("getUserAccountInfo");

        let used = "";
        if (res.binQuota <= 0) {
            res.binQuota = 20 * 1024 * 1024;
        }
        if (res.binQuota > 0) {
            if (res.binTotal < 10) {
                used = "0%";
            }
            else {
                used = (res.binTotal * 100 / res.binQuota).toFixed(1) + "%";
            }
        }

        let info = //
            "Your Storage Quota: " + S.util.formatMemory(res.binQuota) + "\n" +//
            "Storage Used: " + S.util.formatMemory(res.binTotal) + "\n" +//
            "Percent Used: " + used;

        this.mergeState<LS>({
            info,
            binQuota: res.binQuota,
            binTotal: res.binTotal
        });
    }

    closeAccount = (): void => {
        S.user.closeAccount();
        this.close();
    }

    changePassword = () => {
        S.edit.openChangePasswordDlg(this.appState);
    }
}
