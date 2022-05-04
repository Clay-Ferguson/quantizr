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
import { FilesTable } from "../comp/FilesTable";
import { FilesTableCell } from "../comp/FilesTableCell";
import { FilesTableRow } from "../comp/FilesTableRow";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Constants as C } from "../Constants";
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

            let slashCount = S.util.countChars(this.data.props.mfsFolder, "/");
            let isRoot = !this.data.props.mfsFolder || slashCount === 1;
            let showParentButton = this.data.props.mfsFolder && slashCount > 1;

            children.push(new ButtonBar([
                isRoot ? null : new Button("Root", this.goToRoot, {
                    title: "Go to root folder."
                }),
                showParentButton ? new Button("Parent", this.goToParent, {
                    title: "Parent Folder}"
                }) : null,
                new IconButton("fa-refresh", null, {
                    onClick: () => this.refreshFiles(),
                    title: "Refresh"
                }, "marginAll")
            ]));

            if (this.data.props.mfsFolder) {
                children.push(new Div("MFS Path: " + this.data.props.mfsFolder, { className: "marginButtom" }));
                children.push(new Div("CID: " + this.data.props.mfsFolderCid, { className: "marginButtom" }));
                if (this.data.props.mfsFiles) {
                    children.push(this.renderFilesTable(this.data.props.mfsFiles));
                }
            }
        }

        this.setChildren([new Div(null, { className: "mfsFileView" }, children)]);
    }

    renderFilesTable = (mfsFiles: J.MFSDirEntry[]): FilesTable => {
        if (mfsFiles) {
            const propTable = new FilesTable({
                border: "1",
                className: "files-table"
            });

            mfsFiles.forEach((entry: J.MFSDirEntry) => {
                let type: string = (entry.Type === 0 || entry.Size > 0) ? "file" : "folder";
                let fullName = this.data.props.mfsFolder + "/" + entry.Name;
                // console.log("entry: " + S.util.prettyPrint(entry));

                const propTableRow = new FilesTableRow({
                    className: "files-table-row"
                }, [
                    new FilesTableCell(null, {
                        className: "files-table-type-col",
                        onClick: () => { this.openItem(fullName); }
                    }, [
                        type === "file" ? null : new Icon({
                            // className: "fa fa-lg " + (type === "file" ? "fa-file fileIcon" : "fa-folder folderIcon")
                            className: "fa fa-lg fa-folder folderIcon"
                        })
                    ]),
                    new FilesTableCell(entry.Name, {
                        className: "files-table-name-col",
                        onClick: () => { this.openItem(fullName); }
                    }),
                    new FilesTableCell(null, {
                        className: "files-table-delete-col",
                        onClick: () => { this.deleteItem(fullName); }
                    }, [
                        new Icon({
                            className: "fa fa-trash fa-lg clickable",
                            title: "Delete",
                            onClick: () => this.refreshFiles()
                        })
                    ])
                ]);
                propTable.addChild(propTableRow);
            });
            return propTable;
        } else {
            return null;
        }
    }

    deleteItem = (item: string) => {
        dispatch("Action_deleteMFSFile", (s: AppState): AppState => {
            this.data.props.loading = true;
            return s;
        });

        setTimeout(async () => {
            let res: J.DeleteMFSFileResponse = await S.util.ajax<J.DeleteMFSFileRequest, J.DeleteMFSFileResponse>("deleteMFSFile", {
                item
            });

            this.refreshFiles();
        }, 100);
    }

    openItem = (folder: string) => {
        dispatch("Action_RefreshMFSFiles", (s: AppState): AppState => {
            this.data.props.loading = true;
            return s;
        });

        setTimeout(async () => {
            let res: J.GetMFSFilesResponse = await S.util.ajax<J.GetMFSFilesRequest, J.GetMFSFilesResponse>("getMFSFiles", {
                folder
            });

            dispatch("Action_GotMFSFiles", (s: AppState): AppState => {
                this.data.props.loading = false;
                this.data.props.mfsFiles = res.files;
                this.data.props.mfsFolder = res.folder;
                this.data.props.mfsFolderCid = res.cid;
                return s;
            });
        }, 100);
    }

    goToParent = () => {
        let parent = S.util.chopAtLastChar(this.data.props.mfsFolder, "/");
        // console.log("parent = " + parent);
        if (parent) {
            this.openItem(parent);
        }
    }

    refreshFiles = () => {
        setTimeout(async () => {
            this.openItem(this.data.props.mfsFolder);
        }, 100);
    }

    goToRoot = () => {
        setTimeout(async () => {
            this.openItem(null);
        }, 100);
    }
}
