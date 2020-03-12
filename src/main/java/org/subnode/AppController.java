package org.subnode;

import java.util.Date;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.subnode.config.SessionContext;
import org.subnode.config.SpringContextUtil;
import org.subnode.mail.MailSender;
import org.subnode.model.ExportOutputType;
import org.subnode.mongo.AclService;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.AddPrivilegeRequest;
import org.subnode.request.AnonPageLoadRequest;
import org.subnode.request.AppDropRequest;
import org.subnode.request.ChangePasswordRequest;
import org.subnode.request.CloseAccountRequest;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.request.DeleteAttachmentRequest;
import org.subnode.request.DeleteNodesRequest;
import org.subnode.request.DeletePropertyRequest;
import org.subnode.request.ExecuteNodeRequest;
import org.subnode.request.ExportRequest;
import org.subnode.request.GetNodePrivilegesRequest;
import org.subnode.request.GetServerInfoRequest;
import org.subnode.request.GraphRequest;
import org.subnode.request.InitNodeEditRequest;
import org.subnode.request.InsertBookRequest;
import org.subnode.request.InsertNodeRequest;
import org.subnode.request.LoginRequest;
import org.subnode.request.LogoutRequest;
import org.subnode.request.LuceneIndexRequest;
import org.subnode.request.LuceneSearchRequest;
import org.subnode.request.MoveNodesRequest;
import org.subnode.request.NodeSearchRequest;
import org.subnode.request.PingRequest;
import org.subnode.request.RebuildIndexesRequest;
import org.subnode.request.RemovePrivilegeRequest;
import org.subnode.request.RenderNodeRequest;
import org.subnode.request.ResetPasswordRequest;
import org.subnode.request.SaveNodeRequest;
import org.subnode.request.SavePropertyRequest;
import org.subnode.request.SavePublicKeyRequest;
import org.subnode.request.SaveUserPreferencesRequest;
import org.subnode.request.SelectAllNodesRequest;
import org.subnode.request.SendTestEmailRequest;
import org.subnode.request.SetCipherKeyRequest;
import org.subnode.request.SetNodePositionRequest;
import org.subnode.request.SetNodeTypeRequest;
import org.subnode.request.ShutdownServerNodeRequest;
import org.subnode.request.SignupRequest;
import org.subnode.request.SplitNodeRequest;
import org.subnode.request.TransferNodeRequest;
import org.subnode.request.UploadFromUrlRequest;
import org.subnode.response.AddPrivilegeResponse;
import org.subnode.response.AnonPageLoadResponse;
import org.subnode.response.AppDropResponse;
import org.subnode.response.ChangePasswordResponse;
import org.subnode.response.CloseAccountResponse;
import org.subnode.response.CreateSubNodeResponse;
import org.subnode.response.DeleteAttachmentResponse;
import org.subnode.response.DeleteNodesResponse;
import org.subnode.response.DeletePropertyResponse;
import org.subnode.response.ExecuteNodeResponse;
import org.subnode.response.ExportResponse;
import org.subnode.response.GetNodePrivilegesResponse;
import org.subnode.response.GetServerInfoResponse;
import org.subnode.response.GraphResponse;
import org.subnode.response.InitNodeEditResponse;
import org.subnode.response.InsertBookResponse;
import org.subnode.response.InsertNodeResponse;
import org.subnode.response.LoginResponse;
import org.subnode.response.LogoutResponse;
import org.subnode.response.LuceneIndexResponse;
import org.subnode.response.LuceneSearchResponse;
import org.subnode.response.MoveNodesResponse;
import org.subnode.response.NodeSearchResponse;
import org.subnode.response.PingResponse;
import org.subnode.response.RebuildIndexesResponse;
import org.subnode.response.RemovePrivilegeResponse;
import org.subnode.response.RenderNodeResponse;
import org.subnode.response.ResetPasswordResponse;
import org.subnode.response.SaveNodeResponse;
import org.subnode.response.SavePropertyResponse;
import org.subnode.response.SavePublicKeyResponse;
import org.subnode.response.SaveUserPreferencesResponse;
import org.subnode.response.SelectAllNodesResponse;
import org.subnode.response.SendTestEmailResponse;
import org.subnode.response.SetCipherKeyResponse;
import org.subnode.response.SetNodePositionResponse;
import org.subnode.response.SetNodeTypeResponse;
import org.subnode.response.ShutdownServerNodeResponse;
import org.subnode.response.SignupResponse;
import org.subnode.response.SplitNodeResponse;
import org.subnode.response.TransferNodeResponse;
import org.subnode.response.UploadFromUrlResponse;
import org.subnode.response.base.ResponseBase;
import org.subnode.service.AttachmentService;
import org.subnode.service.BashService;
import org.subnode.service.ExportTarService;
import org.subnode.service.ExportTxtService;
import org.subnode.service.ExportZipService;
import org.subnode.service.GraphNodesService;
import org.subnode.service.IPFSService;
import org.subnode.service.ImportBookService;
import org.subnode.service.ImportService;
import org.subnode.service.LuceneService;
import org.subnode.service.NodeEditService;
import org.subnode.service.NodeMoveService;
import org.subnode.service.NodeRenderService;
import org.subnode.service.NodeSearchService;
import org.subnode.service.SolrSearchService;
import org.subnode.service.SystemService;
import org.subnode.service.UserManagerService;
import org.subnode.util.ExUtil;
import org.subnode.util.ValContainer;

/**
 * Primary Spring MVC controller. All application logic from the browser
 * connects directly to this controller which is the only controller.
 * Importantly the main SPA page is retrieved thru this controller, and the
 * binary attachments are also served up thru this interface.
 * 
 * Note, it's critical to understand the OakSession AOP code or else this class
 * will be confusing regarding how the OAK transactions are managed and how
 * logging in is done.
 * 
 * This class has no documentation on the methods because it's a wrapper around
 * the service methods which is where the documentation can be found for each
 * operation in here. It's a better architecture to have all the AOP for any
 * given aspect be in one particular layer, because of how Spring AOP uses
 * Proxies. Things can get pretty ugly when you have various proxied objects
 * calling other proxies objects, so we have all the AOP for a service call in
 * this controller and then all the services are pure and simple Spring
 * Singletons.
 * 
 * There's a lot of boiler-plate code in here, but it's just required. This is
 * probably the only code in the system that looks 'redundant' (non-DRY), but
 * this is because we want certain things in certain layers (abstraction related
 * and for loose-coupling).
 * 
 * TODO: need to get all "business logic" out of this layer (there is a tiny bit
 * of it in here), because it doesn't belong here. Should all be contained in
 * service layer, utilities classes, etc.
 * 
 * NOTES: @RequestMapping also supports headers:
 * 
 * @RequestMapping(value = "/ex/foos", headers = "key=val", method = GET)
 */
@Controller
@CrossOrigin
public class AppController {
	private static final Logger log = LoggerFactory.getLogger(AppController.class);

	public static final String API_PATH = "/mobile/api";

	@Autowired
	private RunAsMongoAdmin adminRunner;

	@Autowired
	private CallProcessor callProc;

	@Autowired
	private MongoApi api;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private UserManagerService userManagerService;

	@Autowired
	private NodeRenderService nodeRenderService;

	@Autowired
	private NodeSearchService nodeSearchService;

	@Autowired
	private ImportService importService;

	@Autowired
	private ImportBookService importBookService;

	@Autowired
	private BashService bashService;

	@Autowired
	private NodeEditService nodeEditService;

	@Autowired
	private NodeMoveService nodeMoveService;

	@Autowired
	AttachmentService attachmentService;

	@Autowired
	private AclService aclService;

	@Autowired
	private SystemService systemService;

	@Autowired
	private SolrSearchService solrSearchService;

	@Autowired
	private LuceneService luceneService;

	// @Autowired
	// private ActivityPubService actPubService;

	@Autowired
	private IPFSService ipfsService;

	@Autowired
	private GraphNodesService graphNodesService;

	// @Autowired
	// private ApplicationEventPublisher eventPublisher;

	@Autowired
	private MailSender mailSender;

	private static final boolean logRequests = false;

	// private final CopyOnWriteArrayList<SseEmitter> emitters = new
	// CopyOnWriteArrayList<>();

	/*
	 * This is the actual app page loading request, for his SPA (Single Page
	 * Application) this is the request to load the page.
	 * 
	 * ID is optional url parameter that user can specify to access a specific node
	 * 
	 * passCode is an auth code for a password reset
	 */
	@RequestMapping(value = "/")
	public String index(//
			@RequestParam(value = "id", required = false) String id, //
			@RequestParam(value = "n", required = false) String name, //
			@RequestParam(value = "signupCode", required = false) String signupCode, //
			@RequestParam(value = "passCode", required = false) String passCode, //
			Model model) {

		log.debug("AppController.index");

		if (signupCode != null) {
			userManagerService.processSignupCode(signupCode, model);
		}

		// A 'name' param is handled just like an identifier with ":" prefix
		if (!StringUtils.isEmpty(name)) {
			id = ":" + name;
		}

		if (id != null) {
			ValContainer<String> vcId = new ValContainer<String>(id);
			log.debug("ID specified on url: " + id);
			String _id = id;
			adminRunner.run(mongoSession -> {
				// we don't check ownership of node at this time, but merely check sanity of
				// whether this ID is even existing or not.
				SubNode node = api.getNode(mongoSession, _id);
				if (node == null) {
					log.debug("Node did not exist.");
					vcId.setVal(null);
				} else {
					log.debug("Node exists.");
				}
			});
			sessionContext.setUrlId(vcId.getVal());
		} else {
			sessionContext.setUrlId(null);
		}

		if (passCode != null) {
			return "forward:/index.html?passCode=" + passCode;
		}

		return "forward:/index.html";
	}

	/*
	 * This is the actual app page loading request, for his SPA (Single Page
	 * Application) this is the request to load the page.
	 * 
	 * ID is optional url parameter that user can specify to access a specific node
	 * 
	 * passCode is an auth code for a password reset
	 */
	@RequestMapping(value = "/inbox")
	public String inbox(Model model) {
		sessionContext.setUrlId("~inbox");
		return "forward:/index.html";
	}

	@RequestMapping(value = API_PATH + "/signup", method = RequestMethod.POST)
	public @ResponseBody ResponseBase signup(@RequestBody SignupRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("signup", req, session, ms -> {
			SignupResponse res = new SignupResponse();
			userManagerService.signup(req, res, false);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/login", method = RequestMethod.POST)
	public @ResponseBody ResponseBase login(@RequestBody LoginRequest req, HttpSession session) {
		log.debug("AppController.login");
		return (ResponseBase) callProc.run("login", req, session, ms -> {
			LoginResponse res = new LoginResponse();
			res.setMessage("success: " + String.valueOf(++sessionContext.counter));
			userManagerService.login(null, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/closeAccount", method = RequestMethod.POST)
	public @ResponseBody ResponseBase closeAccount(@RequestBody CloseAccountRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("closeAccount", req, session, ms -> {
			CloseAccountResponse res = new CloseAccountResponse();

			userManagerService.closeAccount(req, res);
			SessionContext sessionContext = (SessionContext) SpringContextUtil.getBean(SessionContext.class);
			if (sessionContext != null) {
				sessionContext.setHttpSessionToInvalidate(session);
			}
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/logout", method = RequestMethod.POST)
	public @ResponseBody ResponseBase logout(@RequestBody LogoutRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("logout", req, session, ms -> {
			session.invalidate();
			LogoutResponse res = new LogoutResponse();
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/renderNode", method = RequestMethod.POST)
	public @ResponseBody ResponseBase renderNode(@RequestBody RenderNodeRequest req, //
			HttpServletRequest httpReq, HttpSession session) {
		return (ResponseBase) callProc.run("renderNode", req, session, ms -> {
			RenderNodeResponse res = new RenderNodeResponse();
			nodeRenderService.renderNode(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/initNodeEdit", method = RequestMethod.POST)
	public @ResponseBody ResponseBase initNodeEdit(@RequestBody InitNodeEditRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("initNodeEdit", req, session, ms -> {
			InitNodeEditResponse res = new InitNodeEditResponse();
			nodeRenderService.initNodeEdit(ms, req, res);
			return res;
		});
	}

	/* Called when user does drag-n-drop onto the application window */
	@RequestMapping(value = API_PATH + "/appDrop", method = RequestMethod.POST)
	public @ResponseBody ResponseBase appDrop(@RequestBody AppDropRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("appDrop", req, session, ms -> {
			AppDropResponse res = new AppDropResponse();
			nodeEditService.appDrop(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/getNodePrivileges", method = RequestMethod.POST)
	public @ResponseBody ResponseBase getNodePrivileges(@RequestBody GetNodePrivilegesRequest req,
			HttpSession session) {
		return (ResponseBase) callProc.run("getNodePrivileges", req, session, ms -> {
			GetNodePrivilegesResponse res = new GetNodePrivilegesResponse();
			aclService.getNodePrivileges(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/addPrivilege", method = RequestMethod.POST)
	public @ResponseBody ResponseBase addPrivilege(@RequestBody AddPrivilegeRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("addPrivilege", req, session, ms -> {
			AddPrivilegeResponse res = new AddPrivilegeResponse();
			aclService.addPrivilege(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/removePrivilege", method = RequestMethod.POST)
	public @ResponseBody ResponseBase removePrivilege(@RequestBody RemovePrivilegeRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("removePrivilege", req, session, ms -> {
			RemovePrivilegeResponse res = new RemovePrivilegeResponse();
			aclService.removePrivilege(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/savePublicKey", method = RequestMethod.POST)
	public @ResponseBody ResponseBase savePublicKey(@RequestBody SavePublicKeyRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("addPrivilege", req, session, ms -> {
			SavePublicKeyResponse res = new SavePublicKeyResponse();
			userManagerService.savePublicKey(req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/setCipherKey", method = RequestMethod.POST)
	public @ResponseBody ResponseBase setCipherKey(@RequestBody SetCipherKeyRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("setCipherKey", req, session, ms -> {
			SetCipherKeyResponse res = new SetCipherKeyResponse();
			aclService.setCipherKey(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/export", method = RequestMethod.POST)
	public @ResponseBody ResponseBase export(@RequestBody ExportRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("export", req, session, ms -> {
			ExportResponse res = new ExportResponse();

			if ("md".equalsIgnoreCase(req.getExportExt())) {
				ExportTxtService svc = (ExportTxtService) SpringContextUtil.getBean(ExportTxtService.class);
				svc.export(ms, ExportOutputType.MD, req, res);
			} else if ("json".equalsIgnoreCase(req.getExportExt())) {
				ExportTxtService svc = (ExportTxtService) SpringContextUtil.getBean(ExportTxtService.class);
				svc.export(ms, ExportOutputType.JSON, req, res);
			}
			// else if ("pdf".equalsIgnoreCase(req.getExportExt())) {
			// ExportPdfService svc = (ExportPdfService)
			// SpringContextUtil.getBean(ExportPdfService.class);
			// svc.export(null, req, res);
			// }
			else if ("zip".equalsIgnoreCase(req.getExportExt())) {
				ExportZipService svc = (ExportZipService) SpringContextUtil.getBean(ExportZipService.class);
				svc.export(ms, req, res);
			} else if ("tar".equalsIgnoreCase(req.getExportExt())) {
				ExportTarService svc = (ExportTarService) SpringContextUtil.getBean(ExportTarService.class);
				svc.export(ms, req, res);
			} else if ("tar.gz".equalsIgnoreCase(req.getExportExt())) {
				ExportTarService svc = (ExportTarService) SpringContextUtil.getBean(ExportTarService.class);
				svc.setUseGZip(true);
				svc.export(ms, req, res);
			} else {
				throw ExUtil.newEx("Unsupported file extension: " + req.getExportExt());
			}
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/transferNode", method = RequestMethod.POST)
	public @ResponseBody ResponseBase transferNode(@RequestBody TransferNodeRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("export", req, session, ms -> {
			TransferNodeResponse res = new TransferNodeResponse();
			nodeEditService.transferNode(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/streamImport", method = RequestMethod.POST)
	public @ResponseBody ResponseEntity<?> streamImport(//
			@RequestParam(value = "nodeId", required = true) String nodeId, //
			@RequestParam(value = "files", required = true) MultipartFile[] uploadFiles, HttpSession session) {
		return (ResponseEntity<?>) callProc.run("upload", null, session, ms -> {
			if (nodeId == null) {
				throw ExUtil.newEx("target nodeId not provided");
			}
			return importService.streamImport(ms, nodeId, uploadFiles);
		});
	}

	@RequestMapping(value = API_PATH + "/setNodePosition", method = RequestMethod.POST)
	public @ResponseBody ResponseBase setNodePosition(@RequestBody SetNodePositionRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("setNodePosition", req, session, ms -> {
			SetNodePositionResponse res = new SetNodePositionResponse();

			nodeMoveService.setNodePosition(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/createSubNode", method = RequestMethod.POST)
	public @ResponseBody ResponseBase createSubNode(@RequestBody CreateSubNodeRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("createSubNode", req, session, ms -> {
			CreateSubNodeResponse res = new CreateSubNodeResponse();
			nodeEditService.createSubNode(ms, req, res);
			return res;
		});
	}

	/*
	 * Inserts node 'inline' at the position specified in the
	 * InsertNodeRequest.targetName
	 */
	@RequestMapping(value = API_PATH + "/insertNode", method = RequestMethod.POST)
	public @ResponseBody ResponseBase insertNode(@RequestBody InsertNodeRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("insertNode", req, session, ms -> {
			InsertNodeResponse res = new InsertNodeResponse();
			nodeEditService.insertNode(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/insertBook", method = RequestMethod.POST)
	public @ResponseBody ResponseBase insertBook(@RequestBody InsertBookRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("insertBook", req, session, ms -> {
			InsertBookResponse res = new InsertBookResponse();
			if (!sessionContext.isAdmin()) {
				throw ExUtil.newEx("admin only function.");
			}

			importBookService.insertBook(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/executeNode", method = RequestMethod.POST)
	public @ResponseBody ResponseBase executeNode(@RequestBody ExecuteNodeRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("executeNode", req, session, ms -> {
			ExecuteNodeResponse res = new ExecuteNodeResponse();

			if (!sessionContext.isAdmin()) {
				throw ExUtil.newEx("admin only function.");
			}

			// todo-1: disabling pending security audit.
			// bashService.executeNode(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/deleteNodes", method = RequestMethod.POST)
	public @ResponseBody ResponseBase deleteNodes(@RequestBody DeleteNodesRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("deleteNodes", req, session, ms -> {
			DeleteNodesResponse res = new DeleteNodesResponse();
			nodeMoveService.deleteNodes(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/selectAllNodes", method = RequestMethod.POST)
	public @ResponseBody ResponseBase selectAllNodes(@RequestBody SelectAllNodesRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("selectAllNodes", req, session, ms -> {
			SelectAllNodesResponse res = new SelectAllNodesResponse();
			nodeMoveService.selectAllNodes(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/moveNodes", method = RequestMethod.POST)
	public @ResponseBody ResponseBase moveNodes(@RequestBody MoveNodesRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("moveNodes", req, session, ms -> {
			MoveNodesResponse res = new MoveNodesResponse();
			nodeMoveService.moveNodes(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/deleteProperty", method = RequestMethod.POST)
	public @ResponseBody ResponseBase deleteProperty(@RequestBody DeletePropertyRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("deleteProperty", req, session, ms -> {
			DeletePropertyResponse res = new DeletePropertyResponse();
			nodeEditService.deleteProperty(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/saveNode", method = RequestMethod.POST)
	public @ResponseBody ResponseBase saveNode(@RequestBody SaveNodeRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("saveNode", req, session, ms -> {
			SaveNodeResponse res = new SaveNodeResponse();
			nodeEditService.saveNode(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/saveProperty", method = RequestMethod.POST)
	public @ResponseBody ResponseBase saveProperty(@RequestBody SavePropertyRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("saveProperty", req, session, ms -> {
			SavePropertyResponse res = new SavePropertyResponse();
			nodeEditService.saveProperty(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/setNodeType", method = RequestMethod.POST)
	public @ResponseBody ResponseBase setNodeType(@RequestBody SetNodeTypeRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("setNodeType", req, session, ms -> {
			SetNodeTypeResponse res = new SetNodeTypeResponse();
			nodeEditService.setNodeType(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/changePassword", method = RequestMethod.POST)
	public @ResponseBody ResponseBase changePassword(@RequestBody ChangePasswordRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("changePassword", req, session, ms -> {
			ChangePasswordResponse res = new ChangePasswordResponse();
			userManagerService.changePassword(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/resetPassword", method = RequestMethod.POST)
	public @ResponseBody ResponseBase resetPassword(@RequestBody ResetPasswordRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("resetPassword", req, session, ms -> {
			ResetPasswordResponse res = new ResetPasswordResponse();
			userManagerService.resetPassword(req, res);
			return res;
		});
	}

	/*
	 * We could persist the real filename when uploaded, and then make the links
	 * actually reference that filename on this type of path. Will have to add to
	 * binary info property sent to client in JSON.
	 * 
	 * NOTE: Currently unused. We use 'getBinary' instead. See getBinary_legacy for
	 * explanation.
	 */
	@RequestMapping(value = API_PATH + "/bin_legacy/{fileName}", method = RequestMethod.GET)
	public ResponseEntity<InputStreamResource> getBinaryLegacy(@PathVariable("fileName") String fileName,
			@RequestParam("nodeId") String nodeId, HttpSession session) {
		return (ResponseEntity<InputStreamResource>) callProc.run("bin", null, session, ms -> {
			return attachmentService.getBinary_legacy(null, nodeId);
		});
	}

	@RequestMapping(value = API_PATH + "/bin/{fileName}", method = RequestMethod.GET)
	public void getBinary(@PathVariable("fileName") String fileName, @RequestParam("nodeId") String nodeId,
			HttpSession session, HttpServletResponse response) {
		callProc.run("bin", null, session, ms -> {
			attachmentService.getBinary(null, nodeId, response);
			return null;
		});
	}

	/*
	 * todo-3: we should return proper HTTP codes when file not found, etc.
	 *
	 * The ":.+" is there because that is required to stop it from truncating file
	 * extension.
	 * https://stackoverflow.com/questions/16332092/spring-mvc-pathvariable-with-dot
	 * -is-getting- truncated
	 */
	@RequestMapping(value = "/file/{fileName:.+}", method = RequestMethod.GET)
	public ResponseEntity<StreamingResponseBody> getFile(//
			@PathVariable("fileName") String fileName, //
			@RequestParam(name = "disp", required = false) String disposition, //
			@RequestParam(name = "format", required = false) String formatted, HttpSession session) {
		return (ResponseEntity<StreamingResponseBody>) callProc.run("file", null, session, ms -> {
			boolean bFormatted = false;
			if (formatted != null) {
				String formattedLc = formatted.toLowerCase();
				bFormatted = formattedLc.startsWith("t") || formattedLc.startsWith("y");
			}
			return attachmentService.getFile(ms, fileName, disposition, bFormatted);
		});
	}

	/*
	 * NOTE: this rest endpoint has -xxx appended so it never gets called, however
	 * for efficient streaming of content for 'non-seekable' media, this works
	 * perfectly, but i'm using the getFileSystemResourceStreamMultiPart call below
	 * instead which DOES support seeking, which means very large video files can be
	 * played
	 * 
	 * I never tried this: so what I'm doing here CAN be done simpler if this
	 * following snippet will have worked:
	 * 
	 * @RequestMapping(method = RequestMethod.GET, value = "/testVideo")
	 * 
	 * @ResponseBody public FileSystemResource testVideo(Principal principal) throws
	 * IOException { return new FileSystemResource(new File("D:\\oceans.mp4")); }
	 * however, the above snipped might not be as powerful/flexible as what i have
	 * implemented since my solution can be modified easier at a lower level if we
	 * ever need to.
	 * 
	 * <pre> https://dzone.com/articles/writing-download-server-part-i
	 * https://www.logicbig.com/tutorials/spring-framework/spring-web-mvc/streaming-
	 * response-body.html
	 * https://stackoverflow.com/questions/38957245/spring-mvc-streamingresponsebody
	 * -return-chunked-file </pre>
	 */
	@RequestMapping(value = "/filesys-xxx/{nodeId}", method = RequestMethod.GET)
	public ResponseEntity<StreamingResponseBody> getFileSystemResourceStream(//
			@PathVariable("nodeId") String nodeId, //
			@RequestParam(name = "disp", required = false) String disposition, //
			HttpSession session) {
		return (ResponseEntity<StreamingResponseBody>) callProc.run("filesys", null, session, ms -> {
			if (!ms.isAdmin()) {
				throw new RuntimeException("unauthorized");
			}
			return attachmentService.getFileSystemResourceStream(ms, nodeId, disposition);
		});
	}

	/*
	 * This endpoint serves up large media files efficiently and supports seeking,
	 * so that the fast-foward, rewind, seeking in video players works!!!
	 */
	@RequestMapping(value = "/filesys/{nodeId}", method = RequestMethod.GET)
	public void getFileSystemResourceStreamMultiPart(//
			@PathVariable("nodeId") String nodeId, //
			@RequestParam(name = "disp", required = false) String disposition, //
			HttpServletRequest request, HttpServletResponse response, //
			HttpSession session) {
		callProc.run("filesys", null, session, ms -> {
			attachmentService.getFileSystemResourceStreamMultiPart(ms, nodeId, disposition, request, response);
			return null;
		});
	}

	// /* Used for displaying a file specified by a file url parameter (tbd) */
	// @RequestMapping(value = "/view/{fileName:.+}", method = RequestMethod.GET)
	// public String view(@PathVariable("fileName") String fileName, //
	// Model model) {
	//
	// logRequest("view", null);
	// checkJcr();
	//
	// model.addAttribute("content", attachmentService.getFileContent(null,
	// fileName));
	//
	// // tag: view.html
	// return "view";
	// }
	//

	@RequestMapping(value = API_PATH + "/upload", method = RequestMethod.POST)
	public @ResponseBody ResponseEntity<?> upload(//
			@RequestParam(value = "nodeId", required = true) String nodeId, //
			@RequestParam(value = "explodeZips", required = true) String explodeZips, //
			@RequestParam(value = "ipfs", required = true) String ipfs, //
			@RequestParam(value = "files", required = true) MultipartFile[] uploadFiles, //
			HttpSession session) {
		return (ResponseEntity<?>) callProc.run("upload", null, session, ms -> {
			if (nodeId == null) {
				throw ExUtil.newEx("target nodeId not provided");
			}
			return attachmentService.uploadMultipleFiles(ms, nodeId, uploadFiles, explodeZips.equalsIgnoreCase("true"),
					"true".equalsIgnoreCase(ipfs));
		});
	}

	@RequestMapping(value = API_PATH + "/deleteAttachment", method = RequestMethod.POST)
	public @ResponseBody ResponseBase deleteAttachment(@RequestBody DeleteAttachmentRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("deleteAttachment", req, session, ms -> {
			DeleteAttachmentResponse res = new DeleteAttachmentResponse();

			attachmentService.deleteAttachment(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/uploadFromUrl", method = RequestMethod.POST)
	public @ResponseBody ResponseBase uploadFromUrl(@RequestBody UploadFromUrlRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("uploadFromUrl", req, session, ms -> {
			UploadFromUrlResponse res = new UploadFromUrlResponse();
			attachmentService.readFromUrl(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/anonPageLoad", method = RequestMethod.POST)
	public @ResponseBody ResponseBase anonPageLoad(@RequestBody AnonPageLoadRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("anonPageLoad", req, session, ms -> {
			AnonPageLoadResponse res = new AnonPageLoadResponse();
			nodeRenderService.anonPageLoad(null, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/nodeSearch", method = RequestMethod.POST)
	public @ResponseBody ResponseBase nodeSearch(@RequestBody NodeSearchRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("nodeSearch", req, session, ms -> {
			NodeSearchResponse res = new NodeSearchResponse();
			nodeSearchService.search(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/graphNodes", method = RequestMethod.POST)
	public @ResponseBody ResponseBase graphNodes(@RequestBody GraphRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("nodeSearch", req, session, ms -> {
			GraphResponse res = new GraphResponse();
			graphNodesService.graphNodes(ms, req, res);
			log.debug("graphNodes ran on server.");
			return res;
		});
	}

	/*
	 * currently disabled from the GUI menu, until we add back in this capability on
	 * the new mongo design
	 */
	// @RequestMapping(value = API_PATH + "/getSharedNodes", method =
	// RequestMethod.POST)
	// public @ResponseBody GetSharedNodesResponse getSharedNodes(@RequestBody
	// GetSharedNodesRequest
	// req) {
	//
	// logRequest("getSharedNodes", req);
	// checkJcr();
	// GetSharedNodesResponse res = new GetSharedNodesResponse();
	//
	// nodeSearchService.getSharedNodes(null, req, res);
	// return res;
	// }

	@RequestMapping(value = API_PATH + "/saveUserPreferences", method = RequestMethod.POST)
	public @ResponseBody ResponseBase saveUserPreferences(@RequestBody SaveUserPreferencesRequest req,
			HttpSession session) {
		return (ResponseBase) callProc.run("saveUserPreferences", req, session, ms -> {
			SaveUserPreferencesResponse res = new SaveUserPreferencesResponse();
			userManagerService.saveUserPreferences(req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/getServerInfo", method = RequestMethod.POST)
	public @ResponseBody ResponseBase getServerInfo(@RequestBody GetServerInfoRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("getServerInfo", req, session, ms -> {
			GetServerInfoResponse res = new GetServerInfoResponse();

			if (req.getCommand().equalsIgnoreCase("getJson")) {
				// allow this one if user owns node.
			} else if (!sessionContext.isAdmin()) {
				throw ExUtil.newEx("admin only function.");
			}

			log.debug("Command: " + req.getCommand());

			if (req.getCommand().equalsIgnoreCase("ipfsGetNodeInfo")) {
				res.setServerInfo(ipfsService.getNodeInfo(ms, req.getNodeId()));
			} else if (req.getCommand().equalsIgnoreCase("compactDb")) {
				res.setServerInfo(systemService.compactDb());
			} else if (req.getCommand().equalsIgnoreCase("backupDb")) {
				res.setServerInfo(systemService.backupDb());
			} else if (req.getCommand().equalsIgnoreCase("initializeAppContent")) {
				res.setServerInfo(systemService.initializeAppContent());
			} else if (req.getCommand().equalsIgnoreCase("getServerInfo")) {
				res.setServerInfo(systemService.getSystemInfo());
			} else if (req.getCommand().equalsIgnoreCase("getJson")) {
				res.setServerInfo(systemService.getJson(ms, req.getNodeId()));
			} else {
				throw new RuntimeException("Invalid command: " + req.getCommand());
			}
			res.setSuccess(true);

			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/luceneIndex", method = RequestMethod.POST)
	public @ResponseBody ResponseBase luceneIndex(@RequestBody LuceneIndexRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("luceneIndex", req, session, ms -> {
			LuceneIndexResponse res = new LuceneIndexResponse();
			if (!sessionContext.isAdmin()) {
				throw ExUtil.newEx("admin only function.");
			}

			/*
			 * todo-1: If we are searching a large directory structure here the search will
			 * take a long time and just show a generic non-updated progress base on the
			 * browser. We need a better way to push status back to server and also not make
			 * user wait, but be able to close the dlg and move on. Probably we need a
			 * Lucene Console tab we can just flip over to and then the user is free to look
			 * at it or not, as they please, but it would be updating in near-realtime using
			 * server push.
			 */
			String message = luceneService.reindex(ms, req.getNodeId(), req.getPath());
			res.setSuccess(true);
			res.setMessage(message);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/luceneSearch", method = RequestMethod.POST)
	public @ResponseBody ResponseBase luceneSearch(@RequestBody LuceneSearchRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("luceneSearch", req, session, ms -> {
			LuceneSearchResponse res = new LuceneSearchResponse();
			String message = luceneService.search(ms, req.getNodeId(), req.getText());
			res.setSuccess(true);
			res.setMessage(message);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/getNotifications", method = RequestMethod.POST)
	public @ResponseBody ResponseBase getNotifications(@RequestBody GetServerInfoRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("getNotifications", req, session, ms -> {
			GetServerInfoResponse res = new GetServerInfoResponse();

			if (sessionContext.getSignupSuccessMessage() != null) {
				res.setServerInfo(sessionContext.getSignupSuccessMessage());
				sessionContext.setSignupSuccessMessage(null);
			}

			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/ping", method = RequestMethod.POST)
	public @ResponseBody ResponseBase ping(@RequestBody PingRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("ping", req, session, ms -> {
			PingResponse res = new PingResponse();
			res.setServerInfo("Server: t=" + System.currentTimeMillis());
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/rebuildIndexes", method = RequestMethod.POST)
	public @ResponseBody ResponseBase rebuildIndexes(@RequestBody RebuildIndexesRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("rebuildIndexes", req, session, ms -> {
			RebuildIndexesResponse res = new RebuildIndexesResponse();
			if (!sessionContext.isAdmin()) {
				throw ExUtil.newEx("admin only function.");
			}

			adminRunner.run(mongoSession -> {
				api.rebuildIndexes(mongoSession);
			});

			res.setSuccess(true);

			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/shutdownServerNode", method = RequestMethod.POST)
	public @ResponseBody ResponseBase shutdownServerNode(@RequestBody ShutdownServerNodeRequest req,
			HttpSession session) {
		return (ResponseBase) callProc.run("shutdownServerNode", req, session, ms -> {
			ShutdownServerNodeResponse res = new ShutdownServerNodeResponse();
			if (!sessionContext.isAdmin()) {
				throw ExUtil.newEx("admin only function.");
			}

			Runnable runnable = () -> {
				try {
					Thread.sleep(5000);
				} catch (Exception e) {
				}
				Runtime runtime = Runtime.getRuntime();
				System.out.println("About to halt the current jvm");
				runtime.halt(0);
			};
			Thread thread = new Thread(runnable);
			thread.start();

			res.setSuccess(true);

			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/sendTestEmail", method = RequestMethod.POST)
	public @ResponseBody ResponseBase sendTestEmail(@RequestBody SendTestEmailRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("sendTestEmail", req, session, ms -> {
			SendTestEmailResponse res = new SendTestEmailResponse();
			if (!sessionContext.isAdmin()) {
				throw ExUtil.newEx("admin only function.");
			}
			log.debug("SendEmailTest detected on server.");

			String timeString = new Date().toString();
			synchronized (MailSender.getLock()) {
				try {
					mailSender.init();
					mailSender.sendMail("wclayf@gmail.com", null,
							"<h1>Hello from Quantizr! Time=" + timeString + "</h1>", "Test Subject");
				} finally {
					mailSender.close();
				}
			}
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/splitNode", method = RequestMethod.POST)
	public @ResponseBody ResponseBase splitNode(@RequestBody SplitNodeRequest req, HttpSession session) {
		return (ResponseBase) callProc.run("splitNode", req, session, ms -> {
			SplitNodeResponse res = new SplitNodeResponse();
			nodeEditService.splitNode(ms, req, res);
			return res;
		});
	}

	// Work on ActivityPub is 'on hold' for now.
	// @RequestMapping(value = API_PATH + "/activityPubPost", method =
	// RequestMethod.POST)
	// public @ResponseBody ResponseBase activityPubPost(@RequestBody
	// ActivityPubPostRequest req, HttpSession session) {
	// return (ResponseBase) callProc.run("activityPubPost", req, session, ms -> {
	// ActivityPubPostResponse res = new ActivityPubPostResponse();
	// String nodeId = req.getNodeId();
	// SubNode node = api.getNode(ms, nodeId);
	// if (node != null) {
	// log.debug("found node to post: " + nodeId);
	// String content = node.getStringProp(NodeProp.CONTENT);
	// String destination = node.getStringProp("apdest");

	// actPubService.sendMessage(content, destination);
	// }
	// return res;
	// });
	// }

	//
	// @RequestMapping(value = API_PATH + "/openSystemFile", method =
	// RequestMethod.POST)
	// public @ResponseBody OpenSystemFileResponse saveUserPreferences(@RequestBody
	// OpenSystemFileRequest req) {
	// logRequest("openSystemFile", req);
	// checkJcr();
	// OpenSystemFileResponse res = new OpenSystemFileResponse();
	//
	// DesktopApi.open(new File(req.getFileName()));
	// return res;
	// }

	// reference: https://www.baeldung.com/spring-server-sent-events
	@GetMapping(API_PATH + "/serverPush")
	public SseEmitter serverPush() {
		// disabling the below code, which was already proven to work. no bugs.
		// SseEmitter emitter = new SseEmitter();
		// ExecutorService sseMvcExecutor = Executors.newSingleThreadExecutor();
		// sseMvcExecutor.execute(() -> {
		// try {
		// for (int i = 0; true; i++) {
		// SseEventBuilder event = SseEmitter.event() //
		// .data("SSE Event - " + LocalTime.now().toString()) //
		// .id(String.valueOf(i)) //
		// .name("serverPushEvent");
		// emitter.send(event);
		// Thread.sleep(3000);
		// }
		// } catch (Exception ex) {
		// emitter.completeWithError(ex);
		// }
		// });
		// return emitter;
		return null;
	}
}
