package quanta.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.instrument.PerfMon;
import quanta.model.client.NodeType;
import quanta.request.AIGenImageRequest;
import quanta.request.AIGenSpeechRequest;
import quanta.request.AddCreditRequest;
import quanta.request.AddFriendRequest;
import quanta.request.AddPrivilegeRequest;
import quanta.request.AskSubGraphRequest;
import quanta.request.BlockUserRequest;
import quanta.request.ChangePasswordRequest;
import quanta.request.CheckMessagesRequest;
import quanta.request.CloseAccountRequest;
import quanta.request.CopySharingRequest;
import quanta.request.CreateSubNodeRequest;
import quanta.request.DeleteAttachmentRequest;
import quanta.request.DeleteFriendRequest;
import quanta.request.DeleteMFSFileRequest;
import quanta.request.DeleteNodesRequest;
import quanta.request.DeletePropertyRequest;
import quanta.request.DeleteUserTransactionsRequest;
import quanta.request.ExportRequest;
import quanta.request.GetBookmarksRequest;
import quanta.request.GetFollowersRequest;
import quanta.request.GetFollowingRequest;
import quanta.request.GetIPFSContentRequest;
import quanta.request.GetIPFSFilesRequest;
import quanta.request.GetMultiRssRequest;
import quanta.request.GetNodeJsonRequest;
import quanta.request.GetNodePrivilegesRequest;
import quanta.request.GetNodeStatsRequest;
import quanta.request.GetOpenGraphRequest;
import quanta.request.GetSchemaOrgTypesRequest;
import quanta.request.GetServerInfoRequest;
import quanta.request.GetSharedNodesRequest;
import quanta.request.GetThreadViewRequest;
import quanta.request.GetUserAccountInfoRequest;
import quanta.request.GetUserProfileRequest;
import quanta.request.GraphRequest;
import quanta.request.InitNodeEditRequest;
import quanta.request.InsertNodeRequest;
import quanta.request.JoinNodesRequest;
import quanta.request.LinkNodesRequest;
import quanta.request.LoadNodeFromIpfsRequest;
import quanta.request.LoginRequest;
import quanta.request.LogoutRequest;
import quanta.request.LuceneIndexRequest;
import quanta.request.LuceneSearchRequest;
import quanta.request.MoveNodesRequest;
import quanta.request.NodeFeedRequest;
import quanta.request.NodeSearchRequest;
import quanta.request.PasteAttachmentsRequest;
import quanta.request.PingRequest;
import quanta.request.PublishNodeToIpfsRequest;
import quanta.request.RemovePrivilegeRequest;
import quanta.request.RemoveSignaturesRequest;
import quanta.request.RenderCalendarRequest;
import quanta.request.RenderDocumentRequest;
import quanta.request.RenderNodeRequest;
import quanta.request.ResetPasswordRequest;
import quanta.request.SaveNodeJsonRequest;
import quanta.request.SaveNodeRequest;
import quanta.request.SavePublicKeyRequest;
import quanta.request.SaveUserPreferencesRequest;
import quanta.request.SaveUserProfileRequest;
import quanta.request.SearchAndReplaceRequest;
import quanta.request.SelectAllNodesRequest;
import quanta.request.SendLogTextRequest;
import quanta.request.SendTestEmailRequest;
import quanta.request.SetCipherKeyRequest;
import quanta.request.SetExpandedRequest;
import quanta.request.SetNodePositionRequest;
import quanta.request.SetUnpublishedRequest;
import quanta.request.SignNodesRequest;
import quanta.request.SignSubGraphRequest;
import quanta.request.SignupRequest;
import quanta.request.SplitNodeRequest;
import quanta.request.SubGraphHashRequest;
import quanta.request.TransferNodeRequest;
import quanta.request.UpdateFriendNodeRequest;
import quanta.request.UpdateHeadingsRequest;
import quanta.request.UploadFromIPFSRequest;
import quanta.request.UploadFromUrlRequest;
import quanta.util.CaptchaMaker;

/**
 * Primary Spring MVC controller.
 */
@Controller
public class AppController extends ServiceBase implements ErrorController {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(AppController.class);

    public static final String API_PATH = "/api";
    public static final String ADMIN_PATH = "/admin";
    public static final String FILE_PATH = "/f";

    // NOTE: server.error.path app property points to this.
    private static final String ERROR_MAPPING = "/error";

    @RequestMapping(ERROR_MAPPING)
    public String error(Model model) {
        model.addAttribute("hostAndPort", prop.getHostAndPort());
        model.addAllAttributes(render.getThymeleafAttribs());
        // pulls up error.html
        return "error";
    }

    /*
     * This is the actual app page loading request, for his SPA (Single Page Application) this is the
     * request to load the page.
     *
     * ID is optional url parameter that user can specify to access a specific node
     *
     * passCode is an auth code for a password reset
     *
     * Renders with Thymeleaf.
     */
    @PerfMon
    @RequestMapping({"/", "/n/{nameOnAdminNode}", "/u/{userName}/{nameOnUserNode}"})
    public String index( //
            // =======================================================================================
            /* PATH PARAMS */
            // node name on 'admin' account. Non-admin named nodes use url
            // "/u/userName/nodeName"
            @PathVariable(value = "nameOnAdminNode", required = false) String nameOnAdminNode, //
            @PathVariable(value = "nameOnUserNode", required = false) String nameOnUserNode, //
            @PathVariable(value = "userName", required = false) String userName, //
            //
            // =======================================================================================
            /* REQUEST PARAMS */
            @RequestParam(value = "id", required = false) String id, //
            @RequestParam(value = "refNodeId", required = false) String refNodeId, //
            @RequestParam(value = "search", required = false) String search, //
            // be careful removing this, clicking on a node updates the browser history to
            // an 'n=' style url if this node is named
            // so we will need to change that to the path format.
            @RequestParam(value = "n", required = false) String name, //
            @RequestParam(value = "passCode", required = false) String passCode, //
            @RequestParam(value = "signupCode", required = false) String signupCode, //
            @RequestParam(value = "login", required = false) String login, //
            @RequestParam(value = "view", required = false) String view, //
            HttpSession session, //
            Model model) {
        return render.getIndexPage(nameOnAdminNode, nameOnUserNode, userName, id, search, name, signupCode, login, view,
                model);
    }

    @RequestMapping(value = API_PATH + "/getMultiRssFeed", method = RequestMethod.POST)
    @ResponseBody
    public Object getMultiRssFeed(@RequestBody GetMultiRssRequest req, HttpSession session) {
        return callProc.run("getMultiRssFeed", false, false, req, session, ms -> {
            return arun.run(as -> {
                return rssFeed.getMultiRssFeed(req);
            });
        });
    }

    @RequestMapping(value = API_PATH + "/signup", method = RequestMethod.POST)
    @ResponseBody
    public Object signup(@RequestBody SignupRequest req, HttpSession session) {
        return callProc.run("signup", false, false, req, session, ms -> {
            boolean automated = ms.isAdmin() && "adminCreatingUser".equals(req.getCaptcha());
            return user.signup(req, automated);
        });
    }

    @RequestMapping(value = API_PATH + "/login", method = RequestMethod.POST)
    @ResponseBody
    public Object login(@RequestBody LoginRequest req, HttpServletRequest httpReq, HttpSession session) {
        return callProc.run("login", false, false, req, session, ms -> {
            return user.login(httpReq, req);
        });
    }

    @RequestMapping(value = API_PATH + "/closeAccount", method = RequestMethod.POST)
    @ResponseBody
    public Object closeAccount(@RequestBody CloseAccountRequest req, HttpSession session) {
        return callProc.run("closeAccount", true, true, req, session, ms -> {
            return user.closeAccount(req, session);
        });
    }

    @RequestMapping(value = API_PATH + "/logout", method = RequestMethod.POST)
    @ResponseBody
    public Object logout(@RequestBody LogoutRequest req, HttpServletRequest sreq, HttpServletResponse sres,
            HttpSession session) {
        return callProc.run("logout", true, false, req, session, ms -> {
            return user.logout(session);
        });
    }

    @RequestMapping(value = API_PATH + "/renderCalendar", method = RequestMethod.POST)
    @ResponseBody
    public Object renderCalendarNodes(@RequestBody RenderCalendarRequest req, HttpServletRequest httpReq,
            HttpSession session) {
        return callProc.run("renderCalendar", true, true, req, session, ms -> {
            return render.renderCalendar(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getNodeThreadView", method = RequestMethod.POST)
    @ResponseBody
    public Object getNodeThreadView(@RequestBody GetThreadViewRequest req, HttpSession session) {
        return callProc.run("getNodeThreadView", false, false, req, session, ms -> {
            return friend.getNodeThreadView(ms, req.getNodeId(), req.isLoadOthers());
        });
    }

    @RequestMapping(value = API_PATH + "/getNodeRepliesView", method = RequestMethod.POST)
    @ResponseBody
    public Object getNodeRepliesView(@RequestBody GetThreadViewRequest req, HttpSession session) {
        return callProc.run("getNodeRepliesView", false, false, req, session, ms -> {
            return friend.getNodeReplies(ms, req.getNodeId());
        });
    }

    @RequestMapping(value = API_PATH + "/renderNode", method = RequestMethod.POST)
    @ResponseBody
    public Object renderNode(@RequestBody RenderNodeRequest req, HttpServletRequest httpReq, HttpSession session) {
        return callProc.run("renderNode", false, false, req, session, ms -> {
            return render.renderNode(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getIPFSFiles", method = RequestMethod.POST)
    @ResponseBody
    public Object getIPFSFiles(@RequestBody GetIPFSFilesRequest req, HttpServletRequest httpReq, HttpSession session) {
        checkIpfs();
        return callProc.run("getIPFSFiles", false, false, req, session, ms -> {
            return ipfsFiles.getIPFSFiles(req, ms);
        });
    }

    @RequestMapping(value = API_PATH + "/deleteMFSFile", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteIpfsFile(@RequestBody DeleteMFSFileRequest req, HttpServletRequest httpReq,
            HttpSession session) {
        checkIpfs();
        return callProc.run("deleteMFSFile", false, false, req, session, ms -> {
            return ipfsFiles.deleteMFSFile(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getIPFSContent", method = RequestMethod.POST)
    @ResponseBody
    public Object getIPFSContent(@RequestBody GetIPFSContentRequest req, HttpServletRequest httpReq,
            HttpSession session) {
        checkIpfs();
        return callProc.run("getIPFSContent", false, false, req, session, ms -> {
            return ipfsFiles.getIPFSContent(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/initNodeEdit", method = RequestMethod.POST)
    @ResponseBody
    public Object initNodeEdit(@RequestBody InitNodeEditRequest req, HttpSession session) {
        return callProc.run("initNodeEdit", true, true, req, session, ms -> {
            return edit.initNodeEdit(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getOpenGraph", method = RequestMethod.POST)
    @ResponseBody
    public Object getOpenGraph(@RequestBody GetOpenGraphRequest req, HttpSession session) {
        return callProc.run("getOpenGraph", false, false, req, session, ms -> {
            return openGraph.getOpenGraph(req);
        });
    }

    @RequestMapping(value = API_PATH + "/getSchemaOrgTypes", method = RequestMethod.POST)
    @ResponseBody
    public Object getSchemaOrgTypes(@RequestBody GetSchemaOrgTypesRequest req, HttpSession session) {
        return callProc.run("getSchemaOrgTypes", false, false, req, session, ms -> {
            return schema.getSchemaOrgTypes();
        });
    }

    @RequestMapping(value = API_PATH + "/getNodePrivileges", method = RequestMethod.POST)
    @ResponseBody
    public Object getNodePrivileges(@RequestBody GetNodePrivilegesRequest req, HttpSession session) {
        return callProc.run("getNodePrivileges", true, true, req, session, ms -> {
            return acl.getNodePrivileges(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/addPrivilege", method = RequestMethod.POST)
    @ResponseBody
    public Object addPrivilege(@RequestBody AddPrivilegeRequest req, HttpSession session) {
        return callProc.run("addPrivilege", true, true, req, session, ms -> {
            return acl.addPrivilege(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/setUnpublished", method = RequestMethod.POST)
    @ResponseBody
    public Object setUnpublished(@RequestBody SetUnpublishedRequest req, HttpSession session) {
        return callProc.run("setUnpublished", true, true, req, session, ms -> {
            return acl.setUnpublished(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/copySharing", method = RequestMethod.POST)
    @ResponseBody
    public Object copySharing(@RequestBody CopySharingRequest req, HttpSession session) {
        return callProc.run("copySharing", true, true, req, session, ms -> {
            return acl.copySharing(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/removePrivilege", method = RequestMethod.POST)
    @ResponseBody
    public Object removePrivilege(@RequestBody RemovePrivilegeRequest req, HttpSession session) {
        return callProc.run("removePrivilege", true, true, req, session, ms -> {
            return acl.removePrivilege(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/savePublicKeys", method = RequestMethod.POST)
    @ResponseBody
    public Object savePublicKeys(@RequestBody SavePublicKeyRequest req, HttpSession session) {
        return callProc.run("savePublicKeys", true, false, req, session, ms -> {
            return crypto.savePublicKeys(req);
        });
    }

    @RequestMapping(value = API_PATH + "/setCipherKey", method = RequestMethod.POST)
    @ResponseBody
    public Object setCipherKey(@RequestBody SetCipherKeyRequest req, HttpSession session) {
        return callProc.run("setCipherKey", true, true, req, session, ms -> {
            return acl.setCipherKey(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/export", method = RequestMethod.POST)
    @ResponseBody
    public Object export(@RequestBody ExportRequest req, HttpSession session) {
        return callProc.run("export", true, true, req, session, ms -> {
            return system.export(req, ms);
        });
    }

    @RequestMapping(value = API_PATH + "/subGraphHash", method = RequestMethod.POST)
    @ResponseBody
    public Object subGraphHash(@RequestBody SubGraphHashRequest req, HttpSession session) {
        return callProc.run("subGraphHash", true, true, req, session, ms -> {
            return crypto.subGraphHash(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/transferNode", method = RequestMethod.POST)
    @ResponseBody
    public Object transferNode(@RequestBody TransferNodeRequest req, HttpSession session) {
        return callProc.run("export", true, true, req, session, ms -> {
            return transfer.transferNode(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/searchAndReplace", method = RequestMethod.POST)
    @ResponseBody
    public Object searchAndReplace(@RequestBody SearchAndReplaceRequest req, HttpSession session) {
        return callProc.run("searchAndReplace", true, true, req, session, ms -> {
            return edit.searchAndReplace(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/publishNodeToIpfs", method = RequestMethod.POST)
    @ResponseBody
    public Object publishNodeToIpfs(@RequestBody PublishNodeToIpfsRequest req, HttpSession session) {
        return callProc.run("publishNodeToIpfs", true, true, req, session, ms -> {
            return ipfs.publishNodeToIpfs(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/loadNodeFromIpfs", method = RequestMethod.POST)
    @ResponseBody
    public Object loadNodeFromIpfs(@RequestBody LoadNodeFromIpfsRequest req, HttpSession session) {
        return callProc.run("loadNodeFromIpfs", true, true, req, session, ms -> {
            return ipfs.loadNodeFromIpfs(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/streamImport", method = RequestMethod.POST)
    @ResponseBody
    public Object streamImport(@RequestParam(value = "nodeId", required = true) String nodeId,
            @RequestParam(value = "files", required = true) MultipartFile[] uploadFiles, HttpSession session) {
        return callProc.run("streamImport", true, true, null, session, ms -> {
            return importService.streamImport(ms, nodeId, uploadFiles);
        });
    }

    @RequestMapping(value = API_PATH + "/setNodePosition", method = RequestMethod.POST)
    @ResponseBody
    public Object setNodePosition(@RequestBody SetNodePositionRequest req, HttpSession session) {
        return callProc.run("setNodePosition", true, true, req, session, ms -> {
            return move.setNodePosition(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/createSubNode", method = RequestMethod.POST)
    @ResponseBody
    public Object createSubNode(@RequestBody CreateSubNodeRequest req, HttpSession session) {
        return callProc.run("createSubNode", true, true, req, session, ms -> {
            return create.createSubNode(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/insertNode", method = RequestMethod.POST)
    @ResponseBody
    public Object insertNode(@RequestBody InsertNodeRequest req, HttpSession session) {
        return callProc.run("insertNode", true, true, req, session, ms -> {
            return create.insertNode(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/deleteNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteNodes(@RequestBody DeleteNodesRequest req, HttpSession session) {
        return callProc.run("deleteNodes", true, true, req, session, ms -> {
            return delete.delete(req, ms);
        });
    }

    @RequestMapping(value = API_PATH + "/joinNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object joinNodes(@RequestBody JoinNodesRequest req, HttpSession session) {
        return callProc.run("joinNodes", true, true, req, session, ms -> {
            return move.joinNodes(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/selectAllNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object selectAllNodes(@RequestBody SelectAllNodesRequest req, HttpSession session) {
        return callProc.run("selectAllNodes", true, true, req, session, ms -> {
            return move.selectAllNodes(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/updateHeadings", method = RequestMethod.POST)
    @ResponseBody
    public Object updateHeadings(@RequestBody UpdateHeadingsRequest req, HttpSession session) {
        return callProc.run("updateHeadings", true, true, req, session, ms -> {
            return edit.updateHeadings(ms, req.getNodeId());
        });
    }

    @RequestMapping(value = API_PATH + "/moveNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object moveNodes(@RequestBody MoveNodesRequest req, HttpSession session) {
        return callProc.run("moveNodes", true, true, req, session, ms -> {
            return move.moveNodes(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/pasteAttachments", method = RequestMethod.POST)
    @ResponseBody
    public Object moveNodes(@RequestBody PasteAttachmentsRequest req, HttpSession session) {
        return callProc.run("pasteAttachments", true, true, req, session, ms -> {
            return attach.pasteAttachments(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/linkNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object linkNodes(@RequestBody LinkNodesRequest req, HttpSession session) {
        return callProc.run("linkNodes", true, true, req, session, ms -> {
            return edit.linkNodes(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/deleteProperties", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteProperties(@RequestBody DeletePropertyRequest req, HttpSession session) {
        return callProc.run("deleteProperties", true, true, req, session, ms -> {
            return delete.deleteProperties(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/updateFriendNode", method = RequestMethod.POST)
    @ResponseBody
    public Object updateFriendNode(@RequestBody UpdateFriendNodeRequest req, HttpSession session) {
        return callProc.run("updateFriendNode", true, true, req, session, ms -> {
            return friend.updateFriendNode(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/saveNode", method = RequestMethod.POST)
    @ResponseBody
    public Object saveNode(@RequestBody SaveNodeRequest req, HttpSession session) {
        return callProc.run("saveNode", true, true, req, session, ms -> {
            return edit.saveNode(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/toggleNodeExpanded", method = RequestMethod.POST)
    @ResponseBody
    public Object toggleNodeExpanded(@RequestBody SetExpandedRequest req, HttpSession session) {
        return callProc.run("toggleNodeExpanded", true, true, req, session, ms -> {
            return edit.toggleExpanded(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/changePassword", method = RequestMethod.POST)
    @ResponseBody
    public Object changePassword(@RequestBody ChangePasswordRequest req, HttpSession session) {
        return callProc.run("changePassword", false, false, req, session, ms -> {
            return user.changePassword(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/resetPassword", method = RequestMethod.POST)
    @ResponseBody
    public Object resetPassword(@RequestBody ResetPasswordRequest req, HttpSession session) {
        return callProc.run("resetPassword", false, false, req, session, ms -> {
            return user.resetPassword(req);
        });
    }

    @PerfMon
    @RequestMapping({FILE_PATH + "/id/{id}", FILE_PATH + "/{nameOnAdminNode}",
            FILE_PATH + "/{userName}/{nameOnUserNode}"})
    public void attachment(
            // node name on 'admin' account. Non-admin named nodes use url
            // "/u/userName/nodeName"
            @PathVariable(value = "nameOnAdminNode", required = false) String nameOnAdminNode,
            @PathVariable(value = "nameOnUserNode", required = false) String nameOnUserNode,
            @PathVariable(value = "userName", required = false) String userName,
            @PathVariable(value = "id", required = false) String id,
            @RequestParam(value = "download", required = false) String download,
            // gid is used ONLY for cache bustring so it can be the IPFS hash -or- the
            // gridId, we don't know or care which it is.
            @RequestParam(value = "gid", required = false) String gid,
            // attachment name for retrieving from a multiple attachment node, and if omitted
            // defaults to "p" (primary)
            @RequestParam(value = "att", required = false) String attName, HttpSession session, HttpServletRequest req,
            HttpServletResponse response) {
        attach.getAttachment(nameOnAdminNode, nameOnUserNode, userName, id, download, gid, attName, req, response);
    }

    @RequestMapping(value = API_PATH + "/bin/{binId}", method = RequestMethod.GET)
    public void getBinary(@PathVariable("binId") String binId,
            @RequestParam(value = "nodeId", required = false) String nodeId,
            /*
             * In the file exports where this is appended, we could have appended just nodeId and it would also
             * work but be a bit slower as that would look up the node rather than streaming straight out of
             * IPFS.
             */
            @RequestParam(value = "cid", required = false) String ipfsCid, //
            /*
             * The "Export To PDF" feature relies on sending this 'token' as it's form of access/auth because
             * it's generated from HTML intermediate file what has all the links in it for accessing binary
             * content, and as the PDF is being generated calls are made to this endpoint for each image, or
             * other file so we use the token to auth the request
             */
            @RequestParam(value = "token", required = false) String token,
            @RequestParam(value = "download", required = false) String download, HttpSession session,
            HttpServletResponse response) {
        attach.getBinary(binId, nodeId, ipfsCid, token, download, session, response);
    }

    /*
     * todo-3: we should return proper HTTP codes when file not found, etc.
     *
     * The ":.+" is there because that is required to stop it from truncating file extension.
     * https://stackoverflow.com/questions/16332092/spring-mvc-pathvariable-with-dot
     * -is-getting-truncated
     */
    @RequestMapping(value = FILE_PATH + "/export/{fileName:.+}", method = RequestMethod.GET)
    public void getFile(@PathVariable("fileName") String fileName,
            @RequestParam(name = "disp", required = false) String disposition,
            @RequestParam(name = "token", required = true) String token, HttpSession session,
            HttpServletResponse response) {
        SessionContext sc = ServiceBase.redis.get(token);
        if (sc == null) {
            throw new RuntimeException("bad token in /f/export/ access: " + token);
        }

        callProc.run("file", false, false, null, session, ms -> {
            attach.getFile(ms, fileName, disposition, response);
            return null;
        });
    }

    /*
     * todo-3: we should return proper HTTP codes when file not found, etc.
     */
    @RequestMapping(value = FILE_PATH + "/export-friends", method = RequestMethod.GET)
    public void exportFriends(@RequestParam(name = "disp", required = false) String disposition,
            @RequestParam(name = "token", required = true) String token, HttpSession session,
            HttpServletResponse response) {
        SessionContext sc = ServiceBase.redis.get(token);
        if (sc == null) {
            throw new RuntimeException("bad token in /f/export-friends/ access: " + token);
        }

        callProc.run("exportFriends", false, false, null, session, ms -> {
            user.exportPeople(ms, response, disposition, NodeType.FRIEND_LIST.s());
            return null;
        });
    }

    /*
     * todo-3: we should return proper HTTP codes when file not found, etc.
     */
    @RequestMapping(value = FILE_PATH + "/export-blocks", method = RequestMethod.GET)
    public void exportBlocks(@RequestParam(name = "disp", required = false) String disposition,
            @RequestParam(name = "token", required = true) String token, HttpSession session,
            HttpServletResponse response) {
        SessionContext sc = ServiceBase.redis.get(token);
        if (sc == null) {
            throw new RuntimeException("bad token in /f/export-blocks/ access: " + token);
        }

        callProc.run("exportBlocks", false, false, null, session, ms -> {
            user.exportPeople(ms, response, disposition, NodeType.BLOCKED_USERS.s());
            return null;
        });
    }

    @PerfMon
    @RequestMapping(value = API_PATH + "/stream/{fileName}", method = RequestMethod.GET)
    public ResponseEntity<ResourceRegion> streamMultiPart(@PathVariable("fileName") String fileName,
            @RequestParam("nodeId") String nodeId, //
            @RequestParam(name = "disp", required = false) final String disp, //
            @RequestParam(name = "att", required = false) final String attName, //
            @RequestHeader HttpHeaders headers, //
            HttpServletRequest request, HttpServletResponse response, HttpSession session) {
        return (ResponseEntity<ResourceRegion>) callProc.run("stream", false, false, null, session, ms -> {
            return attach.getStreamResource(ms, headers, nodeId, attName);
        });
    }

    @RequestMapping(value = API_PATH + "/parseFiles", method = RequestMethod.POST)
    @ResponseBody
    public Object parseFiles(@RequestParam(value = "files", required = true) MultipartFile[] uploadFiles,
            HttpSession session) {
        return callProc.run("parseFiles", true, true, null, session, ms -> {
            return attach.parseUploadFiles(ms, uploadFiles);
        });
    }

    @RequestMapping(value = API_PATH + "/upload", method = RequestMethod.POST)
    @ResponseBody
    public Object upload(@RequestParam(value = "nodeId", required = true) String nodeId,
            @RequestParam(value = "attName", required = false) String attName,
            @RequestParam(value = "explodeZips", required = false) String explodeZips,
            @RequestParam(value = "ipfs", required = false) String ipfs,
            @RequestParam(value = "files", required = true) MultipartFile[] uploadFiles, HttpSession session) {
        final String _attName = attName == null ? "" : attName;
        return callProc.run("upload", true, true, null, session, ms -> {
            return attach.uploadMultipleFiles(ms, _attName, nodeId, uploadFiles, //
                    "true".equalsIgnoreCase(explodeZips), "true".equalsIgnoreCase(ipfs));
        });
    }

    @RequestMapping(value = API_PATH + "/deleteAttachment", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteAttachment(@RequestBody DeleteAttachmentRequest req, HttpSession session) {
        return callProc.run("deleteAttachment", true, true, req, session, ms -> {
            return attach.deleteAttachment(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/aiGenImage", method = RequestMethod.POST)
    @ResponseBody
    public Object aiGenImage(@RequestBody AIGenImageRequest req, HttpSession session) {
        return callProc.run("aiGenImage", true, true, req, session, ms -> {
            return attach.aiGenImage(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/aiGenSpeech", method = RequestMethod.POST)
    @ResponseBody
    public Object aiGenSpeech(@RequestBody AIGenSpeechRequest req, HttpSession session) {
        return callProc.run("aiGenSpeech", true, true, req, session, ms -> {
            return attach.aiGenSpeech(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/uploadFromUrl", method = RequestMethod.POST)
    @ResponseBody
    public Object uploadFromUrl(@RequestBody UploadFromUrlRequest req, HttpSession session) {
        return callProc.run("uploadFromUrl", true, true, req, session, ms -> {
            return attach.readFromUrl(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/uploadFromIPFS", method = RequestMethod.POST)
    @ResponseBody
    public Object uploadFromIPFS(@RequestBody UploadFromIPFSRequest req, HttpSession session) {
        return callProc.run("uploadFromIPFS", true, true, req, session, ms -> {
            return attach.attachFromIPFS(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/anonPageLoad", method = RequestMethod.POST)
    @ResponseBody
    public Object anonPageLoad(@RequestBody RenderNodeRequest req, HttpSession session) {
        return callProc.run("anonPageLoad", false, false, req, session, ms -> {
            return render.anonPageLoad(null, req);
        });
    }

    @RequestMapping(value = API_PATH + "/nodeSearch", method = RequestMethod.POST)
    @ResponseBody
    public Object nodeSearch(@RequestBody NodeSearchRequest req, HttpSession session) {
        return callProc.run("nodeSearch", false, false, req, session, ms -> {
            return search.search(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/renderDocument", method = RequestMethod.POST)
    @ResponseBody
    public Object renderDocument(@RequestBody RenderDocumentRequest req, HttpSession session) {
        return callProc.run("renderDocument", false, false, req, session, ms -> {
            return search.renderDocument(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/askSubGraph", method = RequestMethod.POST)
    @ResponseBody
    public Object askSubGraph(@RequestBody AskSubGraphRequest req, HttpSession session) {
        return callProc.run("askSubGraph", false, false, req, session, ms -> {
            return oai.askSubGraph(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getFollowers", method = RequestMethod.POST)
    @ResponseBody
    public Object getFollowers(@RequestBody GetFollowersRequest req, HttpSession session) {
        return callProc.run("getFollowers", false, false, req, session, ms -> {
            return friend.getFollowers(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getFollowing", method = RequestMethod.POST)
    @ResponseBody
    public Object getFollowing(@RequestBody GetFollowingRequest req, HttpSession session) {
        return callProc.run("getFollowing", false, false, req, session, ms -> {
            return friend.getFollowing(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/nodeFeed", method = RequestMethod.POST)
    @ResponseBody
    public Object nodeFeed(@RequestBody NodeFeedRequest req, HttpSession session) {
        return callProc.run("nodeFeed", false, false, req, session, ms -> {
            return userFeed.generateFeed(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/checkMessages", method = RequestMethod.POST)
    @ResponseBody
    public Object checkMessages(@RequestBody CheckMessagesRequest req, HttpSession session) {
        return callProc.run("checkMessages", true, true, req, session, ms -> {
            return userFeed.checkMessages(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getSharedNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object getSharedNodes(@RequestBody GetSharedNodesRequest req, HttpSession session) {
        return callProc.run("getSharedNodes", false, false, req, session, ms -> {
            return search.getSharedNodes(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/saveUserPreferences", method = RequestMethod.POST)
    @ResponseBody
    public Object saveUserPreferences(@RequestBody SaveUserPreferencesRequest req, HttpSession session) {
        return callProc.run("saveUserPreferences", true, true, req, session, ms -> {
            return user.saveUserPreferences(req);
        });
    }

    @RequestMapping(value = API_PATH + "/deleteUserTransactions", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteUserTransactions(@RequestBody DeleteUserTransactionsRequest req, HttpSession session) {
        return callProc.run("deleteUserTransactions", true, true, req, session, ms -> {
            return user.deleteUserTransactions(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/addCredit", method = RequestMethod.POST)
    @ResponseBody
    public Object addCredit(@RequestBody AddCreditRequest req, HttpSession session) {
        return callProc.run("addCredit", true, true, req, session, ms -> {
            return user.addCredit(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getUserProfile", method = RequestMethod.POST)
    @ResponseBody
    public Object getUserProfile(@RequestBody GetUserProfileRequest req, HttpSession session) {
        return callProc.run("getUserProfile", false, false, req, session, ms -> {
            return user.getUserProfile(req);
        });
    }

    @RequestMapping(value = API_PATH + "/saveUserProfile", method = RequestMethod.POST)
    @ResponseBody
    public Object saveUserProfile(@RequestBody SaveUserProfileRequest req, HttpSession session) {
        return callProc.run("saveUserProfile", true, true, req, session, ms -> {
            return user.saveUserProfile(req);
        });
    }

    @RequestMapping(value = API_PATH + "/addFriend", method = RequestMethod.POST)
    @ResponseBody
    public Object addFriend(@RequestBody AddFriendRequest req, HttpSession session) {
        return callProc.run("addFriend", true, true, req, session, ms -> {
            return friend.addFriend(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/deleteFriend", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteFriend(@RequestBody DeleteFriendRequest req, HttpSession session) {
        return callProc.run("deleteFriend", true, true, req, session, ms -> {
            return friend.deleteFriend(ms, req.getUserNodeId(), NodeType.FRIEND_LIST.s());
        });
    }

    @RequestMapping(value = API_PATH + "/blockUser", method = RequestMethod.POST)
    @ResponseBody
    public Object blockUser(@RequestBody BlockUserRequest req, HttpSession session) {
        return callProc.run("blockUser", true, true, req, session, ms -> {
            return user.blockUsers(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/unblockUser", method = RequestMethod.POST)
    @ResponseBody
    public Object unblockUser(@RequestBody DeleteFriendRequest req, HttpSession session) {
        return callProc.run("unblockUser", true, true, req, session, ms -> {
            return friend.deleteFriend(ms, req.getUserNodeId(), NodeType.BLOCKED_USERS.s());
        });
    }

    @RequestMapping(value = API_PATH + "/getUserAccountInfo", method = RequestMethod.POST)
    @ResponseBody
    public Object getUserAccountInfo(@RequestBody GetUserAccountInfoRequest req, HttpSession session) {
        return callProc.run("getUserAcccountInfo", false, false, req, session, ms -> {
            return user.getUserAccountInfo(req);
        });
    }

    @RequestMapping(value = API_PATH + "/getBookmarks", method = RequestMethod.POST)
    @ResponseBody
    public Object getBookmarks(@RequestBody GetBookmarksRequest req, HttpSession session) {
        return callProc.run("getBookmarks", true, true, req, session, ms -> {
            return search.getBookmarks(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/signNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object signNodes(@RequestBody SignNodesRequest req, HttpSession session) {
        return callProc.run("signNodes", true, true, req, session, ms -> {
            return crypto.signNodes(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/signSubGraph", method = RequestMethod.POST)
    @ResponseBody
    public Object signSubGraph(@RequestBody SignSubGraphRequest req, HttpSession session) {
        return callProc.run("signSubGraph", true, true, req, session, ms -> {
            return crypto.signSubGraph(req, ms);
        });
    }

    @RequestMapping(value = API_PATH + "/removeSignatures", method = RequestMethod.POST)
    @ResponseBody
    public Object removeSignatures(@RequestBody RemoveSignaturesRequest req, HttpSession session) {
        return callProc.run("removeSignatures", false, false, req, session, ms -> {
            return crypto.removeSignatures(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getNodeStats", method = RequestMethod.POST)
    @ResponseBody
    public Object getNodeStats(@RequestBody GetNodeStatsRequest req, HttpSession session) {
        return callProc.run("getNodeStats", false, false, req, session, ms -> {
            return search.getNodeStats(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getNodeJson", method = RequestMethod.POST)
    @ResponseBody
    public Object getNodeJson(@RequestBody GetNodeJsonRequest req, HttpSession session) {
        return callProc.run("getNodeJson", false, false, req, session, ms -> {
            return edit.getNodeJson(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/saveNodeJson", method = RequestMethod.POST)
    @ResponseBody
    public Object saveNodeJson(@RequestBody SaveNodeJsonRequest req, HttpSession session) {
        return callProc.run("SaveNodeJson", false, false, req, session, ms -> {
            return edit.saveNodeJson(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/getServerInfo", method = RequestMethod.POST)
    @ResponseBody
    public Object getServerInfo(@RequestBody GetServerInfoRequest req, HttpSession session) {
        return callProc.run("getServerInfo", true, true, req, session, ms -> {
            return system.getServerInfo(req, ms);
        });
    }

    @RequestMapping(value = API_PATH + "/graphNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object graphNodes(@RequestBody GraphRequest req, HttpSession session) {
        return callProc.run("graphNodes", true, true, req, session, ms -> {
            return graphNodes.graphNodes(ms, req);
        });
    }

    @RequestMapping(value = API_PATH + "/luceneIndex", method = RequestMethod.POST)
    @ResponseBody
    public Object luceneIndex(@RequestBody LuceneIndexRequest req, HttpSession session) {
        return callProc.run("luceneIndex", true, true, req, session, ms -> {
            return lucene.reindex(ms, req.getNodeId(), req.getPath());
        });
    }

    @RequestMapping(value = API_PATH + "/luceneSearch", method = RequestMethod.POST)
    @ResponseBody
    public Object luceneSearch(@RequestBody LuceneSearchRequest req, HttpSession session) {
        return callProc.run("luceneSearch", true, true, req, session, ms -> {
            return lucene.search(ms, req.getNodeId(), req.getText());
        });
    }

    @RequestMapping(value = "/health", method = RequestMethod.GET, produces = MediaType.TEXT_PLAIN_VALUE)
    @ResponseBody
    public String health() {
        return system.getHealth();
    }

    @RequestMapping(value = API_PATH + "/ping", method = RequestMethod.POST)
    @ResponseBody
    public Object ping(@RequestBody PingRequest req, HttpSession session) {
        return callProc.run("ping", false, false, req, session, ms -> {
            return system.ping();
        });
    }

    @RequestMapping(value = API_PATH + "/sendTestEmail", method = RequestMethod.POST)
    @ResponseBody
    public Object sendTestEmail(@RequestBody SendTestEmailRequest req, HttpSession session) {
        return callProc.run("sendTestEmail", true, true, req, session, ms -> {
            return system.sendTestEmail();
        });
    }

    @RequestMapping(value = API_PATH + "/sendLogText", method = RequestMethod.POST)
    @ResponseBody
    public Object sendLogText(@RequestBody SendLogTextRequest req, HttpSession session) {
        return callProc.run("sendLogText", true, true, req, session, ms -> {
            return system.sendLogText(req);
        });
    }

    @RequestMapping(value = API_PATH + "/splitNode", method = RequestMethod.POST)
    @ResponseBody
    public Object splitNode(@RequestBody SplitNodeRequest req, HttpSession session) {
        return callProc.run("splitNode", true, true, req, session, ms -> {
            return edit.splitNode(ms, req);
        });
    }

    @GetMapping(API_PATH + "/serverPush/{token}")
    public SseEmitter serverPush(@PathVariable(value = "token", required = true) String token, //
            HttpSession session) {
        return system.serverPush(token);
    }

    @RequestMapping(value = API_PATH + "/captcha", method = RequestMethod.GET, produces = MediaType.IMAGE_GIF_VALUE)
    @ResponseBody
    public byte[] captcha(HttpSession session) {
        return (byte[]) callProc.run("captcha", false, false, null, session, ms -> {
            return CaptchaMaker.getCaptcha();
        });
    }

    /*
     * This was sort of experimental, but I need to document how it works and put in the User Guide
     */
    // #rss-disable todo-2: rss feeds disabled for now (need to figure out how to format)
    // @GetMapping(value = {"/rss"}, produces = MediaType.APPLICATION_RSS_XML_VALUE)
    // public void getRss(@RequestParam(value = "id", required = true) String nodeId, //
    // HttpServletResponse response, //
    // HttpSession session) {
    // callProc.run("rss", false, false, null, session, ms -> {
    // arun.run(as -> {
    // try {
    // rssFeed.getRssFeed(as, nodeId, response.getWriter());
    // } catch (Exception e) {
    // throw new RuntimeException("internal server error");
    // }
    // return null;
    // });
    // return null;
    // });
    // }

    /*
     * NOTE: this rest endpoint has -xxx appended so it never gets called, however for efficient
     * streaming of content for 'non-seekable' media, this works perfectly, but i'm using the
     * getFileSystemResourceStreamMultiPart call below instead which DOES support seeking, which means
     * very large video files can be played
     *
     * I never tried this: so what I'm doing here CAN be done simpler if this following snippet will
     * have worked:
     *
     * @RequestMapping(method = RequestMethod.GET, value = "/testVideo")
     *
     * @ResponseBody public FileSystemResource testVideo(Principal principal) throws IOException {
     * return new FileSystemResource(new File("D:\\oceans.mp4")); } however, the above snipped might not
     * be as powerful/flexible as what i have implemented since my solution can be modified easier at a
     * lower level if we ever need to.
     *
     * <pre> https://dzone.com/articles/writing-download-server-part-i
     * https://www.logicbig.com/tutorials/spring-framework/spring-web-mvc/streaming- response-body.html
     * https://stackoverflow.com/questions/38957245/spring-mvc-streamingresponsebody
     * -return-chunked-file </pre>
     */

    // todo-2: disabled for now. Needs accepted path (by AppFilter) and token
    // @RequestMapping(value = "/filesys-xxx/{nodeId}", method = RequestMethod.GET)
    // public Object getFileSystemResourceStream(@PathVariable("nodeId") String nodeId,
    // @RequestParam(name = "disp", required = false) String disposition, HttpSession session) {
    // return callProc.run("filesys", false, false, null, session, ms -> {
    // // return attachmentService.getFileSystemResourceStream(ms, nodeId,
    // // disposition);
    // return null;
    // });
    // }

    ///////////////////////////////////////////////
    // @GetMapping("/videos/{name}/full")
    // public ResponseEntity<UrlResource> getFullVideo(@PathVariable String name) throws
    /////////////////////////////////////////////// MalformedURLException {
    // UrlResource video = new UrlResource("file:${video.location}/${name}");
    // return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
    // .contentType(MediaTypeFactory.getMediaType(video).orElse(MediaType.APPLICATION_OCTET_STREAM))
    // .body(video);
    // }
}
