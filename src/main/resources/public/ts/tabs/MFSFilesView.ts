import { useSelector } from "react-redux";
import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { IconButton } from "../comp/core/IconButton";
import { Span } from "../comp/core/Span";
import { Spinner } from "../comp/core/Spinner";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { MFSFilesViewProps } from "./MFSFilesViewProps";

export class MFSFilesView extends AppTab<MFSFilesViewProps> {

    constructor(data: TabIntf<MFSFilesViewProps>) {
        super(data);
        data.inst = this;
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        this.attribs.className = this.getClass(state);

        let children = [];

        if (this.data.props.loading) {
            children.push(new Div(null, null, [
                new Heading(4, "Loading MFS Files..."),
                new Div(null, {
                    className: "progressSpinner"
                }, [new Spinner()])
            ]));
        }
        else {
            children.push(new Heading(4, "MFS Files"));
            children.push(new Div(this.data.props.mfsFolder || ""));
            children.push(new IconButton("fa-refresh", "Root", {
                onClick: () => this.goToRoot(),
                title: "Go to root."
            }));
            children.push(new IconButton("fa-refresh", "Refresh", {
                onClick: () => this.refreshFiles(),
                title: "Refresh"
            }));
            children.push(new IconButton("fa-refresh", "Parent Folder", {
                onClick: () => this.goToParent(),
                title: "Parent Folder}"
            }));

            if (this.data.props.mfsFiles) {
                this.data.props.mfsFiles.forEach((file: J.MFSDirEntry) => {
                    let type = (file.Type === 0 || file.Size > 0) ? "file" : "folder";
                    let fullName = this.data.props.mfsFolder + "/" + file.Name;

                    children.push(new Div(null, null, [
                        new Span(file.Name + " (" + type + ")", {
                            onClick: () => { this.openFolder(fullName); }
                        }),
                        new Span(" [delete]", {
                            onClick: () => { this.deleteItem(fullName); }
                        })
                    ]));

                });
            }
        }

        this.setChildren([new Div(null, { className: "mfsFileView" }, children)]);
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

    openFolder = (folder: string) => {
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
                return s;
            });
        }, 100);
    }

    goToParent = () => {
        let parent = S.util.chopAtLastChar(this.data.props.mfsFolder, "/");
        console.log("parent = " + parent);
        if (parent) {
            this.openFolder(parent);
        }
    }

    refreshFiles = () => {
        setTimeout(async () => {
            this.openFolder(this.data.props.mfsFolder);
        }, 100);
    }

    goToRoot = () => {
        setTimeout(async () => {
            this.openFolder(null);
        }, 100);
    }
}
