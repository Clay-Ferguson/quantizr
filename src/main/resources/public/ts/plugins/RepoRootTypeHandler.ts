import * as J from "../JavaIntf";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RepoRootTypeHandler implements TypeHandlerIntf {

    getTypeName = (): string => {
        return J.NodeType.REPO_ROOT;
    }

    getName = (): string => {
        return "Repository Root";
    }

    allowPropertyEdit = (propName: string): boolean => {
        return S.meta64.isAdminUser;
    }

    render = (node: J.NodeInfo, rowStyling: boolean): Comp => {
        //this is essentially the 'default rendering' any other node has.
        return S.render.renderMarkdown(rowStyling, node, {});
    }

    orderProps(node: J.NodeInfo, _props: J.PropertyInfo[]): J.PropertyInfo[] {
        return _props;
    }

    getIconClass(node: J.NodeInfo): string {
        //https://www.w3schools.com/icons/fontawesome_icons_webapp.asp
        return "fa fa-home fa-lg";
    }

    allowAction(action: string): boolean {
        return true;
    }
}


