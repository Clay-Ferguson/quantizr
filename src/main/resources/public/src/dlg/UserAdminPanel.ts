import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { AddCreditDlg } from "./AddCreditDlg";
import { ConfirmDlg } from "./ConfirmDlg";
import { UserProfileDlg, LS as UserProfileDlgState } from "./UserProfileDlg";

export class UserAdminPanel extends Comp {

    constructor(private dlg: UserProfileDlg) {
        super();
        this.attribs.className = "userAdminPanel";
    }

    override preRender(): boolean | null {
        const userProfile = this.dlg.getState<UserProfileDlgState>().userProfile;
        this.children = [
            new Div("User Admin", { className: "userAdminHeading" }),
            userProfile?.balance ? new Div("Balance: " + userProfile.balance) : null,
            new ButtonBar([
                new Button("Add Credit", async () => {
                    const dlg = new AddCreditDlg();
                    await dlg.open();
                    if (dlg.amtState.getValue()) {
                        const userProfile = this.dlg.getState<UserProfileDlgState>().userProfile;
                        const ret = await S.rpcUtil.rpc<J.AddCreditRequest, J.AddCreditResponse>("addCredit", {
                            userId: userProfile.userNodeId,
                            amount: dlg.amtState.getValue()
                        });

                        if (ret?.balance) {
                            userProfile.balance = ret.balance;
                            this.dlg.mergeState<UserProfileDlgState>({ userProfile });
                        }
                    }
                }),
                new Button("Clear Transactions", async () => {
                    const dlg = new ConfirmDlg("Are you sure you want to clear transactions?", "Clear Transactions");
                    await dlg.open();
                    if (!dlg.yes) {
                        return;
                    }
                    const userProfile = this.dlg.getState<UserProfileDlgState>().userProfile;
                    await S.rpcUtil.rpc<J.DeleteUserTransactionsRequest, J.DeleteUserTransactionsResponse>("deleteUserTransactions", {
                        userId: userProfile.userNodeId
                    });

                    userProfile.balance = 0;
                    this.dlg.mergeState<UserProfileDlgState>({ userProfile });
                })
            ])
        ];
        return true;
    }
}
