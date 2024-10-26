import { dispatch, getAs } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { DocumentRSInfo } from "../DocumentRSInfo";
import { TabBase } from "../intf/TabBase";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { DocumentView } from "./DocumentView";

export class DocumentResultSetView<TT extends DocumentRSInfo> extends DocumentView<TT, DocumentResultSetView<TT>> {

    constructor(data: TabBase<TT, DocumentResultSetView<TT>>) {
        super(data);
        data.inst = this;

        // turn the top more button off for infinite scrolling
        this.allowTopMoreButton = false;
        this.pagingContainerClass = "float-right";
    }

    override renderItem(node: NodeInfo, _i: number, _rowCount: number, jumpButton: boolean): Comp {
        const ast = getAs();
        // Our header base in this scenario has the edit controls intermingled with the rest, so for
        // now if either of these user prefs is active we show the header bar.
        const allowHeader = S.util.showMetaData(ast, node) || ast.userPrefs.editMode;

        // we have 'marginButtom' on these just to add extra space between paragraphs for a less
        // compact view. We could make this paragraph spacing a user preference...some day. Note:
        // It's important to have 'this.data.id' as a classname on every item, even though it's not
        // for styling, it's essentially to support DOM finding.
        let itemClass = (allowHeader ? "documentItem" : "mb-3");
        const itemClassHighlight = (allowHeader ? "documentItemHighlight" : "mb-3");

        const rootSlashesMatch = this.data.props.node.path.match(/\//g);
        const nodeSlashesMatch = node.path.match(/\//g);

        let style = null;
        if (!ast.mobileMode && ast.docIndent) {
            const indentLevel = (nodeSlashesMatch ? nodeSlashesMatch.length : 0) - (rootSlashesMatch ? rootSlashesMatch.length : 0);
            if (indentLevel > 0) {
                style = { marginLeft: "" + (indentLevel * 25) + "px" };
                itemClass += " indentedDocumentItem";
            }
        }
        return S.srch.renderSearchResultAsListItem(node, this.data, jumpButton, allowHeader, itemClass, itemClassHighlight, style);
    }

    override getFloatRightHeaderComp(): Comp {
        const ast = getAs();
        return new Div(null, { className: "float-right" }, [
            ast.mobileMode ? null : new Checkbox("Images", {
                className: "ml-3",
                title: "Display inline images"
            }, {
                setValue: (checked: boolean) => {
                    dispatch("docImages", s => {
                        s.docImages = checked;
                    });
                },
                getValue: (): boolean => {
                    return getAs().docImages;
                }
            }),
            ast.mobileMode ? null : new Checkbox("Indent", {
                className: "ml-3",
                title: "Indent the Document based on content hierarchy"
            }, {
                setValue: (checked: boolean) => {
                    dispatch("DocIndent", s => {
                        s.docIndent = checked;
                    });
                },
                getValue: (): boolean => {
                    return getAs().docIndent;
                }
            }),
            new Checkbox("Comments", {
                className: "ml-3",
                title: "Include all the Comment Nodes in the Document"
            }, {
                setValue: async (checked: boolean) => {
                    await S.edit.setShowComments(checked);
                    this.pageChange(null);
                },
                getValue: (): boolean => {
                    return getAs().userPrefs.showReplies;
                }
            })
        ]);
    }

    override extraPagingComps(): Comp[] {
        return null;
    }
}
