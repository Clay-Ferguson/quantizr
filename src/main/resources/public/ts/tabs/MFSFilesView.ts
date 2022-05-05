import { useSelector } from "react-redux";
import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { Icon } from "../comp/core/Icon";
import { IconButton } from "../comp/core/IconButton";
import { Spinner } from "../comp/core/Spinner";
import { TextField } from "../comp/core/TextField";
import { FilesTable } from "../comp/FilesTable";
import { FilesTableCell } from "../comp/FilesTableCell";
import { FilesTableRow } from "../comp/FilesTableRow";
import { Constants as C } from "../Constants";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { MFSFilesViewProps } from "./MFSFilesViewProps";

export class MFSFilesView extends AppTab<MFSFilesViewProps> {

    loaded: boolean = false;

    constructor(data: TabIntf<MFSFilesViewProps>) {
        super(data);
        data.inst = this;

        PubSub.subSingleOnce(C.PUBSUB_tabChanging, (tabName: string) => {
            if (tabName === this.data.id) {
                // only ever do this once, just to save CPU load on server.
                if (this.loaded) return;
                this.loaded = true;
                this.refreshFiles();
            }
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        this.attribs.className = this.getClass(state);

        let children = [];

        if (this.data.props.loading) {
            children.push(new Div(null, null, [
                new Heading(4, "Loading Web3 Files..."),
                new Div(null, {
                    className: "progressSpinner"
                }, [new Spinner()])
            ]));
        }
        else {
            children.push(new Heading(4, "Web3 Files"));

            let mfsFolder = this.data.props.cidField.getValue();
            let slashCount = S.util.countChars(mfsFolder, "/");
            let isRoot = !mfsFolder || slashCount === 1;
            let showParentButton = mfsFolder && slashCount > 1;

            children.push(new Div(null, null, [
                new TextField({
                    val: this.data.props.cidField,
                    placeholder: "Find CID...",
                    enter: () => {
                        let item = this.data.props.cidField.getValue();
                        if (item) {
                            this.openItem(item);
                        }
                    }
                })
            ]));

            children.push(new ButtonBar([
                isRoot ? null : new Button("Root", this.goToRoot, {
                    title: "Go to root folder."
                }),
                showParentButton ? new Button("Parent", this.goToParent, {
                    title: "Parent Folder}"
                }) : null,
                new IconButton("fa-refresh", "Search", {
                    onClick: () => this.refreshFiles(),
                    title: "Refresh"
                }, "marginAll")
            ]));

            let mfsMode = mfsFolder && mfsFolder.indexOf("/") === 0;
            children.push(new Heading(5, "Retrieval Mode: " + (mfsMode ? "MFS" : "DAG")))

            // Only show the CID if it's different from what's in search field
            if (this.data.props.mfsFolderCid && this.data.props.mfsFolderCid !== mfsFolder) {
                children.push(new Div("CID: " + this.data.props.mfsFolderCid, { className: "marginButtom" }));
            }

            if (this.data.props.mfsFiles) {
                children.push(this.renderFilesTable(this.data.props.mfsFiles));
            }
        }

        this.setChildren([new Div(null, { className: "mfsFileView" }, children)]);
    }

    renderFilesTable = (mfsFiles: J.MFSDirEntry[]): FilesTable => {
        if (mfsFiles) {
            let mfsFolder = this.data.props.cidField.getValue();
            // mfsMode means this is a true MFS query on the local server and not a DAG query of CID which can be remote.
            let mfsMode = mfsFolder && mfsFolder.indexOf("/") === 0;

            const propTable = new FilesTable({
                border: "1",
                className: "files-table"
            });

            mfsFiles.forEach((entry: J.MFSDirEntry) => {
                let iconClass: string = null;
                switch (entry.Type) {
                    case 0:
                        iconClass = "fa-file fileIcon";
                        break;
                    case 1:
                        iconClass = "fa-folder folderIcon";
                        break;
                    default:
                        iconClass = "fa-caret-right";
                        break;
                }

                let fullName = mfsMode ? (mfsFolder + "/" + entry.Name) : null;
                let locationToOpen = mfsMode ? fullName : entry.Hash;

                // console.log("entry: " + S.util.prettyPrint(entry));

                const propTableRow = new FilesTableRow({
                    className: "files-table-row"
                }, [
                    new FilesTableCell(null, {
                        className: "files-table-type-col",
                        onClick: () => { this.openItem(locationToOpen); }
                    }, [
                        new Icon({
                            className: "fa fa-lg " + iconClass
                        })
                    ]),
                    new FilesTableCell(entry.Name, {
                        className: "files-table-name-col",
                        onClick: () => { this.openItem(locationToOpen); }
                    }),

                    // only show th edelete button for local mfsMode stuff.
                    mfsMode ? new FilesTableCell(null, {
                        className: "files-table-delete-col",
                        onClick: () => { this.deleteItem(fullName); }
                    }, [
                        new Icon({
                            className: "fa fa-trash fa-lg clickable",
                            title: "Delete",
                            onClick: () => this.refreshFiles()
                        })
                    ]) : null
                ]);
                propTable.addChild(propTableRow);
            });
            return propTable;
        } else {
            return null;
        }
    }

    deleteItem = (item: string) => {
        // DO NOT DELETE (may decide to do this some day)
        // dispatch("Action_deleteMFSFile", (s: AppState): AppState => {
        //     this.data.props.loading = true;
        //     return s;
        // });

        setTimeout(async () => {
            let res: J.DeleteMFSFileResponse = await S.util.ajax<J.DeleteMFSFileRequest, J.DeleteMFSFileResponse>("deleteMFSFile", {
                item
            });

            this.refreshFiles();
        }, 100);
    }

    openItem = (folder: string) => {
        // DO NOT DELETE (may decide to do this some day)
        // dispatch("Action_RefreshMFSFiles", (s: AppState): AppState => {
        //     this.data.props.loading = true;
        //     return s;
        // });

        setTimeout(async () => {
            console.log("Loading: " + folder);

            // ensure this is never empty string. Server needs to get null instead of empty string.
            if (!folder) folder = null;

            let res: J.GetMFSFilesResponse = await S.util.ajax<J.GetMFSFilesRequest, J.GetMFSFilesResponse>("getMFSFiles", {
                folder
            });

            dispatch("Action_GotMFSFiles", (s: AppState): AppState => {
                this.data.props.loading = false;
                this.data.props.mfsFiles = res.files;
                this.data.props.cidField.setValue(res.folder);
                this.data.props.mfsFolderCid = res.cid;
                return s;
            });
        }, 100);
    }

    goToParent = () => {
        let mfsFolder = this.data.props.cidField.getValue();
        // mfsMode means this is a true MFS query on the local server and not a DAG query of CID which can be remote.
        let mfsMode = mfsFolder && mfsFolder.indexOf("/") === 0;
        if (!mfsMode) return;

        let parent = S.util.chopAtLastChar(mfsFolder, "/");
        // console.log("parent = " + parent);
        if (parent) {
            this.openItem(parent);
        }
    }

    refreshFiles = () => {
        setTimeout(async () => {
            let mfsFolder = this.data.props.cidField.getValue();
            this.openItem(mfsFolder);
        }, 100);
    }

    goToRoot = () => {
        setTimeout(async () => {
            this.openItem(null);
        }, 100);
    }
}
