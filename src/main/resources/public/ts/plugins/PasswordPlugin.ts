console.log("PasswordPlugin.ts");

import * as I from "../Interfaces";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Button } from "../widget/Button";
import { VerticalLayout } from "../widget/VerticalLayout";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { PasswordPluginIntf } from "../intf/PasswordPluginIntf";
import { NotificationPopupDlg } from "../dlg/NotificationPopupDlg";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/**
 * This implements the Plugin for the Password Manager feature. Basically it lets the user save passwords on nodes that will 
 * each render a button that when clicked loads the decrypted password into the clipboard.
 */
class PasswordTypeHandler implements TypeHandlerIntf {
    constructor(private passwordPlugin : PasswordPlugin) {
    }

    render = (p) => {
        //this method not yet converted to react
        console.error("Feature not currently available.");
        return null;
    }

    // render = (node: I.NodeInfo, rowStyling: boolean): string => {
    //     let content: string = S.props.getNodePropertyVal(Constants.CONTENT, node);
    //     let password = S.props.getNodePropertyVal(Constants.PASSWORD, node);
    //     console.log("Raw Encrypted PWD: "+password);
       
    //     let vertLayout = new VerticalLayout([
    //         new Button(content, () => {
    //             this.decryptToClipboard(password);
    //          }, {
    //             className: "bash-exec-button"
    //         }),
    //     ]);
    //     return vertLayout.render_Html();
    // }

    orderProps(node: I.NodeInfo, _props: I.PropertyInfo[]): I.PropertyInfo[] {
        return _props;
    }

    getIconClass(node : I.NodeInfo): string {
        return null;
    }

    allowAction(action : string): boolean {
        return true;
    }
} 

export class PasswordPlugin implements PasswordPluginIntf {
    passwordTypeHandler : TypeHandlerIntf = new PasswordTypeHandler(this);

    init = () => {
        S.meta64.addTypeHandler("sn:passwordType", this.passwordTypeHandler);
    }
}
