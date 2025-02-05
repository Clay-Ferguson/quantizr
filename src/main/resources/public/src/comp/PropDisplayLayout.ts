import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { Div } from "./core/Div";

export class PropDisplayLayout extends Comp {

    constructor(private node: NodeInfo) {
        super({
            className: "fieldDisplayPanel"
        });
    }

    override preRender(): boolean | null {
        const children: Comp[] = [];
        const type = S.plugin.getType(this.node.type);
        if (this.node.properties) {
            this.node.properties.forEach(prop => {
                if (S.props.isGuiControlBasedProp(prop) || S.props.isHiddenProp(prop)) return;

                const propConfig = type.getPropConfig(prop.name);
                const ordinal: number = propConfig?.ord || 200; // 200 is just a high enough number to fall below numered ones
                const label = propConfig?.label || (type ? type.getEditLabelForProp(this.node, prop.name) : prop.name);
                const comment = type.getSchemaOrgPropComment(prop.name);
                const w: number = propConfig?.width || 100;
                const widthStr = "" + w + "%";

                // warning: don't put any margin or padding on this div. It depends on precise layouts using precise widths.
                const attrs: any = {
                    className: "fieldDisplayCell",
                    title: "Property: " + prop.name + (comment ? ("\n\n" + comment) : "")
                };
                attrs.style = { width: widthStr, maxWidth: widthStr };
                const propType = type.getType(prop.name);
                const displayVal = S.util.formatProperty(prop.value, propType, propConfig) || "?";

                const tableRow = new Div(null, attrs, [
                    new Div(label, { className: "fieldDisplayLabel" }),
                    new Div(displayVal, { className: "fieldDisplayVal" })
                ]);
                tableRow.ordinal = ordinal;
                children.push(tableRow);
            });
        }
        const innerDiv = new Div(null, { className: "flexPropsDisplayPanel" }, children)
        innerDiv.children?.sort((a: any, b: any) => a.ordinal - b.ordinal);
        this.children = [innerDiv];
        return true;
    }
}
