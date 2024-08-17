package quanta.service;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import quanta.config.ServiceBase;
import quanta.rest.request.AddFriendRequest;
import quanta.rest.request.AddPrivilegeRequest;
import quanta.rest.request.ChangePasswordRequest;
import quanta.rest.request.CloseAccountRequest;
import quanta.rest.request.CopySharingRequest;
import quanta.rest.request.DeleteAttachmentRequest;
import quanta.rest.request.DeletePropertyRequest;
import quanta.rest.request.ImportJsonRequest;
import quanta.rest.request.LikeNodeRequest;
import quanta.rest.request.LoginRequest;
import quanta.rest.request.MoveNodesRequest;
import quanta.rest.request.PasteAttachmentsRequest;
import quanta.rest.request.RemovePrivilegeRequest;
import quanta.rest.request.RemoveSignaturesRequest;
import quanta.rest.request.SaveNodeJsonRequest;
import quanta.rest.request.SaveUserProfileRequest;
import quanta.rest.request.SearchAndReplaceRequest;
import quanta.rest.request.SetNodePositionRequest;
import quanta.rest.request.SetUnpublishedRequest;
import quanta.rest.request.SignNodesRequest;
import quanta.rest.request.SignSubGraphRequest;
import quanta.rest.request.SignupRequest;
import quanta.rest.request.SplitNodeRequest;
import quanta.rest.request.TransferNodeRequest;
import quanta.rest.response.AddFriendResponse;
import quanta.rest.response.AddPrivilegeResponse;
import quanta.rest.response.ChangePasswordResponse;
import quanta.rest.response.CloseAccountResponse;
import quanta.rest.response.CopySharingResponse;
import quanta.rest.response.DeleteAttachmentResponse;
import quanta.rest.response.DeleteFriendResponse;
import quanta.rest.response.DeletePropertyResponse;
import quanta.rest.response.ImportJsonResponse;
import quanta.rest.response.LikeNodeResponse;
import quanta.rest.response.LoginResponse;
import quanta.rest.response.MoveNodesResponse;
import quanta.rest.response.PasteAttachmentsResponse;
import quanta.rest.response.RemovePrivilegeResponse;
import quanta.rest.response.SaveNodeJsonResponse;
import quanta.rest.response.SaveUserProfileResponse;
import quanta.rest.response.SearchAndReplaceResponse;
import quanta.rest.response.SetNodePositionResponse;
import quanta.rest.response.SetUnpublishedResponse;
import quanta.rest.response.SignNodesResponse;
import quanta.rest.response.SignupResponse;
import quanta.rest.response.SplitNodeResponse;
import quanta.rest.response.TransferNodeResponse;
import quanta.rest.response.base.ResponseBase;

/*
 * This service is a pure wrapper layer where all MongoDB Transactions are done. We need this
 * because of the ugly design of Spring where calling a transactional method from another class is
 * the ONLY way to guarantee the call will go thru the Spring Proxy. In other words if you call a
 * "@Transactional" method from the same class, it will not go thru the Spring Proxy and the
 * transaction will not be started.
 * 
 * Note: Putting @Transactional on this class makes all public methods transactional.
 */
@Component
@Transactional("mongoTm")
public class MongoTransactional extends ServiceBase {
    public DeletePropertyResponse cm_deleteProperties(DeletePropertyRequest req) {
        return svc_mongoDelete.deleteProperties(req);
    }

    public CopySharingResponse cm_copySharing(CopySharingRequest req) {
        return svc_acl.copySharing(req);
    }

    public AddPrivilegeResponse cm_addPrivilege(AddPrivilegeRequest req) {
        return svc_acl.addPrivilege(req);
    }

    public SetUnpublishedResponse cm_setUnpublished(SetUnpublishedRequest req) {
        return svc_acl.setUnpublished(req);
    }

    public RemovePrivilegeResponse cm_removePrivilege(RemovePrivilegeRequest req) {
        return svc_acl.removePrivilege(req);
    }

    public ResponseBase cm_uploadMultipleFiles(String attName, String nodeId, MultipartFile[] files,
            boolean explodeZips) {
        return svc_attach.uploadMultipleFiles(attName, nodeId, files, explodeZips);
    }

    public DeleteAttachmentResponse cm_deleteAttachment(DeleteAttachmentRequest req) {
        return svc_attach.deleteAttachment(req);
    }

    public String gridMaintenanceScan() {
        return svc_attach.gridMaintenanceScan();
    }

    public PasteAttachmentsResponse cm_pasteAttachments(PasteAttachmentsRequest req) {
        return svc_attach.pasteAttachments(req);
    }

    public SignNodesResponse cm_signNodes(SignNodesRequest req) {
        return svc_crypto.signNodes(req);
    }

    public Object cm_signSubGraph(SignSubGraphRequest req) {
        return svc_crypto.signSubGraph(req);
    }

    public Object cm_removeSignatures(RemoveSignaturesRequest req) {
        return svc_crypto.removeSignatures(req);
    }

    public DeleteFriendResponse cm_deleteFriend(String delUserNodeId, String parentType) {
        return svc_friend.deleteFriend(delUserNodeId, parentType);
    }

    public AddFriendResponse cm_addFriend(AddFriendRequest req) {
        return svc_friend.addFriend(req);
    }

    public TransferNodeResponse cm_transferNode(TransferNodeRequest req) {
        return svc_xfer.transferNode(req);
    }

    public LoginResponse cm_login(HttpServletRequest httpReq, LoginRequest req) {
        return svc_user.login(httpReq, req);
    }

    public CloseAccountResponse cm_closeAccount(CloseAccountRequest req, HttpSession session) {
        return svc_user.closeAccount(req, session);
    }

    public SignupResponse cm_signup(SignupRequest req, boolean automated) {
        return svc_user.signup(req, automated);
    }

    public SaveUserProfileResponse cm_saveUserProfile(SaveUserProfileRequest req) {
        return svc_user.saveUserProfile(req);
    }

    public ChangePasswordResponse cm_changePassword(ChangePasswordRequest req) {
        return svc_user.changePassword(req);
    }

    public ResponseEntity<?> cm_streamImport(String nodeId, MultipartFile[] uploadFiles) {
        return svc_import.streamImport(nodeId, uploadFiles);
    }

    public LikeNodeResponse cm_likeNode(LikeNodeRequest req) {
        return svc_edit.likeNode(req);
    }

    public ImportJsonResponse cm_importJson(ImportJsonRequest req) {
        return svc_import.importJson(req);
    }

    public SplitNodeResponse cm_splitNode(SplitNodeRequest req) {
        return svc_edit.splitNode(req);
    }

    public SearchAndReplaceResponse cm_searchAndReplace(SearchAndReplaceRequest req) {
        return svc_edit.searchAndReplace(req);
    }

    public SaveNodeJsonResponse cm_saveNodeJson(SaveNodeJsonRequest req) {
        return svc_edit.saveNodeJson(req);
    }

    public SetNodePositionResponse cm_setNodePosition(SetNodePositionRequest req) {
        return svc_move.setNodePosition(req);
    }

    public MoveNodesResponse cm_moveNodes(MoveNodesRequest req) {
        return svc_move.moveNodes(req);
    }
}
