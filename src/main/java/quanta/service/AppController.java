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
import quanta.model.client.NodeType;
import quanta.rest.request.AddCreditRequest;
import quanta.rest.request.AddFriendRequest;
import quanta.rest.request.AddPrivilegeRequest;
import quanta.rest.request.AskSubGraphRequest;
import quanta.rest.request.BlockUserRequest;
import quanta.rest.request.ChangePasswordRequest;
import quanta.rest.request.CheckMessagesRequest;
import quanta.rest.request.CloseAccountRequest;
import quanta.rest.request.CopySharingRequest;
import quanta.rest.request.CreateSubNodeRequest;
import quanta.rest.request.DeleteAttachmentRequest;
import quanta.rest.request.DeleteFriendRequest;
import quanta.rest.request.DeleteNodesRequest;
import quanta.rest.request.DeletePropertyRequest;
import quanta.rest.request.DeleteSearchDefRequest;
import quanta.rest.request.DeleteUserTransactionsRequest;
import quanta.rest.request.ExportRequest;
import quanta.rest.request.GenerateBookByAIRequest;
import quanta.rest.request.GetBookmarksRequest;
import quanta.rest.request.GetFollowersRequest;
import quanta.rest.request.GetFollowingRequest;
import quanta.rest.request.GetMultiRssRequest;
import quanta.rest.request.GetNodeJsonRequest;
import quanta.rest.request.GetNodePrivilegesRequest;
import quanta.rest.request.GetNodeStatsRequest;
import quanta.rest.request.GetOpenGraphRequest;
import quanta.rest.request.GetPeopleRequest;
import quanta.rest.request.GetSchemaOrgTypesRequest;
import quanta.rest.request.GetSearchDefsRequest;
import quanta.rest.request.GetServerInfoRequest;
import quanta.rest.request.GetSharedNodesRequest;
import quanta.rest.request.GetThreadViewRequest;
import quanta.rest.request.GetUserAccountInfoRequest;
import quanta.rest.request.GetUserProfileRequest;
import quanta.rest.request.GraphRequest;
import quanta.rest.request.ImportJsonRequest;
import quanta.rest.request.InitNodeEditRequest;
import quanta.rest.request.InsertNodeRequest;
import quanta.rest.request.JoinNodesRequest;
import quanta.rest.request.LikeNodeRequest;
import quanta.rest.request.LinkNodesRequest;
import quanta.rest.request.LoginRequest;
import quanta.rest.request.LogoutRequest;
import quanta.rest.request.ModifySubGraphRequest;
import quanta.rest.request.MoveNodesRequest;
import quanta.rest.request.NodeFeedRequest;
import quanta.rest.request.NodeSearchRequest;
import quanta.rest.request.PasteAttachmentsRequest;
import quanta.rest.request.PingRequest;
import quanta.rest.request.RePublishWebsiteRequest;
import quanta.rest.request.RemovePrivilegeRequest;
import quanta.rest.request.RenderCalendarRequest;
import quanta.rest.request.RenderDocumentRequest;
import quanta.rest.request.RenderNodeRequest;
import quanta.rest.request.ResetPasswordRequest;
import quanta.rest.request.SaveNodeJsonRequest;
import quanta.rest.request.SaveNodeRequest;
import quanta.rest.request.SavePublicKeyRequest;
import quanta.rest.request.SaveUserPreferencesRequest;
import quanta.rest.request.SaveUserProfileRequest;
import quanta.rest.request.SearchAndReplaceRequest;
import quanta.rest.request.SelectAllNodesRequest;
import quanta.rest.request.SendFeedbackRequest;
import quanta.rest.request.SendLogTextRequest;
import quanta.rest.request.SendTestEmailRequest;
import quanta.rest.request.SetCipherKeyRequest;
import quanta.rest.request.SetExpandedRequest;
import quanta.rest.request.SetNodePositionRequest;
import quanta.rest.request.SetSharingOptionRequest;
import quanta.rest.request.SignupRequest;
import quanta.rest.request.SplitNodeRequest;
import quanta.rest.request.SubGraphHashRequest;
import quanta.rest.request.TransferNodeRequest;
import quanta.rest.request.UpdateFriendNodeRequest;
import quanta.rest.request.UpdateHeadingsRequest;
import quanta.rest.request.UploadFromUrlRequest;
import quanta.rest.response.LogoutResponse;
import quanta.rest.response.RePublishWebsiteResponse;
import quanta.util.CaptchaMaker;
import quanta.util.TL;

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
    public static final String PUBLICATION_PATH = "/pub";

    // NOTE: server.error.path app property points to this.
    private static final String ERROR_MAPPING = "/error";

    @RequestMapping(ERROR_MAPPING)
    public String error(Model model) {
        model.addAttribute("hostAndPort", svc_prop.getHostAndPort());
        model.addAllAttributes(svc_render.getThymeleafAttribs());
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
    @RequestMapping({"/", "/n/{nameOnAdminNode}", "/u/{userName}/{nameOnUserNode}"})
    public String index( //
            // =======================================================================================
            // PATH PARAMS
            // node name on 'admin' account. Non-admin named nodes use url
            // "/u/userName/nodeName"
            @PathVariable(value = "nameOnAdminNode", required = false) String nameOnAdminNode, //
            @PathVariable(value = "nameOnUserNode", required = false) String nameOnUserNode, //
            @PathVariable(value = "userName", required = false) String userName, //
            //
            // =======================================================================================
            // REQUEST PARAMS
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
        return svc_render.cm_getIndexPage(nameOnAdminNode, nameOnUserNode, userName, id, search, name, signupCode,
                login, view, model);
    }

    @RequestMapping(value = API_PATH + "/getMultiRssFeed", method = RequestMethod.POST)
    @ResponseBody
    public Object getMultiRssFeed(@RequestBody GetMultiRssRequest req, HttpSession session) {
        return svc_callProc.run("getMultiRssFeed", false, req, session, () -> svc_rssFeed.cm_getMultiRssFeed(req));
    }

    @RequestMapping(value = API_PATH + "/signup", method = RequestMethod.POST)
    @ResponseBody
    public Object signup(@RequestBody SignupRequest req, HttpSession session) {
        return svc_callProc.run("signup", false, req, session, () -> {
            boolean automated = TL.getSC().isAdmin() && "adminCreatingUser".equals(req.getCaptcha());
            return svc_mongoTrans.cm_signup(req, automated);
        });
    }

    @RequestMapping(value = API_PATH + "/login", method = RequestMethod.POST)
    @ResponseBody
    public Object login(@RequestBody LoginRequest req, HttpServletRequest httpReq, HttpSession session) {
        return svc_callProc.run("login", false, req, session, () -> svc_mongoTrans.cm_login(httpReq, req));
    }

    @RequestMapping(value = API_PATH + "/closeAccount", method = RequestMethod.POST)
    @ResponseBody
    public Object closeAccount(@RequestBody CloseAccountRequest req, HttpSession session) {
        return svc_callProc.run("closeAccount", true, req, session, () -> svc_mongoTrans.cm_closeAccount(req, session));
    }

    @RequestMapping(value = API_PATH + "/logout", method = RequestMethod.POST)
    @ResponseBody
    public Object logout(@RequestBody LogoutRequest req, HttpServletRequest sreq, HttpServletResponse sres,
            HttpSession session) {
        return svc_callProc.run("logout", true, req, session, () -> {
            // run async and return immediately
            svc_async.run(() -> {
                // Note: We intentionally call this outside the context of any transaction
                svc_user.logout(session);
            });
            return new LogoutResponse();
        });
    }

    @RequestMapping(value = API_PATH + "/renderCalendar", method = RequestMethod.POST)
    @ResponseBody
    public Object renderCalendarNodes(@RequestBody RenderCalendarRequest req, HttpServletRequest httpReq,
            HttpSession session) {
        return svc_callProc.run("renderCalendar", true, req, session, () -> svc_render.cm_renderCalendar(req));
    }

    @RequestMapping(value = API_PATH + "/likeNode", method = RequestMethod.POST)
    @ResponseBody
    public Object likeNode(@RequestBody LikeNodeRequest req, //
            HttpServletRequest httpReq, HttpSession session) {
        return svc_callProc.run("likeNode", false, req, session, () -> svc_mongoTrans.cm_likeNode(req));
    }

    @RequestMapping(value = API_PATH + "/getNodeThreadView", method = RequestMethod.POST)
    @ResponseBody
    public Object getNodeThreadView(@RequestBody GetThreadViewRequest req, HttpSession session) {
        return svc_callProc.run("getNodeThreadView", false, req, session,
                () -> svc_friend.cm_getNodeThreadView(req.getNodeId(), req.isLoadOthers()));
    }

    @RequestMapping(value = API_PATH + "/getNodeRepliesView", method = RequestMethod.POST)
    @ResponseBody
    public Object getNodeRepliesView(@RequestBody GetThreadViewRequest req, HttpSession session) {
        return svc_callProc.run("getNodeRepliesView", false, req, session,
                () -> svc_friend.cm_getNodeReplies(req.getNodeId()));
    }

    @RequestMapping(value = API_PATH + "/renderNode", method = RequestMethod.POST)
    @ResponseBody
    public Object renderNode(@RequestBody RenderNodeRequest req, HttpServletRequest httpReq, HttpSession session) {
        return svc_callProc.run("renderNode", false, req, session, () -> svc_render.cm_renderNode(req));
    }

    @RequestMapping(value = API_PATH + "/initNodeEdit", method = RequestMethod.POST)
    @ResponseBody
    public Object initNodeEdit(@RequestBody InitNodeEditRequest req, HttpSession session) {
        return svc_callProc.run("initNodeEdit", true, req, session, () -> svc_edit.cm_initNodeEdit(req));
    }

    /*
     * This method is no longer used in the normal flow of things, because the 'saveNode' method has the
     * logic to detect URLs and load them into the node itself, so the node will have the entire
     * OpenGraph response in it immediately once saved, and the client uses it directly
     */
    @RequestMapping(value = API_PATH + "/getOpenGraph", method = RequestMethod.POST)
    @ResponseBody
    public Object getOpenGraph(@RequestBody GetOpenGraphRequest req, HttpSession session) {
        return svc_callProc.run("getOpenGraph", false, req, session, () -> svc_openGraph.cm_getOpenGraph(req));
    }

    @RequestMapping(value = API_PATH + "/getSchemaOrgTypes", method = RequestMethod.POST)
    @ResponseBody
    public Object getSchemaOrgTypes(@RequestBody GetSchemaOrgTypesRequest req, HttpSession session) {
        return svc_callProc.run("getSchemaOrgTypes", false, req, session, () -> svc_schema.cm_getSchemaOrgTypes());
    }

    @RequestMapping(value = API_PATH + "/getNodePrivileges", method = RequestMethod.POST)
    @ResponseBody
    public Object getNodePrivileges(@RequestBody GetNodePrivilegesRequest req, HttpSession session) {
        return svc_callProc.run("getNodePrivileges", true, req, session, () -> svc_acl.cm_getNodePrivileges(req));
    }

    @RequestMapping(value = API_PATH + "/getPeople", method = RequestMethod.POST)
    @ResponseBody
    public Object getPeople(@RequestBody GetPeopleRequest req, HttpSession session) {
        return svc_callProc.run("getPeople", false, req, session, () -> svc_user.cm_getPeople(req));
    }

    @RequestMapping(value = API_PATH + "/addPrivilege", method = RequestMethod.POST)
    @ResponseBody
    public Object addPrivilege(@RequestBody AddPrivilegeRequest req, HttpSession session) {
        return svc_callProc.run("addPrivilege", true, req, session, () -> svc_mongoTrans.cm_addPrivilege(req));
    }

    @RequestMapping(value = API_PATH + "/setSharingOption", method = RequestMethod.POST)
    @ResponseBody
    public Object setSharingOption(@RequestBody SetSharingOptionRequest req, HttpSession session) {
        return svc_callProc.run("setSharingOption", true, req, session, () -> svc_mongoTrans.cm_setSharingOption(req));
    }

    @RequestMapping(value = API_PATH + "/copySharing", method = RequestMethod.POST)
    @ResponseBody
    public Object copySharing(@RequestBody CopySharingRequest req, HttpSession session) {
        return svc_callProc.run("copySharing", true, req, session, () -> svc_mongoTrans.cm_copySharing(req));
    }

    @RequestMapping(value = API_PATH + "/removePrivilege", method = RequestMethod.POST)
    @ResponseBody
    public Object removePrivilege(@RequestBody RemovePrivilegeRequest req, HttpSession session) {
        return svc_callProc.run("removePrivilege", true, req, session, () -> svc_mongoTrans.cm_removePrivilege(req));
    }

    @RequestMapping(value = API_PATH + "/savePublicKeys", method = RequestMethod.POST)
    @ResponseBody
    public Object savePublicKeys(@RequestBody SavePublicKeyRequest req, HttpSession session) {
        return svc_callProc.run("savePublicKeys", true, req, session, () -> svc_crypto.cm_savePublicKeys(req));
    }

    @RequestMapping(value = API_PATH + "/setCipherKey", method = RequestMethod.POST)
    @ResponseBody
    public Object setCipherKey(@RequestBody SetCipherKeyRequest req, HttpSession session) {
        return svc_callProc.run("setCipherKey", true, req, session, () -> svc_acl.cm_setCipherKey(req));
    }

    @RequestMapping(value = API_PATH + "/export", method = RequestMethod.POST)
    @ResponseBody
    public Object export(@RequestBody ExportRequest req, HttpSession session) {
        return svc_callProc.run("export", true, req, session, () -> svc_system.cm_export(req));
    }

    @RequestMapping(value = API_PATH + "/subGraphHash", method = RequestMethod.POST)
    @ResponseBody
    public Object subGraphHash(@RequestBody SubGraphHashRequest req, HttpSession session) {
        return svc_callProc.run("subGraphHash", true, req, session, () -> svc_crypto.cm_subGraphHash(req));
    }

    @RequestMapping(value = API_PATH + "/transferNode", method = RequestMethod.POST)
    @ResponseBody
    public Object transferNode(@RequestBody TransferNodeRequest req, HttpSession session) {
        return svc_callProc.run("export", true, req, session, () -> svc_mongoTrans.cm_transferNode(req));
    }

    @RequestMapping(value = API_PATH + "/searchAndReplace", method = RequestMethod.POST)
    @ResponseBody
    public Object searchAndReplace(@RequestBody SearchAndReplaceRequest req, HttpSession session) {
        return svc_callProc.run("searchAndReplace", true, req, session, () -> svc_mongoTrans.cm_searchAndReplace(req));
    }

    @RequestMapping(value = API_PATH + "/modifySubGraph", method = RequestMethod.POST)
    @ResponseBody
    public Object modifySubGraph(@RequestBody ModifySubGraphRequest req, HttpSession session) {
        return svc_callProc.run("modifySubGraph", true, req, session, () -> svc_mongoTrans.cm_modifySubGraph(req));
    }

    @RequestMapping(value = API_PATH + "/streamImport", method = RequestMethod.POST)
    @ResponseBody
    public Object streamImport(@RequestParam(value = "nodeId", required = true) String nodeId,
            @RequestParam(value = "files", required = true) MultipartFile[] uploadFiles, HttpSession session) {
        return svc_callProc.run("streamImport", true, null, session,
                () -> svc_mongoTrans.cm_streamImport(nodeId, uploadFiles));
    }

    @RequestMapping(value = API_PATH + "/setNodePosition", method = RequestMethod.POST)
    @ResponseBody
    public Object setNodePosition(@RequestBody SetNodePositionRequest req, HttpSession session) {
        return svc_callProc.run("setNodePosition", true, req, session, () -> svc_mongoTrans.cm_setNodePosition(req));
    }

    @RequestMapping(value = API_PATH + "/createSubNode", method = RequestMethod.POST)
    @ResponseBody
    public Object createSubNode(@RequestBody CreateSubNodeRequest req, HttpSession session) {
        return svc_callProc.run("createSubNode", true, req, session, () -> svc_mongoCreate.cm_createSubNode(req));
    }

    @RequestMapping(value = API_PATH + "/insertNode", method = RequestMethod.POST)
    @ResponseBody
    public Object insertNode(@RequestBody InsertNodeRequest req, HttpSession session) {
        return svc_callProc.run("insertNode", true, req, session, () -> svc_mongoCreate.cm_insertNode(req));
    }

    @RequestMapping(value = API_PATH + "/deleteNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteNodes(@RequestBody DeleteNodesRequest req, HttpSession session) {
        return svc_callProc.run("deleteNodes", true, req, session, () -> svc_mongoDelete.cm_delete(req));
    }

    @RequestMapping(value = API_PATH + "/joinNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object joinNodes(@RequestBody JoinNodesRequest req, HttpSession session) {
        return svc_callProc.run("joinNodes", true, req, session, () -> svc_move.cm_joinNodes(req));
    }

    @RequestMapping(value = API_PATH + "/selectAllNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object selectAllNodes(@RequestBody SelectAllNodesRequest req, HttpSession session) {
        return svc_callProc.run("selectAllNodes", true, req, session, () -> svc_move.cm_selectAllNodes(req));
    }

    @RequestMapping(value = API_PATH + "/updateHeadings", method = RequestMethod.POST)
    @ResponseBody
    public Object updateHeadings(@RequestBody UpdateHeadingsRequest req, HttpSession session) {
        return svc_callProc.run("updateHeadings", true, req, session,
                () -> svc_edit.cm_updateHeadings(req.getNodeId()));
    }

    @RequestMapping(value = API_PATH + "/moveNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object moveNodes(@RequestBody MoveNodesRequest req, HttpSession session) {
        return svc_callProc.run("moveNodes", true, req, session, () -> svc_move.moveNodes(req));
    }

    @RequestMapping(value = API_PATH + "/pasteAttachments", method = RequestMethod.POST)
    @ResponseBody
    public Object moveNodes(@RequestBody PasteAttachmentsRequest req, HttpSession session) {
        return svc_callProc.run("pasteAttachments", true, req, session, () -> svc_mongoTrans.cm_pasteAttachments(req));
    }

    @RequestMapping(value = API_PATH + "/linkNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object linkNodes(@RequestBody LinkNodesRequest req, HttpSession session) {
        return svc_callProc.run("linkNodes", true, req, session, () -> svc_edit.cm_linkNodes(req));
    }

    @RequestMapping(value = API_PATH + "/deleteProperties", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteProperties(@RequestBody DeletePropertyRequest req, HttpSession session) {
        return svc_callProc.run("deleteProperties", true, req, session, () -> svc_mongoTrans.cm_deleteProperties(req));
    }

    @RequestMapping(value = API_PATH + "/updateFriendNode", method = RequestMethod.POST)
    @ResponseBody
    public Object updateFriendNode(@RequestBody UpdateFriendNodeRequest req, HttpSession session) {
        return svc_callProc.run("updateFriendNode", true, req, session, () -> svc_friend.cm_updateFriendNode(req));
    }

    @RequestMapping(value = API_PATH + "/saveNode", method = RequestMethod.POST)
    @ResponseBody
    public Object saveNode(@RequestBody SaveNodeRequest req, HttpSession session) {
        // NOTE: We don't call saveNode inside a transaction because only the owner can save the node and
        // so there's no concurrent update risk at all, and also we want this absolutely as fast as possible
        return svc_callProc.run("saveNode", true, req, session, () -> svc_edit.saveNode(req));
    }

    @RequestMapping(value = API_PATH + "/toggleNodeExpanded", method = RequestMethod.POST)
    @ResponseBody
    public Object toggleNodeExpanded(@RequestBody SetExpandedRequest req, HttpSession session) {
        return svc_callProc.run("toggleNodeExpanded", true, req, session, () -> svc_edit.cm_toggleExpanded(req));
    }

    @RequestMapping(value = API_PATH + "/changePassword", method = RequestMethod.POST)
    @ResponseBody
    public Object changePassword(@RequestBody ChangePasswordRequest req, HttpSession session) {
        return svc_callProc.run("changePassword", false, req, session, () -> svc_mongoTrans.cm_changePassword(req));
    }

    @RequestMapping(value = API_PATH + "/resetPassword", method = RequestMethod.POST)
    @ResponseBody
    public Object resetPassword(@RequestBody ResetPasswordRequest req, HttpSession session) {
        return svc_callProc.run("resetPassword", false, req, session, () -> svc_user.cm_resetPassword(req));
    }

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
            // gid is used ONLY for cache busting so it can be the
            // gridId, we don't know or care which it is.
            @RequestParam(value = "gid", required = false) String gid,
            // attachment name for retrieving from a multiple attachment node, and if omitted
            // defaults to "p" (primary)
            @RequestParam(value = "att", required = false) String attName, HttpSession session, HttpServletRequest req,
            HttpServletResponse response) {
        svc_callProc.run("getAttachment", false, null, session, () -> {
            svc_attach.cm_getAttachment(nameOnAdminNode, nameOnUserNode, userName, id, download, gid, attName, req,
                    response);
            return null;
        });
    }

    @RequestMapping(value = API_PATH + "/bin/{binId}", method = RequestMethod.GET)
    public void getBinary(@PathVariable("binId") String binId,
            @RequestParam(value = "nodeId", required = false) String nodeId,
            /*
             * The "Export To PDF" feature relies on sending this 'token' as it's form of access/auth because
             * it's generated from HTML intermediate file what has all the links in it for accessing binary
             * content, and as the PDF is being generated calls are made to this endpoint for each image, or
             * other file so we use the token to auth the request
             */
            @RequestParam(value = "download", required = false) String download, HttpSession session,
            HttpServletResponse response) {
        svc_callProc.run("getBinary", false, null, session, () -> {
            svc_attach.cm_getBinary(binId, nodeId, download, session, response);
            return null;
        });
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
            @RequestParam(name = "disp", required = false) String disposition, HttpSession session,
            HttpServletResponse response) {
        svc_callProc.run("file", false, null, session, () -> {
            svc_attach.cm_getFile(fileName, disposition, response);
            return null;
        });
    }

    @RequestMapping(value = API_PATH + "/rePublishWebsite", method = RequestMethod.POST)
    @ResponseBody
    public Object rePublishWebsite(@RequestBody RePublishWebsiteRequest req, HttpSession session) {
        return svc_callProc.run("rePublishWebsite", false, req, session, () -> {
            svc_publication.getPublication(req.getNodeId(), true, null, null, null, null);
            return new RePublishWebsiteResponse();
        });
    }

    @RequestMapping(value = {PUBLICATION_PATH + "/id/{id}", PUBLICATION_PATH + "/{nameOnAdminNode}",
            PUBLICATION_PATH + "/{userName}/{nameOnUserNode}"}, method = RequestMethod.GET)
    public void getPublication(//
            @PathVariable(value = "nameOnAdminNode", required = false) String nameOnAdminNode,
            @PathVariable(value = "nameOnUserNode", required = false) String nameOnUserNode,
            @PathVariable(value = "userName", required = false) String userName,
            @PathVariable(value = "id", required = false) String id, HttpSession session,
            HttpServletResponse response) {
        svc_callProc.run("getPublication", false, null, session, () -> {
            svc_publication.getPublication(id, false, nameOnAdminNode, nameOnUserNode, userName, response);
            return null;
        });
    }

    /*
     * todo-3: we should return proper HTTP codes when file not found, etc.
     */
    @RequestMapping(value = FILE_PATH + "/export-friends", method = RequestMethod.GET)
    public void exportFriends(@RequestParam(name = "disp", required = false) String disposition, HttpSession session,
            HttpServletResponse response) {
        svc_callProc.run("exportFriends", false, null, session, () -> {
            svc_user.cm_exportPeople(response, disposition, NodeType.FRIEND_LIST.s());
            return null;
        });
    }

    /*
     * todo-3: we should return proper HTTP codes when file not found, etc.
     */
    @RequestMapping(value = FILE_PATH + "/export-blocks", method = RequestMethod.GET)
    public void exportBlocks(@RequestParam(name = "disp", required = false) String disposition, HttpSession session,
            HttpServletResponse response) {
        svc_callProc.run("exportBlocks", false, null, session, () -> {
            svc_user.cm_exportPeople(response, disposition, NodeType.BLOCKED_USERS.s());
            return null;
        });
    }

    @SuppressWarnings("unchecked")
    @RequestMapping(value = API_PATH + "/stream/{fileName}", method = RequestMethod.GET)
    public ResponseEntity<ResourceRegion> streamMultiPart(@PathVariable("fileName") String fileName,
            @RequestParam("nodeId") String nodeId, //
            @RequestParam(name = "disp", required = false) final String disp, //
            @RequestParam(name = "att", required = false) final String attName, //
            @RequestHeader HttpHeaders headers, //
            HttpServletRequest request, HttpServletResponse response, HttpSession session) {
        return (ResponseEntity<ResourceRegion>) svc_callProc.run("stream", false, null, session,
                () -> svc_attach.cm_getStreamResource(headers, nodeId, attName));
    }

    @RequestMapping(value = API_PATH + "/parseFiles", method = RequestMethod.POST)
    @ResponseBody
    public Object parseFiles(@RequestParam(value = "files", required = true) MultipartFile[] uploadFiles,
            HttpSession session) {
        return svc_callProc.run("parseFiles", true, null, session, () -> svc_attach.cm_parseUploadFiles(uploadFiles));
    }

    @RequestMapping(value = API_PATH + "/upload", method = RequestMethod.POST)
    @ResponseBody
    public Object upload(@RequestParam(value = "nodeId", required = true) String nodeId,
            @RequestParam(value = "attName", required = false) String attName,
            @RequestParam(value = "explodeZips", required = false) String explodeZips,
            @RequestParam(value = "files", required = true) MultipartFile[] uploadFiles, HttpSession session) {
        final String _attName = attName == null ? "" : attName;
        return svc_callProc.run("upload", true, null, session,
                () -> svc_mongoTrans.cm_uploadMultipleFiles(_attName, nodeId, uploadFiles, //
                        "true".equalsIgnoreCase(explodeZips)));
    }

    @RequestMapping(value = API_PATH + "/deleteAttachment", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteAttachment(@RequestBody DeleteAttachmentRequest req, HttpSession session) {
        return svc_callProc.run("deleteAttachment", true, req, session, () -> svc_mongoTrans.cm_deleteAttachment(req));
    }

    @RequestMapping(value = API_PATH + "/uploadFromUrl", method = RequestMethod.POST)
    @ResponseBody
    public Object uploadFromUrl(@RequestBody UploadFromUrlRequest req, HttpSession session) {
        return svc_callProc.run("uploadFromUrl", true, req, session, () -> svc_attach.cm_readFromUrl(req));
    }

    @RequestMapping(value = API_PATH + "/anonPageLoad", method = RequestMethod.POST)
    @ResponseBody
    public Object anonPageLoad(@RequestBody RenderNodeRequest req, HttpSession session) {
        return svc_callProc.run("anonPageLoad", false, req, session, () -> svc_render.cm_anonPageLoad(req));
    }

    @RequestMapping(value = API_PATH + "/nodeSearch", method = RequestMethod.POST)
    @ResponseBody
    public Object nodeSearch(@RequestBody NodeSearchRequest req, HttpSession session) {
        return svc_callProc.run("nodeSearch", false, req, session, () -> svc_search.cm_search(req));
    }

    @RequestMapping(value = API_PATH + "/renderDocument", method = RequestMethod.POST)
    @ResponseBody
    public Object renderDocument(@RequestBody RenderDocumentRequest req, HttpSession session) {
        return svc_callProc.run("renderDocument", false, req, session, () -> svc_search.cm_renderDocument(req));
    }

    @RequestMapping(value = API_PATH + "/askSubGraph", method = RequestMethod.POST)
    @ResponseBody
    public Object askSubGraph(@RequestBody AskSubGraphRequest req, HttpSession session) {
        return svc_callProc.run("askSubGraph", false, req, session, () -> svc_aiUtil.cm_askSubGraph(req));
    }

    @RequestMapping(value = API_PATH + "/getFollowers", method = RequestMethod.POST)
    @ResponseBody
    public Object getFollowers(@RequestBody GetFollowersRequest req, HttpSession session) {
        return svc_callProc.run("getFollowers", false, req, session, () -> svc_friend.cm_getFollowers(req));
    }

    @RequestMapping(value = API_PATH + "/getFollowing", method = RequestMethod.POST)
    @ResponseBody
    public Object getFollowing(@RequestBody GetFollowingRequest req, HttpSession session) {
        return svc_callProc.run("getFollowing", false, req, session, () -> svc_friend.cm_getFollowing(req));
    }

    @RequestMapping(value = API_PATH + "/nodeFeed", method = RequestMethod.POST)
    @ResponseBody
    public Object nodeFeed(@RequestBody NodeFeedRequest req, HttpSession session) {
        return svc_callProc.run("nodeFeed", false, req, session, () -> svc_userFeed.cm_generateFeed(req));
    }

    @RequestMapping(value = API_PATH + "/checkMessages", method = RequestMethod.POST)
    @ResponseBody
    public Object checkMessages(@RequestBody CheckMessagesRequest req, HttpSession session) {
        return svc_callProc.run("checkMessages", true, req, session, () -> svc_userFeed.cm_checkMessages(req));
    }

    @RequestMapping(value = API_PATH + "/getSharedNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object getSharedNodes(@RequestBody GetSharedNodesRequest req, HttpSession session) {
        return svc_callProc.run("getSharedNodes", false, req, session, () -> svc_search.cm_getSharedNodes(req));
    }

    @RequestMapping(value = API_PATH + "/saveUserPreferences", method = RequestMethod.POST)
    @ResponseBody
    public Object saveUserPreferences(@RequestBody SaveUserPreferencesRequest req, HttpSession session) {
        return svc_callProc.run("saveUserPreferences", true, req, session, () -> svc_user.cm_saveUserPreferences(req));
    }

    @RequestMapping(value = API_PATH + "/deleteUserTransactions", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteUserTransactions(@RequestBody DeleteUserTransactionsRequest req, HttpSession session) {
        return svc_callProc.run("deleteUserTransactions", true, req, session,
                () -> svc_user.cm_deleteUserTransactions(req));
    }

    @RequestMapping(value = API_PATH + "/addCredit", method = RequestMethod.POST)
    @ResponseBody
    public Object addCredit(@RequestBody AddCreditRequest req, HttpSession session) {
        return svc_callProc.run("addCredit", true, req, session,
                () -> svc_pgTrans.cm_addCredit(req.getUserId(), req.getAmount()));
    }

    @RequestMapping(value = API_PATH + "/getUserProfile", method = RequestMethod.POST)
    @ResponseBody
    public Object getUserProfile(@RequestBody GetUserProfileRequest req, HttpSession session) {
        return svc_callProc.run("getUserProfile", false, req, session, () -> svc_user.cm_getUserProfile(req));
    }

    @RequestMapping(value = API_PATH + "/saveUserProfile", method = RequestMethod.POST)
    @ResponseBody
    public Object saveUserProfile(@RequestBody SaveUserProfileRequest req, HttpSession session) {
        return svc_callProc.run("saveUserProfile", true, req, session, () -> svc_mongoTrans.cm_saveUserProfile(req));
    }

    @RequestMapping(value = API_PATH + "/addFriend", method = RequestMethod.POST)
    @ResponseBody
    public Object addFriend(@RequestBody AddFriendRequest req, HttpSession session) {
        return svc_callProc.run("addFriend", true, req, session, () -> svc_mongoTrans.cm_addFriend(req));
    }

    @RequestMapping(value = API_PATH + "/deleteFriend", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteFriend(@RequestBody DeleteFriendRequest req, HttpSession session) {
        return svc_callProc.run("deleteFriend", true, req, session,
                () -> svc_mongoTrans.cm_deleteFriend(req.getUserNodeId(), NodeType.FRIEND_LIST.s()));
    }

    @RequestMapping(value = API_PATH + "/blockUser", method = RequestMethod.POST)
    @ResponseBody
    public Object blockUser(@RequestBody BlockUserRequest req, HttpSession session) {
        return svc_callProc.run("blockUser", true, req, session, () -> svc_user.cm_blockUsers(req));
    }

    @RequestMapping(value = API_PATH + "/unblockUser", method = RequestMethod.POST)
    @ResponseBody
    public Object unblockUser(@RequestBody DeleteFriendRequest req, HttpSession session) {
        return svc_callProc.run("unblockUser", true, req, session,
                () -> svc_mongoTrans.cm_deleteFriend(req.getUserNodeId(), NodeType.BLOCKED_USERS.s()));
    }

    @RequestMapping(value = API_PATH + "/getUserAccountInfo", method = RequestMethod.POST)
    @ResponseBody
    public Object getUserAccountInfo(@RequestBody GetUserAccountInfoRequest req, HttpSession session) {
        return svc_callProc.run("getUserAcccountInfo", false, req, session, () -> svc_user.cm_getUserAccountInfo(req));
    }

    @RequestMapping(value = API_PATH + "/getBookmarks", method = RequestMethod.POST)
    @ResponseBody
    public Object getBookmarks(@RequestBody GetBookmarksRequest req, HttpSession session) {
        return svc_callProc.run("getBookmarks", true, req, session, () -> svc_search.cm_getBookmarks(req));
    }

    @RequestMapping(value = API_PATH + "/getSearchDefs", method = RequestMethod.POST)
    @ResponseBody
    public Object getSearchDefs(@RequestBody GetSearchDefsRequest req, HttpSession session) {
        return svc_callProc.run("getSearchDefs", true, req, session, () -> svc_search.cm_getSearchDefs(req));
    }

    @RequestMapping(value = API_PATH + "/deleteSearchDef", method = RequestMethod.POST)
    @ResponseBody
    public Object deleteSearchDef(@RequestBody DeleteSearchDefRequest req, HttpSession session) {
        return svc_callProc.run("deleteSearchDef", true, req, session, () -> svc_search.cm_deleteSearchDef(req));
    }

    @RequestMapping(value = API_PATH + "/getNodeStats", method = RequestMethod.POST)
    @ResponseBody
    public Object getNodeStats(@RequestBody GetNodeStatsRequest req, HttpSession session) {
        return svc_callProc.run("getNodeStats", false, req, session, () -> svc_search.cm_getNodeStats(req));
    }

    @RequestMapping(value = API_PATH + "/getNodeJson", method = RequestMethod.POST)
    @ResponseBody
    public Object getNodeJson(@RequestBody GetNodeJsonRequest req, HttpSession session) {
        return svc_callProc.run("getNodeJson", false, req, session, () -> svc_edit.cm_getNodeJson(req));
    }

    @RequestMapping(value = API_PATH + "/saveNodeJson", method = RequestMethod.POST)
    @ResponseBody
    public Object saveNodeJson(@RequestBody SaveNodeJsonRequest req, HttpSession session) {
        return svc_callProc.run("SaveNodeJson", false, req, session, () -> svc_mongoTrans.cm_saveNodeJson(req));
    }

    @RequestMapping(value = API_PATH + "/getServerInfo", method = RequestMethod.POST)
    @ResponseBody
    public Object getServerInfo(@RequestBody GetServerInfoRequest req, HttpSession session) {
        return svc_callProc.run("getServerInfo", true, req, session, () -> svc_system.cm_getServerInfo(req));
    }

    @RequestMapping(value = API_PATH + "/graphNodes", method = RequestMethod.POST)
    @ResponseBody
    public Object graphNodes(@RequestBody GraphRequest req, HttpSession session) {
        return svc_callProc.run("graphNodes", false, req, session, () -> svc_graphNodes.cm_graphNodes(req));
    }

    @RequestMapping(value = "/health", method = RequestMethod.GET, produces = MediaType.TEXT_PLAIN_VALUE)
    @ResponseBody
    public String health() {
        return svc_system.cm_getHealth();
    }

    @RequestMapping(value = API_PATH + "/ping", method = RequestMethod.POST)
    @ResponseBody
    public Object ping(@RequestBody PingRequest req, HttpSession session) {
        return svc_callProc.run("ping", false, req, session, () -> svc_system.cm_ping());
    }

    @RequestMapping(value = API_PATH + "/sendTestEmail", method = RequestMethod.POST)
    @ResponseBody
    public Object sendTestEmail(@RequestBody SendTestEmailRequest req, HttpSession session) {
        return svc_callProc.run("sendTestEmail", true, req, session, () -> svc_system.cm_sendTestEmail());
    }

    @RequestMapping(value = API_PATH + "/sendLogText", method = RequestMethod.POST)
    @ResponseBody
    public Object sendLogText(@RequestBody SendLogTextRequest req, HttpSession session) {
        return svc_callProc.run("sendLogText", true, req, session, () -> svc_system.cm_sendLogText(req));
    }

    @RequestMapping(value = API_PATH + "/importJson", method = RequestMethod.POST)
    @ResponseBody
    public Object importJson(@RequestBody ImportJsonRequest req, HttpSession session) {
        return svc_callProc.run("importJson", true, req, session, () -> svc_mongoTrans.cm_importJson(req));
    }

    @RequestMapping(value = API_PATH + "/generateBookByAI", method = RequestMethod.POST)
    @ResponseBody
    public Object generateBookByAI(@RequestBody GenerateBookByAIRequest req, HttpSession session) {
        return svc_callProc.run("generateBookByAI", true, req, session, () -> svc_aiUtil.cm_generateBookByAI(req));
    }

    @RequestMapping(value = API_PATH + "/sendFeedback", method = RequestMethod.POST)
    @ResponseBody
    public Object sendFeedback(@RequestBody SendFeedbackRequest req, HttpSession session) {
        return svc_callProc.run("sendFeedback", false, req, session, () -> svc_user.cm_sendFeedback(req));
    }

    @RequestMapping(value = API_PATH + "/splitNode", method = RequestMethod.POST)
    @ResponseBody
    public Object splitNode(@RequestBody SplitNodeRequest req, HttpSession session) {
        return svc_callProc.run("splitNode", true, req, session, () -> svc_edit.splitNode(req));
    }

    @GetMapping(API_PATH + "/serverPush/{token}")
    public SseEmitter serverPush(@PathVariable(value = "token", required = true) String token, //
            HttpSession session) {
        return svc_system.cm_serverPush(token);
    }

    @RequestMapping(value = API_PATH + "/captcha", method = RequestMethod.GET, produces = MediaType.IMAGE_GIF_VALUE)
    @ResponseBody
    public byte[] captcha(HttpSession session) {
        return (byte[]) svc_callProc.run("captcha", false, null, session, () -> CaptchaMaker.cm_getCaptcha());
    }

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
