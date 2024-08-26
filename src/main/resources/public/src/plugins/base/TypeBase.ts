import { getAs } from "../../AppContext";
import * as I from "../../Interfaces";
import { ConfigProp, EditorOptions } from "../../Interfaces";
import * as J from "../../JavaIntf";
import { NodeInfo, PrincipalName } from "../../JavaIntf";
import { S } from "../../Singletons";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Comp } from "../../comp/base/Comp";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { Html } from "../../comp/core/Html";
import { NodeCompMarkdown } from "../../comp/node/NodeCompMarkdown";
import { TabIntf } from "../../intf/TabIntf";
import { NodeActionType, TypeIntf } from "../../intf/TypeIntf";

export type UrlInfo = {
    url: string;
    shortOg?: boolean;
};

/* NOTE: Defaults to only allowing 'admin' to edit unless allowPropertyEdit is overridden */
export class TypeBase implements TypeIntf {
    public ordinal: number;
    public schemaOrg: J.SchemaOrgClass;

    constructor(public readonly typeName: string, public readonly displayName: string, private iconStyle: string, private allowUserSelect: boolean) {
    }

    getEditorHelp(): string {
        return null;
    }

    getAutoExpandProps(node: NodeInfo): boolean {
        // by default only expand props if this is a schema.org type, or if there's a query template, so the user can see the template used to generate content
        return !!this.schemaOrg || !!S.props.getPropStr(J.NodeProp.AI_QUERY_TEMPLATE, node)
    }

    getAllowUserSelect(): boolean {
        return this.allowUserSelect;
    }

    renderEditorSubPanel = (_node: NodeInfo): Comp => {
        return null;
    }

    getEditLabelForProp(_node: NodeInfo, propName: string): string {
        if (propName === J.NodeProp.AI_QUERY_TEMPLATE) {
            return "AI Query (Answer overwrites Content)";
        }
        else if (propName === J.NodeProp.DATE) {
            return I.DomainType.Date;
        }
        else if (propName === J.NodeProp.DURATION) {
            return "Duration (HH:MM)";
        }
        return propName;
    }

    getEditorRowsForProp(propName: string): number {
        if (propName === J.NodeProp.AI_QUERY_TEMPLATE) {
            return 5;
        }
        else {
            return 1;
        }
    }

    /* Enables editor to show buttons for adding/deleting custom properties */
    getAllowPropertyAdd(): boolean {
        return true;
    }

    /* Enables editor to control wether content edit textarea shows up in editor dialog */
    getAllowContentEdit(): boolean {
        return true;
    }

    getExtraMarkdownClass(): string {
        return null;
    }

    getCustomFooter(_node: NodeInfo): Div {
        return null;
    }

    getAllowRowHeader(): boolean {
        return true;
    }

    getTypeName(): string {
        return this.typeName;
    }

    // schema.org compatable types: Text, Date, Number
    getType(prop: string): string {
        return this.getSchemaOrgPropType(prop) || (prop === "date" ? I.DomainType.Date : I.DomainType.Text);
    }

    // for doing simplest possible layouts we allow types to set the width percent used by each property
    // and then we just let a "display: flex" style take care of rendering them left to right top to bottom
    getPropConfig = (prop: string): ConfigProp => {
        return S.quanta.cfg.props?.[this.typeName]?.[prop];
    }

    getSchemaOrgPropComment(prop: string): string {
        if (!this.schemaOrg) return null;
        for (const p of this.schemaOrg.props) {
            if (p.label === prop) {
                return p.comment;
            }
        }
        return null;
    }

    getSchemaOrgPropType(prop: string): string {
        if (!this.schemaOrg) return null;
        for (const p of this.schemaOrg.props) {
            if (p.label === prop) {
                for (const r of p.ranges) {
                    switch (r.id) {
                        case I.DomainType.Number:
                        case I.DomainType.Text:
                        case I.DomainType.Date:
                            return r.id;

                        default: break;
                    }
                }
                return null;
            }
        }
        return null;
    }

    /* If this returns non-null the editor dialog is expected to show only the enumerated properties for editing

    note: adding NodeProps.CONTENT ('cont') to this (not a genuine property like the rest, is allowed, and it
        means we will be allowing edit of the main node content text
    */
    getCustomProperties(): string[] {
        return null;
    }

    getSelectableProperties(): string[] {
        return null;
    }

    hasCustomProp = (prop: string): boolean => {
        const props = this.getCustomProperties();
        if (!props) return false;
        return !!props.find(p => p === prop);
    }

    hasSelectableProp = (prop: string): boolean => {
        const props = this.getSelectableProperties();
        if (!props) return false;
        return !!props.find(p => p === prop);
    }

    allowDeleteProperty = (prop: string) => {
        let ret = true;
        const typeObj = S.quanta.cfg.props?.[this.typeName];

        // if a configured property scan for any fields that aren't on the node yet and add them with blank default
        if (typeObj) {
            S.util.forEachProp(typeObj, (k: string, _v: any): boolean => {
                if (k === prop) {
                    ret = false;
                    return false; // stop iterating
                }
            });
        }
        return ret;
    }

    /* Types can override this to ensure that during node editing there is a hook to prefill and create any properties that are
    required to exist on that type of node in case they aren't existing yet
    */
    ensureDefaultProperties(node: NodeInfo) {
        // look for this as a configured property
        const typeObj = S.quanta.cfg.props?.[node.type];

        // if a configured property scan for any fields that aren't on the node yet and add them with blank default
        if (typeObj) {
            S.util.forEachProp(typeObj, (k: string, _v: any): boolean => {
                const propFound = node.properties.find(p => p.name === k);
                if (!propFound) {
                    node.properties.push({ name: k, value: "" });
                }
                return true;
            });
        }
    }

    getName(): string {
        return this.displayName;
    }

    allowPropertyEdit(propName: string): boolean {
        const isHidden = S.props.isHiddenPropName(propName);
        return !isHidden;
    }

    parseUrlsFromHtml = (node: NodeInfo): Map<string, UrlInfo> => {
        const val = node.content;

        // this is just a performance optimization to bypass the function if we know we can 
        if (val.indexOf("<a ") === -1 ||
            val.indexOf(">") === -1) return;

        const elm = document.createElement("html");
        elm.innerHTML = val;
        let ret: Map<string, UrlInfo> = null

        // BEWARE: The elements we scan here are NOT part of the DOM, we are just extracting out
        // the urls here.
        elm.querySelectorAll("a").forEach((e: HTMLAnchorElement) => {
            if (!e.href) return;
            let href = e.href.trim();
            href = S.util.stripIfEndsWith(href, "/");
            href = S.util.stripIfEndsWith(href, "\\");

            // Only add to 'urls' if we do NOT have an attachment pointing to the same href, because this
            // would make it render it twice because we already know the attachments will rendering.
            if (!S.props.getAttachmentByUrl(node, href)) {
                // lazy instantiate
                ret = ret || new Map<string, UrlInfo>();
                ret.set(href, { url: href });
            }
        });
        return ret;
    }

    parseUrlsFromText = (content: string): Map<string, UrlInfo> => {
        if (!content || content.toLowerCase().indexOf("http") === -1) return null;

        // When the rendered content contains urls we will load the "Open Graph" data and display it below the content.
        let ret: Map<string, UrlInfo> = null
        const lines = content.split("\n");

        if (lines) {
            lines.forEach(line => {
                let shortOg = false;
                // strip out any leading "- " because that dash is how we let users indicate NOT to render the URL itself but only the opengraph
                if (line.startsWith("- ")) {
                    line = line.substring(2);
                }
                else if (line.startsWith("-- ")) {
                    shortOg = true;
                    line = line.substring(3);
                }

                if (line.startsWith("http://") || line.startsWith("https://")) {
                    ret = ret || new Map<string, UrlInfo>();
                    ret.set(line, { url: line.trim(), shortOg });
                }
            });
        }

        return ret;
    }

    render = (node: NodeInfo, tabData: TabIntf<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        // const prop = S.props.getProp(J.NodeProp.ORDER_BY, node);
        // I was trying to let this button decrypt, but react is saying the component got unmounted
        // and thrownging an error when the decrypt call below tries to update the state on a component
        // that somehow is already gone by the time it runs.
        //
        // Solution: I'm just going with the autoDecrypting==true setup for now, and will come back
        // and solve this later.
        //
        // else if (node.content && node.content.startsWith(J.Constant.ENC_TAG)) {
        //     return new Div(null, null, [
        //         markdownComp = new NodeCompMarkdown(node, state),
        //         new ButtonBar([
        //             new Button("Decrypt", () => {
        //                 markdownComp.decrypt();
        //             })
        //         ], null, "marginLeft marginBottom")
        //     ]);
        // }
        const ast = getAs();

        let choices: Div = null
        const oneOf: any[] = S.props.getPropObj("oneOf", node);
        if (oneOf) {
            const children: Comp[] = [];
            for (const o of oneOf) {
                children.push(new Div("*  " + o.name + ` (${o.replies?.totalItems} votes)`, { className: "bigMarginLeft marginBottom" }));
            }
            choices = new Div(null, { className: "marginTop" }, children);
        }

        let cont = node.renderContent || node.content;
        if (cont) {
            cont = cont.trim();
        }

        let comp: Comp = null;
        let urls: Map<string, UrlInfo> = null;
        const containerClass = this.getExtraMarkdownClass();
        const footerComp: Div = this.getCustomFooter(node);
        const attrs = containerClass ? { className: containerClass } : null;

        // tricky and imperfect hack to detect if this is all HTML.
        if (cont && cont.startsWith("<") && cont.indexOf(">") < 30 && cont.endsWith(">")) {
            urls = this.parseUrlsFromHtml(node);

            // The reason we don't sanitize for admin users is mainly because we need the code containing the
            // donations link to work, but there may also be other times we want the admin allowed to embed raw HTML
            const sanitize = node.owner !== PrincipalName.ADMIN;
            comp = new Html(cont, { className: "marginLeft marginTop" }, null, sanitize);
        }
        // else render as markdown
        else {
            urls = this.parseUrlsFromText(cont);
            comp = cont ? new NodeCompMarkdown(node, null, tabData, urls) : null;
        }

        /* if we have URLs, then render them if available, but note they render asynchronously
        so this code will actually execute everytime a new OpenGraph result comes in and triggeres a state
        dispatch which causes a new render
        */
        if (urls) {
            const children: Comp[] = [comp, choices];
            let count = 0;

            urls.forEach((ui: UrlInfo) => {
                // allow max of 50 urls.
                if (count++ < 50) {
                    const og = new OpenGraphPanel(tabData, "og" + count + "_" + comp.getId(), ui,
                        ui.shortOg ? "openGraphPanelSimple" : "openGraphPanel", "openGraphImage", true, true, true);
                    children.push(og);

                    if (tabData) {
                        tabData.openGraphComps.push(og);
                    }
                }
            });
            children.push(footerComp);
            children.push(new Clearfix());
            return new Div(null, attrs, children);
        }
        else {
            const isRoot = node.id === ast.node?.id;

            let aiConfigDiv: Div = null;
            if (S.props.isMine(node) && node.type !== J.NodeType.AI_ANSWER) {
                if (S.props.hasAIConfigProps(node)) {
                    aiConfigDiv = new Div("AI Agent", {
                        onClick: () => S.edit.configureAgent(node),
                        className: "nodeTags aiTags microMarginBottom float-end",
                        title: "Configure Agent Settings"
                    });
                }
                else {
                    const template: string = S.props.getPropStr(J.NodeProp.AI_QUERY_TEMPLATE, node);
                    if (template) {
                        aiConfigDiv = new Div(null, { className: template ? "aiConfigSection" : null }, [
                            new Div("AI Prompt", {
                                className: "aiPrompt microMarginBottom float-end",
                            }),
                            template ? new Div(template, { className: "microMarginBottom" }) : null
                        ]);
                    }
                }
            }

            // If this node has tags render them below the content (if we have edit mode or info turned on)
            if (node.tags && S.util.showMetaData(ast, node)) {
                return new Div(null, attrs, [
                    aiConfigDiv,
                    comp,
                    choices,
                    S.render.renderTagsDiv(node, isRoot ? "smallMarginBottom" : "microMarginBottom"),
                    footerComp,
                    new Clearfix(),
                ])
            }
            // otherwise just return the content component itself.
            else {
                return new Div(null, attrs, [aiConfigDiv, comp, choices, footerComp, new Clearfix()]);
            }
        }
    }

    getIconClass(): string {
        // https://www.w3schools.com/icons/fontawesome_icons_webapp.asp
        if (!this.iconStyle) return null;
        return "fa " + this.iconStyle + " fa-lg";
    }

    allowAction(_action: NodeActionType, _node: NodeInfo): boolean {
        return true;
    }

    domPreUpdateFunction(_parent: Comp): void {
    }

    ensureStringPropExists(node: NodeInfo, propName: string) {
        const prop = S.props.getProp(propName, node);
        if (!prop) {
            node.properties = node.properties || [];
            node.properties.push({
                name: propName,
                value: ""
            });
        }
    }

    /* When this returns true we know the main view should embed these nodes in a collapsed panel */
    isSpecialAccountNode(): boolean {
        return false;
    }

    subOrdinal(): number {
        return -1;
    }

    getEditorOptions(): EditorOptions {
        return {};
    }
}
