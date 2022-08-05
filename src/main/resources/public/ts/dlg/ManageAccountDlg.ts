import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { ChangePasswordDlg } from "./ChangePasswordDlg";

interface LS { // Local State
    info: string;
    binQuota: number;
    binTotal: number;
}

export class ManageAccountDlg extends DialogBase {

    constructor() {
        super("Manage Account", "app-modal-content-narrow-width");
    }

    renderDlg(): CompIntf[] {
        return [
            new ButtonBar([
                !getAppState().isAdminUser ? new Button("Close Account", this.closeAccount) : null,
                new Button("Change Password", this.changePassword),
                new Button("Bulk Delete", () => {
                    S.edit.bulkDelete();
                    this.close();
                }),
                new Button("Close", this.close, null, "btn-secondary float-end")
            ], "marginTop")
        ];
    }

    closeAccount = () => {
        S.user.closeAccount();
        this.close();
    }

    changePassword = () => {
        new ChangePasswordDlg(null).open();
    }
}
