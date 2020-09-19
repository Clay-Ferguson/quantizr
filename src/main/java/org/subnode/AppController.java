package org.subnode;

import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.MediaType;
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
import org.subnode.config.ConstantsProvider;
import org.subnode.config.SessionContext;
import org.subnode.config.SpringContextUtil;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.mail.MailSender;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.AddPrivilegeRequest;
import org.subnode.request.AppDropRequest;
import org.subnode.request.ChangePasswordRequest;
import org.subnode.request.CloseAccountRequest;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.request.DeleteAttachmentRequest;
import org.subnode.request.DeleteNodesRequest;
import org.subnode.request.DeletePropertyRequest;
import org.subnode.request.ExecuteNodeRequest;
import org.subnode.request.ExportRequest;
import org.subnode.request.GetBreadcrumbsRequest;
import org.subnode.request.GetFriendsRequest;
import org.subnode.request.GetNodePrivilegesRequest;
import org.subnode.request.GetServerInfoRequest;
import org.subnode.request.GetSharedNodesRequest;
import org.subnode.request.GetUserAccountInfoRequest;
import org.subnode.request.GetUserProfileRequest;
import org.subnode.request.InitNodeEditRequest;
import org.subnode.request.InsertBookRequest;
import org.subnode.request.InsertNodeRequest;
import org.subnode.request.LoginRequest;
import org.subnode.request.LogoutRequest;
import org.subnode.request.LuceneIndexRequest;
import org.subnode.request.LuceneSearchRequest;
import org.subnode.request.MoveNodesRequest;
import org.subnode.request.NodeFeedRequest;
import org.subnode.request.NodeSearchRequest;
import org.subnode.request.PingRequest;
import org.subnode.request.RebuildIndexesRequest;
import org.subnode.request.RemovePrivilegeRequest;
import org.subnode.request.RenderCalendarRequest;
import org.subnode.request.RenderNodeRequest;
import org.subnode.request.SaveNodeRequest;
import org.subnode.request.ResetPasswordRequest;
import org.subnode.request.SavePublicKeyRequest;
import org.subnode.request.SaveUserPreferencesRequest;
import org.subnode.request.SaveUserProfileRequest;
import org.subnode.request.SelectAllNodesRequest;
import org.subnode.request.SendTestEmailRequest;
import org.subnode.request.SetCipherKeyRequest;
import org.subnode.request.SetNodePositionRequest;
import org.subnode.request.ShutdownServerNodeRequest;
import org.subnode.request.SignupRequest;
import org.subnode.request.SplitNodeRequest;
import org.subnode.request.TransferNodeRequest;
import org.subnode.request.UploadFromUrlRequest;
import org.subnode.response.CloseAccountResponse;
import org.subnode.response.ExecuteNodeResponse;
import org.subnode.response.ExportResponse;
import org.subnode.response.GetServerInfoResponse;
import org.subnode.response.InfoMessage;
import org.subnode.response.LogoutResponse;
import org.subnode.response.PingResponse;
import org.subnode.response.RebuildIndexesResponse;
import org.subnode.response.SendTestEmailResponse;
import org.subnode.response.ShutdownServerNodeResponse;
import org.subnode.service.AclService;
import org.subnode.service.AttachmentService;
import org.subnode.service.ExportServiceFlexmark;
import org.subnode.service.ExportTarService;
import org.subnode.service.ExportTextService;
import org.subnode.service.ExportZipService;
import org.subnode.service.IPFSService;
import org.subnode.service.ImportBookService;
import org.subnode.service.ImportService;
import org.subnode.service.LuceneService;
import org.subnode.service.NodeEditService;
import org.subnode.service.NodeMoveService;
import org.subnode.service.NodeRenderService;
import org.subnode.service.NodeSearchService;
import org.subnode.service.SystemService;
import org.subnode.service.UserFeedService;
import org.subnode.service.UserManagerService;
import org.subnode.util.ExUtil;
import org.subnode.util.FileUtils;

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
 */
@Controller
@CrossOrigin
public class AppController implements ErrorController {
	private static final Logger log = LoggerFactory.getLogger(AppController.class);

	public static final String API_PATH = "/mobile/api";

	private static HashMap<String, String> welcomeMap = null;
	private static final Object welcomeMapLock = new Object();

	// maps classpath resource names to their md5 values
	private static HashMap<String, String> cacheBusterMd5 = null;

	private static boolean welcomePagePresent;

	@Autowired
	private FileUtils fileUtils;

	@Autowired
	private RunAsMongoAdmin adminRunner;

	@Autowired
	private CallProcessor callProc;

	@Autowired
	private MongoUtil mongoUtil;

	@Autowired
	private MongoRead read;

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
	private LuceneService luceneService;

	@Autowired
	private IPFSService ipfsService;

	// @Autowired
	// private ApplicationEventPublisher eventPublisher;

	@Autowired
	private MailSender mailSender;

	@Autowired
	private UserFeedService userFeedService;

	@Autowired
	private ConstantsProvider constProvider;

	// private final CopyOnWriteArrayList<SseEmitter> emitters = new
	// CopyOnWriteArrayList<>();

	private static final String ERROR_MAPPING = "/error";

	@RequestMapping(value = ERROR_MAPPING)
	public String error(Model model) {
		model.addAttribute("hostAndPort", constProvider.getHostAndPort());
		model.addAllAttributes(cacheBusterMd5);
		// pulls up error.html
		return "error";
	}

	public void init() {
		initCacheBuster();
	}

	public void initCacheBuster() {
		cacheBusterMd5 = new HashMap<String, String>();

		cacheBusterMd5.put("BUNDLE_JS_HASH", fileUtils.genHashOfClasspathResource("/public/bundle.js"));
		cacheBusterMd5.put("MAIN_CSS_HASH", fileUtils.genHashOfClasspathResource("/public/css/meta64.css"));
		cacheBusterMd5.put("FONT_AWESOME_CSS_HASH",
				fileUtils.genHashOfClasspathResource("/public/font-awesome-4.7.0/css/font-awesome.min.css"));
		cacheBusterMd5.put("DROPZONE_CSS_HASH",
				fileUtils.genHashOfClasspathResource("/public/js/dropzone/dropzone.css"));
		cacheBusterMd5.put("DARCULA_CSS_HASH",
				fileUtils.genHashOfClasspathResource("/public/css/highlightjs/darcula.css"));
		cacheBusterMd5.put("DROPZONE_JS_HASH", fileUtils.genHashOfClasspathResource("/public/js/dropzone/dropzone.js"));
		cacheBusterMd5.put("ACE_JS_HASH", fileUtils.genHashOfClasspathResource("/public/js/ace/src-noconflict/ace.js"));
	}

	@Override
	public String getErrorPath() {
		return ERROR_MAPPING;
	}

	/*
	 * This is the actual app page loading request, for his SPA (Single Page
	 * Application) this is the request to load the page.
	 * 
	 * ID is optional url parameter that user can specify to access a specific node
	 * 
	 * passCode is an auth code for a password reset
	 * 
	 * Renders with Thymeleaf
	 */
	@RequestMapping(value = { "/app", "/n/{nameOnAdminNode}", "/u/{userName}/{nameOnUserNode}" })
	public String index(//

			// node name on 'admin' account. Non-admin named nodes use url
			// "/u/userName/nodeName"
			@PathVariable(value = "nameOnAdminNode", required = false) String nameOnAdminNode, //

			@PathVariable(value = "nameOnUserNode", required = false) String nameOnUserNode, //
			@PathVariable(value = "userName", required = false) String userName, //

			@RequestParam(value = "id", required = false) String id, //

			// be careful removing this, clicking on a node updates the browser history to
			// an 'n=' style url if this node is named
			// so we will need to change that to the path format.
			@RequestParam(value = "n", required = false) String name, //
			@RequestParam(value = "passCode", required = false) String passCode, //
			Model model) {

		try {
			// if in DEV mode we always update cache buster in case files have changed.
			if (constProvider.getProfileName().equals("dev")) {
				initCacheBuster();
			}

			// log.debug("AppController.index: sessionUser=" +
			// sessionContext.getUserName());
			model.addAllAttributes(cacheBusterMd5);

			// Node Names are identified using a colon in front of it, to make it detectable
			if (!StringUtils.isEmpty(nameOnUserNode) && !StringUtils.isEmpty(userName)) {
				id = ":" + userName + ":" + nameOnUserNode;
			} else if (!StringUtils.isEmpty(nameOnAdminNode)) {
				id = ":" + nameOnAdminNode;
			} else if (!StringUtils.isEmpty(name)) {
				id = ":" + name;
			}

			if (id != null) {
				sessionContext.setUrlId(id);
				// log.debug("ID specified on url=" + id);
				String _id = id;
				adminRunner.run(mongoSession -> {
					// we don't check ownership of node at this time, but merely check sanity of
					// whether this ID is even existing or not.
					SubNode node = read.getNode(mongoSession, _id);
					nodeRenderService.populateSocialCardProps(node, model);
					if (node == null) {
						log.debug("Node did not exist.");
						sessionContext.setUrlId(null);
					} else {
						log.debug("Node exists.");
					}
				});
			} else {
				sessionContext.setUrlId(null);
			}

		} catch (Exception e) {
			// need to add some kind of message to exception to indicate to user something
			// with the arguments went wrong.
			ExUtil.error(log, "exception in call processor", e);
		}

		return "index";
	}

	/*
	 * Renders with Thymeleaf
	 */
	@RequestMapping(value = { "/" })
	public String welcome(@RequestParam(value = "signupCode", required = false) String signupCode, //
			Model model) {
		// if in DEV mode we always update cache buster in case files have changed.
		if (constProvider.getProfileName().equals("dev")) {
			initCacheBuster();
		}

		if (welcomeMap == null || PrincipalName.ADMIN.s().equals(sessionContext.getUserName())) {
			synchronized (welcomeMapLock) {
				HashMap<String, String> newMap = new HashMap<String, String>();
				welcomePagePresent = nodeRenderService.thymeleafRenderNode(newMap, "pg_welcome");
				welcomeMap = newMap;
			}
		}

		if (signupCode != null) {
			String signupResponse = userManagerService.processSignupCode(signupCode);
			model.addAttribute("signupResponse", signupResponse);
		}

		model.addAllAttributes(cacheBusterMd5);

		/*
		 * if welcomeMap is empty that likely means the "pg_welcome" node hasn't yet
		 * been created on this quanta instanace so we bypass the landing page and go to
		 * index.html instead.
		 */
		if (!welcomePagePresent) {
			return "index";
		}
		/* otherwise rener the landing page */
		else {
			model.addAllAttributes(welcomeMap);
			return "welcome";
		}
	}

	/*
	 * Renders with Thymeleaf
	 * 
	 * Renders statich HTML if whatever is in demo.html, used for experimenting with
	 * HTML snippets.
	 * 
	 * Renders files in './src/main/resources/templates/demo' folder.
	 */
	@RequestMapping(value = { "/demo/{file}" })
	public String demo(@PathVariable(value = "file", required = false) String file, //
			Model model) {
		// if in DEV mode we always update cache buster in case files have changed.
		if (constProvider.getProfileName().equals("dev")) {
			initCacheBuster();
		}

		// if (welcomeMap == null ||
		// PrincipalName.ADMIN.s().equals(sessionContext.getUserName())) {
		// synchronized (welcomeMapLock) {
		// HashMap<String, String> newMap = new HashMap<String, String>();
		// welcomePagePresent = nodeRenderService.thymeleafRenderNode(newMap,
		// "pg_welcome");
		// welcomeMap = newMap;
		// }
		// }

		model.addAllAttributes(cacheBusterMd5);
		return "demo/" + file;
	}

	/*
	 * DO NOT DELETE: Leave as example for how to render plain HTML directly from a
	 * string
	 */
	@GetMapping(value = { "/sp/{systemPage}" }, produces = MediaType.TEXT_HTML_VALUE)
	public @ResponseBody String systemPage(@PathVariable(value = "systemPage", required = false) String systemPage) {
		return "<html><body>My Full Page: " + systemPage + "</body></html>";
	}

	@RequestMapping(value = API_PATH + "/signup", method = RequestMethod.POST)
	public @ResponseBody Object signup(@RequestBody SignupRequest req, HttpSession session) {
		return callProc.run("signup", req, session, ms -> {
			return userManagerService.signup(req, false);
		});
	}

	@RequestMapping(value = API_PATH + "/login", method = RequestMethod.POST)
	public @ResponseBody Object login(@RequestBody LoginRequest req, HttpSession session) {
		return callProc.run("login", req, session, ms -> {
			return userManagerService.login(null, req);
		});
	}

	@RequestMapping(value = API_PATH + "/closeAccount", method = RequestMethod.POST)
	public @ResponseBody Object closeAccount(@RequestBody CloseAccountRequest req, HttpSession session) {
		return callProc.run("closeAccount", req, session, ms -> {
			CloseAccountResponse res = userManagerService.closeAccount(req);
			SessionContext sessionContext = (SessionContext) SpringContextUtil.getBean(SessionContext.class);
			if (sessionContext != null) {
				sessionContext.setHttpSessionToInvalidate(session);
			}
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/logout", method = RequestMethod.POST)
	public @ResponseBody Object logout(@RequestBody LogoutRequest req, HttpSession session) {
		return callProc.run("logout", req, session, ms -> {
			session.invalidate();
			LogoutResponse res = new LogoutResponse();
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/renderCalendar", method = RequestMethod.POST)
	public @ResponseBody Object renderCalendarNodes(@RequestBody RenderCalendarRequest req, //
			HttpServletRequest httpReq, HttpSession session) {
		return callProc.run("renderCalendar", req, session, ms -> {
			return nodeRenderService.renderCalendar(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/renderNode", method = RequestMethod.POST)
	public @ResponseBody Object renderNode(@RequestBody RenderNodeRequest req, //
			HttpServletRequest httpReq, HttpSession session) {
		return callProc.run("renderNode", req, session, ms -> {
			return nodeRenderService.renderNode(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/initNodeEdit", method = RequestMethod.POST)
	public @ResponseBody Object initNodeEdit(@RequestBody InitNodeEditRequest req, HttpSession session) {
		return callProc.run("initNodeEdit", req, session, ms -> {
			return nodeRenderService.initNodeEdit(ms, req);
		});
	}

	/*
	 * Called when user does drag-n-drop onto the application window
	 * 
	 * NOTE: Looks like this is currently not enabled in TypeScript
	 */
	@RequestMapping(value = API_PATH + "/appDrop", method = RequestMethod.POST)
	public @ResponseBody Object appDrop(@RequestBody AppDropRequest req, HttpSession session) {
		return callProc.run("appDrop", req, session, ms -> {
			return nodeEditService.appDrop(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/getNodePrivileges", method = RequestMethod.POST)
	public @ResponseBody Object getNodePrivileges(@RequestBody GetNodePrivilegesRequest req, HttpSession session) {
		return callProc.run("getNodePrivileges", req, session, ms -> {
			return aclService.getNodePrivileges(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/getBreadcrumbs", method = RequestMethod.POST)
	public @ResponseBody Object getBreadcrumbs(@RequestBody GetBreadcrumbsRequest req, HttpSession session) {
		return callProc.run("getBreadcrumbs", req, session, ms -> {
			return nodeRenderService.getBreadcrumbs(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/getFriends", method = RequestMethod.POST)
	public @ResponseBody Object getFriends(@RequestBody GetFriendsRequest req, HttpSession session) {
		return callProc.run("getFriends", req, session, ms -> {
			return userManagerService.getFriends(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/addPrivilege", method = RequestMethod.POST)
	public @ResponseBody Object addPrivilege(@RequestBody AddPrivilegeRequest req, HttpSession session) {
		return callProc.run("addPrivilege", req, session, ms -> {
			return aclService.addPrivilege(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/removePrivilege", method = RequestMethod.POST)
	public @ResponseBody Object removePrivilege(@RequestBody RemovePrivilegeRequest req, HttpSession session) {
		return callProc.run("removePrivilege", req, session, ms -> {
			return aclService.removePrivilege(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/savePublicKey", method = RequestMethod.POST)
	public @ResponseBody Object savePublicKey(@RequestBody SavePublicKeyRequest req, HttpSession session) {
		return callProc.run("addPrivilege", req, session, ms -> {
			return userManagerService.savePublicKey(req);
		});
	}

	@RequestMapping(value = API_PATH + "/setCipherKey", method = RequestMethod.POST)
	public @ResponseBody Object setCipherKey(@RequestBody SetCipherKeyRequest req, HttpSession session) {
		return callProc.run("setCipherKey", req, session, ms -> {
			return aclService.setCipherKey(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/export", method = RequestMethod.POST)
	public @ResponseBody Object export(@RequestBody ExportRequest req, HttpSession session) {
		return callProc.run("export", req, session, ms -> {
			ExportResponse res = new ExportResponse();

			if ("pdf".equalsIgnoreCase(req.getExportExt())) {
				/*
				 * NOTE: The original implementation of PDF export is in ExportPdfServicePdfBox
				 * and us the one using PDFBox, but the newest version is the one using
				 * https://github.com/vsch/flexmark-java, and is the one currently in use
				 */
				ExportServiceFlexmark svc = (ExportServiceFlexmark) SpringContextUtil
						.getBean(ExportServiceFlexmark.class);
				svc.export(ms, "pdf", req, res);
			} //
			else if ("html".equalsIgnoreCase(req.getExportExt())) {
				ExportServiceFlexmark svc = (ExportServiceFlexmark) SpringContextUtil
						.getBean(ExportServiceFlexmark.class);
				svc.export(ms, "html", req, res);
			} //
			else if ("md".equalsIgnoreCase(req.getExportExt())) {
				ExportTextService svc = (ExportTextService) SpringContextUtil.getBean(ExportTextService.class);
				svc.export(ms, req, res);
			} //
			else if ("zip".equalsIgnoreCase(req.getExportExt())) {
				ExportZipService svc = (ExportZipService) SpringContextUtil.getBean(ExportZipService.class);
				svc.export(ms, req, res);
			} //
			else if ("tar".equalsIgnoreCase(req.getExportExt())) {
				ExportTarService svc = (ExportTarService) SpringContextUtil.getBean(ExportTarService.class);
				svc.export(ms, req, res);
			} //
			else if ("tar.gz".equalsIgnoreCase(req.getExportExt())) {
				ExportTarService svc = (ExportTarService) SpringContextUtil.getBean(ExportTarService.class);
				svc.setUseGZip(true);
				svc.export(ms, req, res);
			} //
			else {
				throw ExUtil.wrapEx("Unsupported file extension: " + req.getExportExt());
			}
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/transferNode", method = RequestMethod.POST)
	public @ResponseBody Object transferNode(@RequestBody TransferNodeRequest req, HttpSession session) {
		return callProc.run("export", req, session, ms -> {
			return nodeEditService.transferNode(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/streamImport", method = RequestMethod.POST)
	public @ResponseBody Object streamImport(//
			@RequestParam(value = "nodeId", required = true) String nodeId, //
			@RequestParam(value = "files", required = true) MultipartFile[] uploadFiles, HttpSession session) {
		return callProc.run("upload", null, session, ms -> {
			return importService.streamImport(ms, nodeId, uploadFiles);
		});
	}

	@RequestMapping(value = API_PATH + "/setNodePosition", method = RequestMethod.POST)
	public @ResponseBody Object setNodePosition(@RequestBody SetNodePositionRequest req, HttpSession session) {
		return callProc.run("setNodePosition", req, session, ms -> {
			return nodeMoveService.setNodePosition(ms, req);
		});
	}

	/* Creates a new node as a child of the specified node */
	@RequestMapping(value = API_PATH + "/createSubNode", method = RequestMethod.POST)
	public @ResponseBody Object createSubNode(@RequestBody CreateSubNodeRequest req, HttpSession session) {
		return callProc.run("createSubNode", req, session, ms -> {
			return nodeEditService.createSubNode(ms, req);
		});
	}

	/*
	 * Inserts node 'inline' at the position specified in the
	 * InsertNodeRequest.targetName
	 */
	@RequestMapping(value = API_PATH + "/insertNode", method = RequestMethod.POST)
	public @ResponseBody Object insertNode(@RequestBody InsertNodeRequest req, HttpSession session) {
		return callProc.run("insertNode", req, session, ms -> {
			return nodeEditService.insertNode(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/insertBook", method = RequestMethod.POST)
	public @ResponseBody Object insertBook(@RequestBody InsertBookRequest req, HttpSession session) {
		return callProc.run("insertBook", req, session, ms -> {
			if (!sessionContext.isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}

			return importBookService.insertBook(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/executeNode", method = RequestMethod.POST)
	public @ResponseBody Object executeNode(@RequestBody ExecuteNodeRequest req, HttpSession session) {
		return callProc.run("executeNode", req, session, ms -> {
			ExecuteNodeResponse res = new ExecuteNodeResponse();

			if (!sessionContext.isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}

			// todo-1: disabling pending security audit.
			// bashService.executeNode(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/deleteNodes", method = RequestMethod.POST)
	public @ResponseBody Object deleteNodes(@RequestBody DeleteNodesRequest req, HttpSession session) {
		return callProc.run("deleteNodes", req, session, ms -> {
			return nodeMoveService.deleteNodes(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/selectAllNodes", method = RequestMethod.POST)
	public @ResponseBody Object selectAllNodes(@RequestBody SelectAllNodesRequest req, HttpSession session) {
		return callProc.run("selectAllNodes", req, session, ms -> {
			return nodeMoveService.selectAllNodes(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/moveNodes", method = RequestMethod.POST)
	public @ResponseBody Object moveNodes(@RequestBody MoveNodesRequest req, HttpSession session) {
		return callProc.run("moveNodes", req, session, ms -> {
			return nodeMoveService.moveNodes(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/deleteProperty", method = RequestMethod.POST)
	public @ResponseBody Object deleteProperty(@RequestBody DeletePropertyRequest req, HttpSession session) {
		return callProc.run("deleteProperty", req, session, ms -> {
			return nodeEditService.deleteProperty(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/saveNode", method = RequestMethod.POST)
	public @ResponseBody Object saveNode(@RequestBody SaveNodeRequest req, HttpSession session) {
		return callProc.run("saveNode", req, session, ms -> {
			return nodeEditService.saveNode(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/changePassword", method = RequestMethod.POST)
	public @ResponseBody Object changePassword(@RequestBody ChangePasswordRequest req, HttpSession session) {
		return callProc.run("changePassword", req, session, ms -> {
			return userManagerService.changePassword(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/resetPassword", method = RequestMethod.POST)
	public @ResponseBody Object resetPassword(@RequestBody ResetPasswordRequest req, HttpSession session) {
		return callProc.run("resetPassword", req, session, ms -> {
			return userManagerService.resetPassword(req);
		});
	}

	/*
	 * binId param not uses currently but the client will send either the gridId or
	 * the ipfsHash of the node depending on which type of attachment it sees on the
	 * node
	 */
	@RequestMapping(value = API_PATH + "/bin/{binId}", method = RequestMethod.GET)
	public void getBinary(@PathVariable("binId") String binId, //
			@RequestParam("nodeId") String nodeId, //
			// The "Export To PDF" feature relies on sending this 'token' as it's form of
			// access/auth
			@RequestParam(value = "token", required = false) String token, //
			@RequestParam(value = "download", required = false) String download, //
			HttpSession session, HttpServletResponse response) {

		if (token == null) {
			callProc.run("bin", null, session, ms -> {
				attachmentService.getBinary(null, nodeId, download != null, response);
				return null;
			});
		} else {
			if (SessionContext.validToken(token)) {
				adminRunner.run(mongoSession -> {
					attachmentService.getBinary(mongoSession, nodeId, download != null, response);
				});
			}
		}
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
	public void getFile(//
			@PathVariable("fileName") String fileName, //
			@RequestParam(name = "disp", required = false) String disposition, //
			HttpSession session, HttpServletResponse response) {
		callProc.run("file", null, session, ms -> {
			attachmentService.getFile(ms, fileName, disposition, response);
			return null;
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
	public Object getFileSystemResourceStream(//
			@PathVariable("nodeId") String nodeId, //
			@RequestParam(name = "disp", required = false) String disposition, //
			HttpSession session) {
		return callProc.run("filesys", null, session, ms -> {
			return attachmentService.getFileSystemResourceStream(ms, nodeId, disposition);
		});
	}

	/*
	 * This endpoint serves up large media files efficiently and supports seeking,
	 * so that the fast-foward, rewind, seeking in video players works!!!
	 */
	@RequestMapping(value = API_PATH + "/filesys/{nodeId}", method = RequestMethod.GET)
	public void getFileSystemResourceStreamMultiPart(//
			@PathVariable("nodeId") String nodeId, //
			@RequestParam(name = "disp", required = false) String disposition, //
			HttpServletRequest request, HttpServletResponse response, //
			HttpSession session) {
		callProc.run("filesys", null, session, ms -> {
			// disabling file reading for now.
			// attachmentService.getFileSystemResourceStreamMultiPart(ms, nodeId,
			// disposition, request, response);
			return null;
		});
	}

	@RequestMapping(value = API_PATH + "/stream/{fileName}", method = RequestMethod.GET)
	public void streamMultiPart(//
			@PathVariable("fileName") String fileName, //
			@RequestParam("nodeId") String nodeId, @RequestParam(name = "disp", required = false) final String disp, //
			HttpServletRequest request, HttpServletResponse response, //
			HttpSession session) {
		callProc.run("stream", null, session, ms -> {
			attachmentService.getStreamMultiPart(ms, nodeId, disp != null ? disp : "inline", request, response);
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
	public @ResponseBody Object upload(//
			@RequestParam(value = "nodeId", required = true) String nodeId, //
			@RequestParam(value = "explodeZips", required = true) String explodeZips, //
			@RequestParam(value = "ipfs", required = true) String ipfs, //
			@RequestParam(value = "createAsChildren", required = true) String createAsChildren, //
			@RequestParam(value = "files", required = true) MultipartFile[] uploadFiles, //
			HttpSession session) {
		return callProc.run("upload", null, session, ms -> {
			// log.debug("Uploading as user: "+ms.getUser());
			return attachmentService.uploadMultipleFiles(ms, nodeId, uploadFiles, explodeZips.equalsIgnoreCase("true"),
					"true".equalsIgnoreCase(ipfs), "true".equalsIgnoreCase(createAsChildren));
		});
	}

	@RequestMapping(value = API_PATH + "/deleteAttachment", method = RequestMethod.POST)
	public @ResponseBody Object deleteAttachment(@RequestBody DeleteAttachmentRequest req, HttpSession session) {
		return callProc.run("deleteAttachment", req, session, ms -> {
			return attachmentService.deleteAttachment(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/uploadFromUrl", method = RequestMethod.POST)
	public @ResponseBody Object uploadFromUrl(@RequestBody UploadFromUrlRequest req, HttpSession session) {
		return callProc.run("uploadFromUrl", req, session, ms -> {
			return attachmentService.readFromUrl(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/anonPageLoad", method = RequestMethod.POST)
	public @ResponseBody Object anonPageLoad(@RequestBody RenderNodeRequest req, HttpSession session) {
		return callProc.run("anonPageLoad", req, session, ms -> {
			return nodeRenderService.anonPageLoad(null, req);
		});
	}

	@RequestMapping(value = API_PATH + "/nodeSearch", method = RequestMethod.POST)
	public @ResponseBody Object nodeSearch(@RequestBody NodeSearchRequest req, HttpSession session) {
		return callProc.run("nodeSearch", req, session, ms -> {
			return nodeSearchService.search(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/nodeFeed", method = RequestMethod.POST)
	public @ResponseBody Object nodeFeed(@RequestBody NodeFeedRequest req, HttpSession session) {
		return callProc.run("nodeFeed", req, session, ms -> {
			return userFeedService.nodeFeed(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/getSharedNodes", method = RequestMethod.POST)
	public @ResponseBody Object getSharedNodes(@RequestBody GetSharedNodesRequest req, HttpSession session) {
		return callProc.run("getSharedNodes", req, session, ms -> {
			return nodeSearchService.getSharedNodes(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/saveUserPreferences", method = RequestMethod.POST)
	public @ResponseBody Object saveUserPreferences(@RequestBody SaveUserPreferencesRequest req, HttpSession session) {
		return callProc.run("saveUserPreferences", req, session, ms -> {
			return userManagerService.saveUserPreferences(req);
		});
	}

	@RequestMapping(value = API_PATH + "/getUserProfile", method = RequestMethod.POST)
	public @ResponseBody Object getUserProfile(@RequestBody GetUserProfileRequest req, HttpSession session) {
		return callProc.run("getUserProfile", req, session, ms -> {
			return userManagerService.getUserProfile(req);
		});
	}

	@RequestMapping(value = API_PATH + "/saveUserProfile", method = RequestMethod.POST)
	public @ResponseBody Object saveUserProfile(@RequestBody SaveUserProfileRequest req, HttpSession session) {
		return callProc.run("saveUserProfile", req, session, ms -> {
			return userManagerService.saveUserProfile(req);
		});
	}

	@RequestMapping(value = API_PATH + "/getUserAccountInfo", method = RequestMethod.POST)
	public @ResponseBody Object getUserAccountInfo(@RequestBody GetUserAccountInfoRequest req, HttpSession session) {
		return callProc.run("getUserAcccountInfo", req, session, ms -> {
			return userManagerService.getUserAccountInfo(req);
		});
	}

	@RequestMapping(value = API_PATH + "/getServerInfo", method = RequestMethod.POST)
	public @ResponseBody Object getServerInfo(@RequestBody GetServerInfoRequest req, HttpSession session) {
		return callProc.run("getServerInfo", req, session, ms -> {
			GetServerInfoResponse res = new GetServerInfoResponse();
			res.setMessages(new LinkedList<InfoMessage>());

			if (req.getCommand().equalsIgnoreCase("getJson")) {
				// allow this one if user owns node.
			} else if (!sessionContext.isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}

			log.debug("Command: " + req.getCommand());

			if (req.getCommand().equalsIgnoreCase("ipfsGetNodeInfo")) {
				res.getMessages().add(new InfoMessage(ipfsService.getNodeInfo(ms, req.getNodeId()), null));
			} else if (req.getCommand().equalsIgnoreCase("compactDb")) {
				res.getMessages().add(new InfoMessage(systemService.compactDb(), null));
			} else if (req.getCommand().equalsIgnoreCase("initializeAppContent")) {
				log.error("initializeAppContent is obsolet, and was also refactored without being retested");
				// res.setServerInfo(systemService.initializeAppContent());
			} else if (req.getCommand().equalsIgnoreCase("getServerInfo")) {
				res.getMessages().add(new InfoMessage(systemService.getSystemInfo(), null));
			} else if (req.getCommand().equalsIgnoreCase("getJson")) {
				res.getMessages().add(new InfoMessage(systemService.getJson(ms, req.getNodeId()), null));
			} else {
				throw new RuntimeEx("Invalid command: " + req.getCommand());
			}
			res.setSuccess(true);

			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/luceneIndex", method = RequestMethod.POST)
	public @ResponseBody Object luceneIndex(@RequestBody LuceneIndexRequest req, HttpSession session) {
		return callProc.run("luceneIndex", req, session, ms -> {
			if (!sessionContext.isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
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
			return luceneService.reindex(ms, req.getNodeId(), req.getPath());
		});
	}

	@RequestMapping(value = API_PATH + "/luceneSearch", method = RequestMethod.POST)
	public @ResponseBody Object luceneSearch(@RequestBody LuceneSearchRequest req, HttpSession session) {
		return callProc.run("luceneSearch", req, session, ms -> {
			return luceneService.search(ms, req.getNodeId(), req.getText());
		});
	}

	@RequestMapping(value = API_PATH + "/getNotifications", method = RequestMethod.POST)
	public @ResponseBody Object getNotifications(@RequestBody GetServerInfoRequest req, HttpSession session) {
		return callProc.run("getNotifications", req, session, ms -> {
			GetServerInfoResponse res = new GetServerInfoResponse();
			res.setMessages(new LinkedList<InfoMessage>());

			if (sessionContext.getError() != null) {
				res.getMessages().add(new InfoMessage(sessionContext.getError(), null));
				sessionContext.setError(null);
			}

			String inboxMessage = userManagerService.getInboxNotification(ms);
			if (inboxMessage != null) {
				res.getMessages().add(new InfoMessage(inboxMessage, "inbox"));
			}

			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/ping", method = RequestMethod.POST)
	public @ResponseBody Object ping(@RequestBody PingRequest req, HttpSession session) {
		return callProc.run("ping", req, session, ms -> {
			PingResponse res = new PingResponse();
			res.setServerInfo("Server: t=" + System.currentTimeMillis());
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/rebuildIndexes", method = RequestMethod.POST)
	public @ResponseBody Object rebuildIndexes(@RequestBody RebuildIndexesRequest req, HttpSession session) {
		return callProc.run("rebuildIndexes", req, session, ms -> {
			RebuildIndexesResponse res = new RebuildIndexesResponse();
			if (!sessionContext.isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}

			adminRunner.run(mongoSession -> {
				mongoUtil.rebuildIndexes(mongoSession);
			});

			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/shutdownServerNode", method = RequestMethod.POST)
	public @ResponseBody Object shutdownServerNode(@RequestBody ShutdownServerNodeRequest req, HttpSession session) {
		return callProc.run("shutdownServerNode", req, session, ms -> {
			ShutdownServerNodeResponse res = new ShutdownServerNodeResponse();
			if (!sessionContext.isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
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
	public @ResponseBody Object sendTestEmail(@RequestBody SendTestEmailRequest req, HttpSession session) {
		return callProc.run("sendTestEmail", req, session, ms -> {
			SendTestEmailResponse res = new SendTestEmailResponse();
			if (!sessionContext.isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}
			log.debug("SendEmailTest detected on server.");

			String timeString = new Date().toString();
			synchronized (MailSender.getLock()) {
				try {
					mailSender.init();
					mailSender.sendMail("wclayf@gmail.com", null, "<h1>Hello from Quanta! Time=" + timeString + "</h1>",
							"Test Subject");
				} finally {
					mailSender.close();
				}
			}
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/splitNode", method = RequestMethod.POST)
	public @ResponseBody Object splitNode(@RequestBody SplitNodeRequest req, HttpSession session) {
		return callProc.run("splitNode", req, session, ms -> {
			return nodeEditService.splitNode(ms, req);
		});
	}

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
		SseEmitter pushEmitter = new SseEmitter();
		sessionContext.setPushEmitter(pushEmitter);
		return pushEmitter;
	}
}
