import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";

interface LS { // Local State
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

        return [
            new ButtonBar([
                !this.appState.isAdminUser ? new Button("Close Account", this.closeAccount) : null,
                new Button("Change Password", this.changePassword),
                new Button("Close", this.close, null, "btn-secondary float-end")
            ], "marginTop")
        ];
    }

    closeAccount = (): void => {
        S.user.closeAccount();
        this.close();
    }

    changePassword = () => {
        S.edit.openChangePasswordDlg(this.appState);
    }
}
