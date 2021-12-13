package quanta;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
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
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import quanta.actpub.ActPubFollower;
import quanta.actpub.ActPubFollowing;
import quanta.actpub.ActPubService;
import quanta.config.AppProp;
import quanta.config.SessionContext;
import quanta.config.SpringContextUtil;
import quanta.exception.base.RuntimeEx;
import quanta.mail.EmailSender;
import quanta.model.client.NodeProp;
import quanta.model.client.PrincipalName;
import quanta.mongo.AdminRun;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoRepository;
import quanta.mongo.model.SubNode;
import quanta.request.AddFriendRequest;
import quanta.request.AddPrivilegeRequest;
import quanta.request.AppDropRequest;
import quanta.request.BlockUserRequest;
import quanta.request.ChangePasswordRequest;
import quanta.request.CheckMessagesRequest;
import quanta.request.CloseAccountRequest;
import quanta.request.CreateSubNodeRequest;
import quanta.request.DeleteAttachmentRequest;
import quanta.request.DeleteFriendRequest;
import quanta.request.DeleteNodesRequest;
import quanta.request.DeletePropertyRequest;
import quanta.request.ExportRequest;
import quanta.request.GetBookmarksRequest;
import quanta.request.GetConfigRequest;
import quanta.request.GetFollowersRequest;
import quanta.request.GetFollowingRequest;
import quanta.request.GetFriendsRequest;
import quanta.request.GetMultiRssRequest;
import quanta.request.GetNodeMetaInfoRequest;
import quanta.request.GetNodePrivilegesRequest;
import quanta.request.GetNodeStatsRequest;
import quanta.request.GetOpenGraphRequest;
import quanta.request.GetServerInfoRequest;
import quanta.request.GetSharedNodesRequest;
import quanta.request.GetUserAccountInfoRequest;
import quanta.request.GetUserProfileRequest;
import quanta.request.GraphRequest;
import quanta.request.InitNodeEditRequest;
import quanta.request.InsertBookRequest;
import quanta.request.InsertNodeRequest;
import quanta.request.JoinNodesRequest;
import quanta.request.LoadNodeFromIpfsRequest;
import quanta.request.LoginRequest;
import quanta.request.LogoutRequest;
import quanta.request.LuceneIndexRequest;
import quanta.request.LuceneSearchRequest;
import quanta.request.MoveNodesRequest;
import quanta.request.NodeFeedRequest;
import quanta.request.NodeSearchRequest;
import quanta.request.PingRequest;
import quanta.request.PublishNodeToIpfsRequest;
import quanta.request.RemovePrivilegeRequest;
import quanta.request.RenderCalendarRequest;
import quanta.request.RenderNodeRequest;
import quanta.request.ResetPasswordRequest;
import quanta.request.SaveNodeRequest;
import quanta.request.SavePublicKeyRequest;
import quanta.request.SaveUserPreferencesRequest;
import quanta.request.SaveUserProfileRequest;
import quanta.request.SearchAndReplaceRequest;
import quanta.request.SelectAllNodesRequest;
import quanta.request.SendTestEmailRequest;
import quanta.request.SetCipherKeyRequest;
import quanta.request.SetNodePositionRequest;
import quanta.request.SignupRequest;
import quanta.request.SplitNodeRequest;
import quanta.request.TransferNodeRequest;
import quanta.request.UpdateHeadingsRequest;
import quanta.request.UploadFromIPFSRequest;
import quanta.request.UploadFromTorrentRequest;
import quanta.request.UploadFromUrlRequest;
import quanta.response.CloseAccountResponse;
import quanta.response.ExportResponse;
import quanta.response.GetBookmarksResponse;
import quanta.response.GetConfigResponse;
import quanta.response.GetNodeStatsResponse;
import quanta.response.GetServerInfoResponse;
import quanta.response.GraphResponse;
import quanta.response.InfoMessage;
import quanta.response.LogoutResponse;
import quanta.response.PingResponse;
import quanta.response.SendTestEmailResponse;
import quanta.service.AclService;
import quanta.service.AttachmentService;
import quanta.service.ExportServiceFlexmark;
import quanta.service.ExportTarService;
import quanta.service.ExportTextService;
import quanta.service.ExportZipService;
import quanta.service.GraphNodesService;
import quanta.service.IPFSService;
import quanta.service.ImportBookService;
import quanta.service.ImportService;
import quanta.service.JSoupService;
import quanta.service.LuceneService;
import quanta.service.NodeEditService;
import quanta.service.NodeMoveService;
import quanta.service.NodeRenderService;
import quanta.service.NodeSearchService;
import quanta.service.RSSFeedService;

import quanta.service.SystemService;
import quanta.service.UserFeedService;
import quanta.service.UserManagerService;
import quanta.util.CaptchaMaker;
import quanta.util.Const;
import quanta.util.ExUtil;
import quanta.util.LimitedInputStreamEx;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import static quanta.util.Util.*;

/**
 * Primary Spring MVC controller. All application logic from the browser connects directly to this
 * controller which is the only controller. Importantly the main SPA page is retrieved thru this
 * controller, and the binary attachments are also served up thru this interface.
 *
 * This class has no documentation on the methods because it's a wrapper around the service methods
 * which is where the documentation can be found for each operation in here. It's a better
 * architecture to have all the AOP for any given aspect be in one particular layer, because of how
 * Spring AOP uses Proxies. Things can get pretty ugly when you have various proxied objects calling
 * other proxies objects, so we have all the AOP for a service call in this controller and then all
 * the services are pure and simple Spring Singletons.
 * 
 * There's a lot of boiler-plate code in here, but it's just required. This is probably the only
 * code in the system that looks 'redundant' (non-DRY), but this is because we want certain things
 * in certain layers (abstraction related and for loose-coupling).
 */
@Controller
public class AppController  implements ErrorController {
	private static final Logger log = LoggerFactory.getLogger(AppController.class);

	@Autowired
	protected IPFSService ipfs;

	@Autowired
	protected GraphNodesService graphNodes;

	@Autowired
	protected ImportBookService importBookService;

	@Autowired
	protected ImportService importService;

	@Autowired
	protected LuceneService lucene;

	@Autowired
	protected SystemService system;

	@Autowired
	protected RSSFeedService rssFeed;

	@Autowired
	protected UserFeedService userFeed;

	@Autowired
	protected JSoupService jsoup;

	@Autowired
	protected NodeMoveService move;

	@Autowired
	protected NodeSearchService search;

	@Autowired
	protected EmailSender mail;

	@Autowired
	protected NodeEditService edit;

	@Autowired
	protected ActPubFollower apFollower;

	@Autowired
	protected ActPubFollowing apFollowing;

	@Autowired
	protected ActPubService apub;

	@Autowired
	protected NodeRenderService render;

	@Autowired
	protected AttachmentService attach;

	@Autowired
	protected AdminRun arun;

	@Autowired
	protected AppProp prop;

	@Autowired
	protected UserManagerService user;

	@Autowired
	protected AclService acl;

	@Autowired
	protected MongoRead read;

	public static final String API_PATH = "/mobile/api";

	private static boolean THYMELEAF_VARS_FROM_TREE = false;
	private static HashMap<String, String> welcomeMap = null;
	private static final Object welcomeMapLock = new Object();

	// maps classpath resource names to their md5 values
	private static HashMap<String, String> thymeleafAttribs = null;

	/*
	 * RestTemplate is thread-safe and reusable, and has no state, so we need only one final static
	 * instance ever
	 */
	private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory(10000));

	@Autowired
	private CallProcessor callProc;

	// NOTE: server.error.path app property points to this.
	private static final String ERROR_MAPPING = "/error";

	@RequestMapping(value = ERROR_MAPPING)
	public String error(Model model) {
		init();
		model.addAttribute("hostAndPort", prop.getHostAndPort());
		model.addAllAttributes(thymeleafAttribs);
		// pulls up error.html
		return "error";
	}

	public void init() {
		initThymeleafAttribs();
	}

	public void initThymeleafAttribs() {
		if (prop.getProfileName().equals("dev")) {
			// force reload of attribs
			thymeleafAttribs = null;
		}

		if (ok(thymeleafAttribs))
			return;

		thymeleafAttribs = new HashMap<>();

		thymeleafAttribs.put("instanceId", prop.getInstanceId());
		thymeleafAttribs.put("brandingAppName", prop.getConfigText("brandingAppName"));
		thymeleafAttribs.put("brandingMetaContent", prop.getConfigText("brandingMetaContent"));
		thymeleafAttribs.put("hostUrl", prop.getProtocolHostAndPort());
		thymeleafAttribs.put("introSubtitle", prop.getConfigText("introSubtitle"));
		thymeleafAttribs.put("intro1", prop.getConfigText("intro1"));
		thymeleafAttribs.put("intro2", prop.getConfigText("intro2"));
	}

	/*
	 * This is the actual app page loading request, for his SPA (Single Page Application) this is the
	 * request to load the page.
	 * 
	 * ID is optional url parameter that user can specify to access a specific node
	 * 
	 * passCode is an auth code for a password reset
	 * 
	 * Renders with Thymeleaf
	 */
	@RequestMapping(value = {"/app", "/n/{nameOnAdminNode}", "/u/{userName}/{nameOnUserNode}"})
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
			if (!MongoRepository.fullInit) {
				throw new RuntimeException("Server temporarily offline.");
			}
			initThymeleafAttribs();

			// log.debug("AppController.index: sessionUser=" +
			// sessionContext.getUserName());
			model.addAllAttributes(thymeleafAttribs);

			// Node Names are identified using a colon in front of it, to make it detectable
			if (!StringUtils.isEmpty(nameOnUserNode) && !StringUtils.isEmpty(userName)) {
				id = ":" + userName + ":" + nameOnUserNode;
			} else if (!StringUtils.isEmpty(nameOnAdminNode)) {
				id = ":" + nameOnAdminNode;
			} else if (!StringUtils.isEmpty(name)) {
				id = ":" + name;
			}

			if (ok(id)) {
				ThreadLocals.getSC().setUrlId(id);
				// log.debug("ID specified on url=" + id);
				String _id = id;
				arun.run(ms -> {
					// we don't check ownership of node at this time, but merely check sanity of
					// whether this ID is even existing or not.
					SubNode node = read.getNode(ms, _id);
					render.populateSocialCardProps(node, model);
					if (no(node)) {
						log.debug("Node did not exist.");
						ThreadLocals.getSC().setUrlId(null);
					} else {
						// log.debug("Node exists.");
					}
					return null;
				});
			} else {
				ThreadLocals.getSC().setUrlId(null);
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
	@RequestMapping(value = {"/"})
	public String welcome(@RequestParam(value = "signupCode", required = false) String signupCode, //
			Model model) {
		if (!MongoRepository.fullInit) {
			throw new RuntimeException("Server temporarily offline.");
		}
		initThymeleafAttribs();

		// NOTE: Not currently used. For now we are not initializing any of these page
		// properties from the
		// tree (database)
		if (THYMELEAF_VARS_FROM_TREE) {
			/*
			 * Note: this refreshes only when ADMIN is accessing it, so it's slow in this case.
			 */
			if (no(welcomeMap) || PrincipalName.ADMIN.s().equals(ThreadLocals.getSC().getUserName())) {
				synchronized (welcomeMapLock) {
					HashMap<String, String> newMap = new HashMap<>();
					// load content from a place that will not be a node visible to users
					// leaving this commented here to show where/how to use it if needed in the
					// future.
					// nodeRenderService.thymeleafRenderNode(newMap, "pg_welcome");
					welcomeMap = newMap;
				}
			}
			model.addAllAttributes(welcomeMap);
		}

		if (ok(signupCode)) {
			String signupResponse = user.processSignupCode(signupCode);
			model.addAttribute("signupResponse", signupResponse);
		}

		model.addAllAttributes(thymeleafAttribs);
		return "welcome";
	}

	/*
	 * Renders with Thymeleaf
	 * 
	 * Renders statich HTML if whatever is in demo.html, used for experimenting with HTML snippets.
	 * 
	 * Renders files in './src/main/resources/templates/demo' folder.
	 */
	@RequestMapping(value = {"/demo/{file}"})
	public String demo(@PathVariable(value = "file", required = false) String file, //
			Model model) {
		initThymeleafAttribs();

		// if (no(welcomeMap) ||
		// PrincipalName.ADMIN.s().equals(sessionContext.getUserName())) {
		// synchronized (welcomeMapLock) {
		// HashMap<String, String> newMap = new HashMap<>();
		// welcomePagePresent = nodeRenderService.thymeleafRenderNode(newMap,
		// "pg_welcome");
		// welcomeMap = newMap;
		// }
		// }

		model.addAllAttributes(thymeleafAttribs);
		return "demo/" + file;
	}

	/*
	 * DO NOT DELETE: Leave as example for how to render plain HTML directly from a string
	 */
	@GetMapping(value = {"/sp/{systemPage}"}, produces = MediaType.TEXT_HTML_VALUE)
	public @ResponseBody String systemPage(@PathVariable(value = "systemPage", required = false) String systemPage) {
		return "<html><body>My Full Page: " + systemPage + "</body></html>";
	}

	@GetMapping(value = {"/fediverse-users"}, produces = MediaType.TEXT_PLAIN_VALUE)
	public @ResponseBody String fediverseUsers() {
		return apub.dumpFediverseUsers();
	}

	@GetMapping(value = {"/performance-report"}, produces = MediaType.TEXT_PLAIN_VALUE)
	public @ResponseBody String performanceReport() {
		return system.getPerformancerReport();
	}

	@GetMapping(value = {"/multiRss"}, produces = MediaType.APPLICATION_RSS_XML_VALUE)
	public void multiRss(@RequestParam(value = "id", required = true) String nodeId, //
			HttpServletResponse response) {
		arun.run(ms -> {
			try {
				rssFeed.multiRss(ms, nodeId, response.getWriter());
			} catch (Exception e) {
				throw new RuntimeException("internal server error");
			}
			return null;
		});
	}

	/*
	 * This was sort of experimental, but I need to document how it works and put in the User Guide
	 */
	@GetMapping(value = {"/rss"}, produces = MediaType.APPLICATION_RSS_XML_VALUE)
	public void getRss(@RequestParam(value = "id", required = true) String nodeId, //
			HttpServletResponse response, //
			HttpSession session) {
		callProc.run("rss", null, session, ms -> {
			arun.run(as -> {
				try {
					rssFeed.getRssFeed(as, nodeId, response.getWriter());
				} catch (Exception e) {
					throw new RuntimeException("internal server error");
				}
				return null;
			});
			return null;
		});
	}

	/*
	 * Proxies an HTTP GET thru to the specified url. Used to avoid CORS errors when retrieving RSS
	 * directly from arbitrary servers
	 * 
	 * todo-2: need a 'useCache' url param option
	 */
	@GetMapping(value = {"/proxyGet"})
	public void proxyGet(@RequestParam(value = "url", required = true) String url, //
			HttpSession session, HttpServletResponse response//
	) {
		callProc.run("proxyGet", null, session, ms -> {
			try {
				// try to get proxy info from cache.
				byte[] cacheBytes = null;
				synchronized (RSSFeedService.proxyCache) {
					cacheBytes = RSSFeedService.proxyCache.get(url);
				}

				if (ok(cacheBytes)) {
					// limiting the stream just becasue for now this is only used in feed
					// processing, and 5MB is plenty
					IOUtils.copy(new LimitedInputStreamEx(new ByteArrayInputStream(cacheBytes), 50 * Const.ONE_MB),
							response.getOutputStream());
				}
				// not in cache then read and update cache
				else {
					ResponseEntity<byte[]> resp = restTemplate.getForEntity(new URI(url), byte[].class);
					response.setStatus(HttpStatus.OK.value());

					byte[] body = resp.getBody();
					synchronized (RSSFeedService.proxyCache) {
						RSSFeedService.proxyCache.put(url, body);
					}

					IOUtils.copy(new ByteArrayInputStream(body), response.getOutputStream());

					// DO NOT DELETE (good example)
					// restTemplate.execute(url, HttpMethod.GET, (ClientHttpRequest requestCallback)
					// -> {
					// }, responseExtractor -> {
					// IOUtils.copy(responseExtractor.getBody(), response.getOutputStream());
					// return null;
					// });
				}
			} catch (Exception e) {
				// throw new RuntimeException("internal server error");
			}
			return null;
		});
	}

	@RequestMapping(value = API_PATH + "/getMultiRssFeed", method = RequestMethod.POST)
	public @ResponseBody Object getMultiRssFeed(@RequestBody GetMultiRssRequest req, HttpSession session) {
		return callProc.run("getMultiRssFeed", req, session, ms -> {
			return arun.run(as -> {
				// log.debug("getMultiRssFeed: " + XString.prettyPrint(req));
				return rssFeed.getMultiRssFeed(req);
			});
		});
	}

	@RequestMapping(value = API_PATH + "/signup", method = RequestMethod.POST)
	public @ResponseBody Object signup(@RequestBody SignupRequest req, HttpSession session) {
		return callProc.run("signup", req, session, ms -> {
			return user.signup(req, false);
		});
	}

	@RequestMapping(value = API_PATH + "/login", method = RequestMethod.POST)
	public @ResponseBody Object login(@RequestBody LoginRequest req, HttpServletRequest httpReq, HttpSession session) {
		return callProc.run("login", req, session, ms -> {
			return user.login(httpReq, req);
		});
	}

	@RequestMapping(value = API_PATH + "/closeAccount", method = RequestMethod.POST)
	public @ResponseBody Object closeAccount(@RequestBody CloseAccountRequest req, HttpSession session) {
		return callProc.run("closeAccount", req, session, ms -> {
			CloseAccountResponse res = user.closeAccount(req);
			session.invalidate();
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/logout", method = RequestMethod.POST)
	public @ResponseBody Object logout(@RequestBody LogoutRequest req, HttpServletRequest sreq, HttpServletResponse sres,
			HttpSession session) {
		return callProc.run("logout", req, session, ms -> {
			ThreadLocals.getSC().forceAnonymous();

			// WARNING: ms will be null here always. Don't use.
			session.invalidate();

			Authentication auth = SecurityContextHolder.getContext().getAuthentication();
			if (ok(auth)) {
				new SecurityContextLogoutHandler().logout(sreq, sres, auth);
			}
			SecurityContextHolder.getContext().setAuthentication(null);

			LogoutResponse res = new LogoutResponse();
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/renderCalendar", method = RequestMethod.POST)
	public @ResponseBody Object renderCalendarNodes(@RequestBody RenderCalendarRequest req, //
			HttpServletRequest httpReq, HttpSession session) {
		return callProc.run("renderCalendar", req, session, ms -> {
			return render.renderCalendar(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/getNodeMetaInfo", method = RequestMethod.POST)
	public @ResponseBody Object getNodeMetaInfo(@RequestBody GetNodeMetaInfoRequest req, //
			HttpServletRequest httpReq, HttpSession session) {
		return callProc.run("rendergetNodeMetaInfoNode", req, session, ms -> {
			return render.getNodeMetaInfo(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/renderNode", method = RequestMethod.POST)
	public @ResponseBody Object renderNode(@RequestBody RenderNodeRequest req, //
			HttpServletRequest httpReq, HttpSession session) {
		return callProc.run("renderNode", req, session, ms -> {
			return render.renderNode(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/initNodeEdit", method = RequestMethod.POST)
	public @ResponseBody Object initNodeEdit(@RequestBody InitNodeEditRequest req, HttpSession session) {
		return callProc.run("initNodeEdit", req, session, ms -> {
			return render.initNodeEdit(ms, req);
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
			return edit.appDrop(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/getOpenGraph", method = RequestMethod.POST)
	public @ResponseBody Object getOpenGraph(@RequestBody GetOpenGraphRequest req, HttpSession session) {
		return jsoup.getOpenGraph(req);
	}

	@RequestMapping(value = API_PATH + "/getNodePrivileges", method = RequestMethod.POST)
	public @ResponseBody Object getNodePrivileges(@RequestBody GetNodePrivilegesRequest req, HttpSession session) {
		return callProc.run("getNodePrivileges", req, session, ms -> {
			return acl.getNodePrivileges(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/getFriends", method = RequestMethod.POST)
	public @ResponseBody Object getFriends(@RequestBody GetFriendsRequest req, HttpSession session) {
		return callProc.run("getFriends", req, session, ms -> {
			return user.getFriends(ms);
		});
	}

	@RequestMapping(value = API_PATH + "/addPrivilege", method = RequestMethod.POST)
	public @ResponseBody Object addPrivilege(@RequestBody AddPrivilegeRequest req, HttpSession session) {
		return callProc.run("addPrivilege", req, session, ms -> {
			return acl.addPrivilege(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/removePrivilege", method = RequestMethod.POST)
	public @ResponseBody Object removePrivilege(@RequestBody RemovePrivilegeRequest req, HttpSession session) {
		return callProc.run("removePrivilege", req, session, ms -> {
			return acl.removePrivilege(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/savePublicKey", method = RequestMethod.POST)
	public @ResponseBody Object savePublicKey(@RequestBody SavePublicKeyRequest req, HttpSession session) {
		return callProc.run("addPrivilege", req, session, ms -> {
			return user.savePublicKey(req);
		});
	}

	@RequestMapping(value = API_PATH + "/setCipherKey", method = RequestMethod.POST)
	public @ResponseBody Object setCipherKey(@RequestBody SetCipherKeyRequest req, HttpSession session) {
		return callProc.run("setCipherKey", req, session, ms -> {
			return acl.setCipherKey(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/export", method = RequestMethod.POST)
	public @ResponseBody Object export(@RequestBody ExportRequest req, HttpSession session) {
		return callProc.run("export", req, session, ms -> {
			ExportResponse res = new ExportResponse();

			/*
			 * We require that the node being exported is OWNED BY (not just visible to) the person doing the
			 * export, because this will potentially consume a lot of their storage quota and we don't want
			 * users just clicking things like the War and Peace book and trying to export that.
			 */
			arun.run(as -> {
				SubNode node = read.getNode(as, req.getNodeId());
				if (no(node))
					throw new RuntimeException("Node not found: " + req.getNodeId());

				if (!node.getOwner().toHexString().equals(ThreadLocals.getSC().getRootId())) {
					throw new RuntimeException("You can only export nodes you own");
				}
				return null;
			});

			if ("pdf".equalsIgnoreCase(req.getExportExt())) {
				ExportServiceFlexmark svc = (ExportServiceFlexmark) SpringContextUtil.getBean(ExportServiceFlexmark.class);
				svc.export(ms, "pdf", req, res);
			} //
			else if ("html".equalsIgnoreCase(req.getExportExt())) {
				ExportServiceFlexmark svc = (ExportServiceFlexmark) SpringContextUtil.getBean(ExportServiceFlexmark.class);
				svc.export(ms, "html", req, res);
			} //
			else if ("md".equalsIgnoreCase(req.getExportExt())) {
				if (req.isToIpfs()) {
					res.setMessage("Export of Markdown to IPFS not yet available.");
					res.setSuccess(false);
				}
				ExportTextService svc = (ExportTextService) SpringContextUtil.getBean(ExportTextService.class);
				svc.export(ms, req, res);
			} //
			else if ("zip".equalsIgnoreCase(req.getExportExt())) {
				if (req.isToIpfs()) {
					res.setMessage("Export of ZIP to IPFS not yet available.");
					res.setSuccess(false);
				}
				ExportZipService svc = (ExportZipService) SpringContextUtil.getBean(ExportZipService.class);
				svc.export(ms, req, res);
			} //
			else if ("tar".equalsIgnoreCase(req.getExportExt())) {
				if (req.isToIpfs()) {
					res.setMessage("Export of TAR to IPFS not yet available.");
					res.setSuccess(false);
				}
				ExportTarService svc = (ExportTarService) SpringContextUtil.getBean(ExportTarService.class);
				svc.export(ms, req, res);
			} //
			else if ("tar.gz".equalsIgnoreCase(req.getExportExt())) {
				if (req.isToIpfs()) {
					res.setMessage("Export of TAR.GZ to IPFS not yet available.");
					res.setSuccess(false);
				}
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
			if (!ThreadLocals.getSC().isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}
			return edit.transferNode(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/searchAndReplace", method = RequestMethod.POST)
	public @ResponseBody Object searchAndReplace(@RequestBody SearchAndReplaceRequest req, HttpSession session) {
		return callProc.run("searchAndReplace", req, session, ms -> {
			return edit.searchAndReplace(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/publishNodeToIpfs", method = RequestMethod.POST)
	public @ResponseBody Object publishNodeToIpfs(@RequestBody PublishNodeToIpfsRequest req, HttpSession session) {
		return callProc.run("publishNodeToIpfs", req, session, ms -> {
			return ipfs.publishNodeToIpfs(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/loadNodeFromIpfs", method = RequestMethod.POST)
	public @ResponseBody Object loadNodeFromIpfs(@RequestBody LoadNodeFromIpfsRequest req, HttpSession session) {
		return callProc.run("loadNodeFromIpfs", req, session, ms -> {
			return ipfs.loadNodeFromIpfs(ms, req);
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
			return move.setNodePosition(ms, req);
		});
	}

	/* Creates a new node as a child of the specified node */
	@RequestMapping(value = API_PATH + "/createSubNode", method = RequestMethod.POST)
	public @ResponseBody Object createSubNode(@RequestBody CreateSubNodeRequest req, HttpSession session) {
		return callProc.run("createSubNode", req, session, ms -> {
			return edit.createSubNode(ms, req);
		});
	}

	/*
	 * Inserts node 'inline' at the position specified in the InsertNodeRequest.targetName
	 */
	@RequestMapping(value = API_PATH + "/insertNode", method = RequestMethod.POST)
	public @ResponseBody Object insertNode(@RequestBody InsertNodeRequest req, HttpSession session) {
		return callProc.run("insertNode", req, session, ms -> {
			return edit.insertNode(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/insertBook", method = RequestMethod.POST)
	public @ResponseBody Object insertBook(@RequestBody InsertBookRequest req, HttpSession session) {
		return callProc.run("insertBook", req, session, ms -> {
			if (!ThreadLocals.getSC().isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}

			return importBookService.insertBook(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/deleteNodes", method = RequestMethod.POST)
	public @ResponseBody Object deleteNodes(@RequestBody DeleteNodesRequest req, HttpSession session) {
		return callProc.run("deleteNodes", req, session, ms -> {
			return move.deleteNodes(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/joinNodes", method = RequestMethod.POST)
	public @ResponseBody Object joinNodes(@RequestBody JoinNodesRequest req, HttpSession session) {
		return callProc.run("joinNodes", req, session, ms -> {
			return move.joinNodes(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/selectAllNodes", method = RequestMethod.POST)
	public @ResponseBody Object selectAllNodes(@RequestBody SelectAllNodesRequest req, HttpSession session) {
		return callProc.run("selectAllNodes", req, session, ms -> {
			return move.selectAllNodes(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/updateHeadings", method = RequestMethod.POST)
	public @ResponseBody Object updateHeadings(@RequestBody UpdateHeadingsRequest req, HttpSession session) {
		return callProc.run("updateHeadings", req, session, ms -> {
			return edit.updateHeadings(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/moveNodes", method = RequestMethod.POST)
	public @ResponseBody Object moveNodes(@RequestBody MoveNodesRequest req, HttpSession session) {
		return callProc.run("moveNodes", req, session, ms -> {
			return move.moveNodes(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/deleteProperties", method = RequestMethod.POST)
	public @ResponseBody Object deleteProperties(@RequestBody DeletePropertyRequest req, HttpSession session) {
		return callProc.run("deleteProperties", req, session, ms -> {
			return edit.deleteProperties(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/saveNode", method = RequestMethod.POST)
	public @ResponseBody Object saveNode(@RequestBody SaveNodeRequest req, HttpSession session) {
		return callProc.run("saveNode", req, session, ms -> {
			return edit.saveNode(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/changePassword", method = RequestMethod.POST)
	public @ResponseBody Object changePassword(@RequestBody ChangePasswordRequest req, HttpSession session) {
		return callProc.run("changePassword", req, session, ms -> {
			return user.changePassword(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/resetPassword", method = RequestMethod.POST)
	public @ResponseBody Object resetPassword(@RequestBody ResetPasswordRequest req, HttpSession session) {
		return callProc.run("resetPassword", req, session, ms -> {
			return user.resetPassword(req);
		});
	}

	/*
	 * An alternative way to get the binary attachment from a node allowing more friendly url format
	 * (named nodes)
	 */
	@RequestMapping(value = {"/f/id/{id}", "/f/{nameOnAdminNode}", "/f/{userName}/{nameOnUserNode}"})
	public void attachment(//
			// node name on 'admin' account. Non-admin named nodes use url
			// "/u/userName/nodeName"
			@PathVariable(value = "nameOnAdminNode", required = false) String nameOnAdminNode, //

			@PathVariable(value = "nameOnUserNode", required = false) String nameOnUserNode, //
			@PathVariable(value = "userName", required = false) String userName, //

			@PathVariable(value = "id", required = false) String id, //
			@RequestParam(value = "download", required = false) String download, //

			// gid is used ONLY for cache bustring so it can be the IPFS hash -or- the
			// gridId, we don't know or care which it is.
			@RequestParam(value = "gid", required = false) String gid, //
			HttpSession session, //
			HttpServletRequest req, //
			HttpServletResponse response) {
		try {

			// Node Names are identified using a colon in front of it, to make it detectable
			if (!StringUtils.isEmpty(nameOnUserNode) && !StringUtils.isEmpty(userName)) {
				id = ":" + userName + ":" + nameOnUserNode;
			} else if (!StringUtils.isEmpty(nameOnAdminNode)) {
				id = ":" + nameOnAdminNode;
			}

			if (ok(id)) {
				String _id = id;
				arun.run(ms -> {
					// we don't check ownership of node at this time, but merely check sanity of
					// whether this ID is even existing or not.
					SubNode node = read.getNode(ms, _id);

					String _gid = gid;

					// if no cachebuster gid was on url then redirect to a url that does have the
					// gid
					if (no(_gid)) {
						_gid = node.getStr(NodeProp.IPFS_LINK.s());
						if (no(_gid)) {
							_gid = node.getStr(NodeProp.BIN.s());
						}

						if (ok(_gid)) {
							try {
								response.sendRedirect(Util.getFullURL(req, "gid=" + _gid));
							} catch (Exception e) {
								throw new RuntimeException("fail.");
							}
						}
					}

					if (no(_gid)) {
						throw new RuntimeException("No attachment data for node.");
					}

					if (no(node)) {
						log.debug("Node did not exist: " + _id);
						throw new RuntimeException("Node not found.");
					} else {
						attach.getBinary(ms, "", node, null, ok(download), response);
					}
					return null;
				});
			}
		} catch (Exception e) {
			// need to add some kind of message to exception to indicate to user something
			// with the arguments went wrong.
			ExUtil.error(log, "exception in call processor", e);
		}
	}

	/*
	 * binId param not uses currently but the client will send either the gridId or the ipfsHash of the
	 * node depending on which type of attachment it sees on the node
	 * 
	 * Note: binId path param will be 'ipfs' for an ipfs attachment on the node.
	 */
	@RequestMapping(value = API_PATH + "/bin/{binId}", method = RequestMethod.GET)
	public void getBinary(@PathVariable("binId") String binId, //
			@RequestParam(value = "nodeId", required = false) String nodeId, //

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
			@RequestParam(value = "token", required = false) String token, //
			@RequestParam(value = "download", required = false) String download, //
			HttpSession session, HttpServletResponse response) {

		if (no(token)) {
			// Check if this is an 'avatar' request and if so bypass security
			if ("avatar".equals(binId)) {
				arun.run(ms -> {
					attach.getBinary(ms, "", null, nodeId, ok(download), response);
					return null;
				});
			}
			// Check if this is an 'profileHeader Image' request and if so bypass security
			else if ("profileHeader".equals(binId)) {
				arun.run(ms -> {
					/*
					 * Note: the "Header" suffix will be applied to all image-related property names to distinguish them
					 * from normal 'bin' properties. This way we now to support multiple uploads onto any node, in this
					 * very limites way.
					 */
					attach.getBinary(ms, "Header", null, nodeId, ok(download), response);
					return null;
				});
			}
			/* Else if not an avatar request then do a securer acccess */
			else {
				callProc.run("bin", null, session, ms -> {
					if (ok(ipfsCid)) {
						ipfs.streamResponse(response, ms, ipfsCid, null);
					} else {
						attach.getBinary(null, "", null, nodeId, ok(download), response);
					}
					return null;
				});
			}
		} else {
			if (SessionContext.validToken(token, null)) {
				arun.run(ms -> {
					attach.getBinary(ms, "", null, nodeId, ok(download), response);
					return null;
				});
			}
		}
	}

	/*
	 * todo-3: we should return proper HTTP codes when file not found, etc.
	 *
	 * The ":.+" is there because that is required to stop it from truncating file extension.
	 * https://stackoverflow.com/questions/16332092/spring-mvc-pathvariable-with-dot
	 * -is-getting-truncated
	 */
	@RequestMapping(value = "/file/{fileName:.+}", method = RequestMethod.GET)
	public void getFile(//
			@PathVariable("fileName") String fileName, //
			@RequestParam(name = "disp", required = false) String disposition, //
			HttpSession session, HttpServletResponse response) {
		callProc.run("file", null, session, ms -> {
			attach.getFile(ms, fileName, disposition, response);
			return null;
		});
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
	@RequestMapping(value = "/filesys-xxx/{nodeId}", method = RequestMethod.GET)
	public Object getFileSystemResourceStream(//
			@PathVariable("nodeId") String nodeId, //
			@RequestParam(name = "disp", required = false) String disposition, //
			HttpSession session) {
		return callProc.run("filesys", null, session, ms -> {
			// return attachmentService.getFileSystemResourceStream(ms, nodeId,
			// disposition);
			return null;
		});
	}

	///////////////////////////////////////////////
	// @GetMapping("/videos/{name}/full")
	// public ResponseEntity<UrlResource> getFullVideo(@PathVariable String name) throws
	/////////////////////////////////////////////// MalformedURLException {
	// UrlResource video = new UrlResource("file:${video.location}/${name}");
	// return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
	// .contentType(MediaTypeFactory.getMediaType(video).orElse(MediaType.APPLICATION_OCTET_STREAM))
	// .body(video);
	// }

	@RequestMapping(value = API_PATH + "/stream/{fileName}", method = RequestMethod.GET)
	public ResponseEntity<ResourceRegion> streamMultiPart(//
			@PathVariable("fileName") String fileName, //
			@RequestParam("nodeId") String nodeId, //
			@RequestParam(name = "disp", required = false) final String disp, //
			@RequestHeader HttpHeaders headers, //
			HttpServletRequest request, //
			HttpServletResponse response, //
			HttpSession session) {
		return (ResponseEntity<ResourceRegion>) callProc.run("stream", null, session, ms -> {
			return attach.getStreamResource(ms, headers, nodeId);
		});
	}

	// /* Used for displaying a file specified by a file url parameter (tbd) */
	// @RequestMapping(value = "/view/{fileName:.+}", method = RequestMethod.GET)
	// public String view(@PathVariable("fileName") String fileName, //
	// Model model) {
	//
	// logRequest("view", null);
	//
	// model.addAttribute("content", attachmentService.getFileContent(null,
	// fileName));
	//
	// // tag: view.html
	// return "view";
	// }
	//

	/*
	 * binSuffix, will be concatenated to all binary-related properties to distinguish them where
	 * possible from the normal node attachment. For normal attachments this is an empty string, which
	 * makes it no suffix (no effect of concatenating)
	 */
	@RequestMapping(value = API_PATH + "/upload", method = RequestMethod.POST)
	public @ResponseBody Object upload(//
			@RequestParam(value = "nodeId", required = true) String nodeId, //
			@RequestParam(value = "binSuffix", required = false) String binSuffix, //
			@RequestParam(value = "explodeZips", required = true) String explodeZips, //
			@RequestParam(value = "saveAsPdf", required = true) String saveAsPdf, //
			@RequestParam(value = "ipfs", required = true) String ipfs, //
			@RequestParam(value = "createAsChildren", required = true) String createAsChildren, //
			@RequestParam(value = "files", required = true) MultipartFile[] uploadFiles, //
			HttpSession session) {
		final String _binSuffix = no(binSuffix) ? "" : binSuffix;

		return callProc.run("upload", null, session, ms -> {
			// log.debug("Uploading as user: "+ms.getUser());
			return attach.uploadMultipleFiles(ms, _binSuffix, nodeId, uploadFiles, explodeZips.equalsIgnoreCase("true"),
					"true".equalsIgnoreCase(ipfs), "true".equalsIgnoreCase(createAsChildren));
		});
	}

	@RequestMapping(value = API_PATH + "/deleteAttachment", method = RequestMethod.POST)
	public @ResponseBody Object deleteAttachment(@RequestBody DeleteAttachmentRequest req, HttpSession session) {
		return callProc.run("deleteAttachment", req, session, ms -> {
			return attach.deleteAttachment(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/uploadFromUrl", method = RequestMethod.POST)
	public @ResponseBody Object uploadFromUrl(@RequestBody UploadFromUrlRequest req, HttpSession session) {
		return callProc.run("uploadFromUrl", req, session, ms -> {
			return attach.readFromUrl(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/uploadFromTorrent", method = RequestMethod.POST)
	public @ResponseBody Object uploadFromTorrent(@RequestBody UploadFromTorrentRequest req, HttpSession session) {
		return callProc.run("uploadFromTorrent", req, session, ms -> {
			return attach.uploadFromTorrent(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/uploadFromIPFS", method = RequestMethod.POST)
	public @ResponseBody Object uploadFromIPFS(@RequestBody UploadFromIPFSRequest req, HttpSession session) {
		return callProc.run("uploadFromIPFS", req, session, ms -> {
			return attach.attachFromIPFS(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/anonPageLoad", method = RequestMethod.POST)
	public @ResponseBody Object anonPageLoad(@RequestBody RenderNodeRequest req, HttpSession session) {
		return callProc.run("anonPageLoad", req, session, ms -> {
			return render.anonPageLoad(null, req);
		});
	}

	@RequestMapping(value = API_PATH + "/nodeSearch", method = RequestMethod.POST)
	public @ResponseBody Object nodeSearch(@RequestBody NodeSearchRequest req, HttpSession session) {
		return callProc.run("nodeSearch", req, session, ms -> {
			return search.search(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/getFollowers", method = RequestMethod.POST)
	public @ResponseBody Object getFollowers(@RequestBody GetFollowersRequest req, HttpSession session) {
		return callProc.run("getFollowers", req, session, ms -> {
			return apFollower.getFollowers(ms, req);
		});
	}

	/*
	 * This function is similar to getFriends, but since getFriends is for a picker dialog we can
	 * consider it to be the odd man out which will eventually need to support paging (currently
	 * doesn't) and go ahead and duplicate that functionality here in a way analogous to getFollowers
	 */
	@RequestMapping(value = API_PATH + "/getFollowing", method = RequestMethod.POST)
	public @ResponseBody Object getFollowing(@RequestBody GetFollowingRequest req, HttpSession session) {
		return callProc.run("getFollowing", req, session, ms -> {
			return apFollowing.getFollowing(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/nodeFeed", method = RequestMethod.POST)
	public @ResponseBody Object nodeFeed(@RequestBody NodeFeedRequest req, HttpSession session) {
		return callProc.run("nodeFeed", req, session, ms -> {
			return userFeed.generateFeed(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/checkMessages", method = RequestMethod.POST)
	public @ResponseBody Object checkMessages(@RequestBody CheckMessagesRequest req, HttpSession session) {
		return callProc.run("checkMessages", req, session, ms -> {
			return userFeed.checkMessages(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/getSharedNodes", method = RequestMethod.POST)
	public @ResponseBody Object getSharedNodes(@RequestBody GetSharedNodesRequest req, HttpSession session) {
		return callProc.run("getSharedNodes", req, session, ms -> {
			return search.getSharedNodes(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/saveUserPreferences", method = RequestMethod.POST)
	public @ResponseBody Object saveUserPreferences(@RequestBody SaveUserPreferencesRequest req, HttpSession session) {
		return callProc.run("saveUserPreferences", req, session, ms -> {
			return user.saveUserPreferences(req);
		});
	}

	@RequestMapping(value = API_PATH + "/getUserProfile", method = RequestMethod.POST)
	public @ResponseBody Object getUserProfile(@RequestBody GetUserProfileRequest req, HttpSession session) {
		return callProc.run("getUserProfile", req, session, ms -> {
			return user.getUserProfile(req);
		});
	}

	@RequestMapping(value = API_PATH + "/saveUserProfile", method = RequestMethod.POST)
	public @ResponseBody Object saveUserProfile(@RequestBody SaveUserProfileRequest req, HttpSession session) {
		return callProc.run("saveUserProfile", req, session, ms -> {
			return user.saveUserProfile(req);
		});
	}

	@RequestMapping(value = API_PATH + "/addFriend", method = RequestMethod.POST)
	public @ResponseBody Object addFriend(@RequestBody AddFriendRequest req, HttpSession session) {
		return callProc.run("addFriend", req, session, ms -> {
			return user.addFriend(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/deleteFriend", method = RequestMethod.POST)
	public @ResponseBody Object deleteFriend(@RequestBody DeleteFriendRequest req, HttpSession session) {
		return callProc.run("deleteFriend", req, session, ms -> {
			return user.deleteFriend(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/blockUser", method = RequestMethod.POST)
	public @ResponseBody Object blockUser(@RequestBody BlockUserRequest req, HttpSession session) {
		return callProc.run("blockUser", req, session, ms -> {
			return user.blockUser(ms, req);
		});
	}

	@RequestMapping(value = API_PATH + "/getUserAccountInfo", method = RequestMethod.POST)
	public @ResponseBody Object getUserAccountInfo(@RequestBody GetUserAccountInfoRequest req, HttpSession session) {
		return callProc.run("getUserAcccountInfo", req, session, ms -> {
			return user.getUserAccountInfo(req);
		});
	}

	@RequestMapping(value = API_PATH + "/getConfig", method = RequestMethod.POST)
	public @ResponseBody Object getConfig(@RequestBody GetConfigRequest req, HttpSession session) {
		GetConfigResponse res = new GetConfigResponse();
		res.setConfig(prop.getConfig());
		return res;
	}

	@RequestMapping(value = API_PATH + "/getBookmarks", method = RequestMethod.POST)
	public @ResponseBody Object getBookmarks(@RequestBody GetBookmarksRequest req, HttpSession session) {
		return callProc.run("getBookmarks", req, session, ms -> {
			GetBookmarksResponse res = new GetBookmarksResponse();
			search.getBookmarks(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/getNodeStats", method = RequestMethod.POST)
	public @ResponseBody Object getNodeStats(@RequestBody GetNodeStatsRequest req, HttpSession session) {
		return callProc.run("getNodeStats", req, session, ms -> {
			GetNodeStatsResponse res = new GetNodeStatsResponse();
			search.getNodeStats(ms, req, res);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/getServerInfo", method = RequestMethod.POST)
	public @ResponseBody Object getServerInfo(@RequestBody GetServerInfoRequest req, HttpSession session) {
		return callProc.run("getServerInfo", req, session, ms -> {

			GetServerInfoResponse res = new GetServerInfoResponse();
			res.setMessages(new LinkedList<>());

			if (req.getCommand().equalsIgnoreCase("getJson")) {
				// allow this one if user owns node.
			} else if (!ThreadLocals.getSC().isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}

			log.debug("Command: " + req.getCommand());
			switch (req.getCommand()) {
				case "crawlUsers":
					res.getMessages().add(new InfoMessage(apub.crawlNewUsers(), null));
					break;

				case "actPubMaintenance":
					res.getMessages().add(new InfoMessage(apub.maintainForeignUsers(), null));
					break;

				case "compactDb":
					res.getMessages().add(new InfoMessage(system.compactDb(), null));
					break;

				case "deleteLeavingOrphans":
					res.getMessages().add(new InfoMessage(system.deleteLeavingOrphans(ms, req.getNodeId()), null));
					break;

				case "validateDb":
					res.getMessages().add(new InfoMessage(system.validateDb(), null));
					break;

				case "rebuildIndexes":
					res.getMessages().add(new InfoMessage(system.rebuildIndexes(), null));
					break;

				case "refreshRssCache":
					res.getMessages().add(new InfoMessage(rssFeed.refreshFeedCache(), null));
					break;

				case "refreshFediverseUsers":
					apub.refreshForeignUsers();
					res.getMessages().add(new InfoMessage("Fediverse refresh initiated...", null));
					break;

				case "refreshAPAccounts":
					apub.refreshActorPropsForAllUsers();
					res.getMessages().add(new InfoMessage("Accounts refresh initiated...", null));
					break;

				case "toggleDaemons":
					prop.setDaemonsEnabled(!prop.isDaemonsEnabled());
					res.getMessages().add(new InfoMessage(system.getSystemInfo(), null));
					break;

				case "ipfsPubSubTest":
					// currently unused (leaving hook in place)
					throw new RuntimeException("ipfsPubSubTest depricated");
				// res.getMessages().add(new InfoMessage(ipfsService.pubSubTest(), null));
				// break;

				case "getServerInfo":
					res.getMessages().add(new InfoMessage(system.getSystemInfo(), null));
					break;

				case "getSessionActivity":
					res.getMessages().add(new InfoMessage(system.getSessionActivity(), null));
					break;

				case "getJson":
					res.getMessages().add(new InfoMessage(system.getJson(ms, req.getNodeId()), null));
					break;

				default:
					throw new RuntimeEx("Invalid command: " + req.getCommand());
			}
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/graphNodes", method = RequestMethod.POST)
	public @ResponseBody Object graphNodes(@RequestBody GraphRequest req, HttpSession session) {
		return callProc.run("graphNodes", req, session, ms -> {
			GraphResponse res = graphNodes.graphNodes(ms, req);
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/luceneIndex", method = RequestMethod.POST)
	public @ResponseBody Object luceneIndex(@RequestBody LuceneIndexRequest req, HttpSession session) {
		return callProc.run("luceneIndex", req, session, ms -> {
			if (!ThreadLocals.getSC().isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}

			/*
			 * We need to run this in a thread, and return control back to browser imediately, and then have the
			 * "ServerInfo" request able to display the current state of this indexing process, or potentially
			 * have a dedicated ServerInfo-like tab to display the state in
			 */
			return lucene.reindex(ms, req.getNodeId(), req.getPath());
		});
	}

	@RequestMapping(value = API_PATH + "/luceneSearch", method = RequestMethod.POST)
	public @ResponseBody Object luceneSearch(@RequestBody LuceneSearchRequest req, HttpSession session) {
		return callProc.run("luceneSearch", req, session, ms -> {
			if (!ThreadLocals.getSC().isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}
			return lucene.search(ms, req.getNodeId(), req.getText());
		});
	}

	@RequestMapping(value = API_PATH + "/ping", method = RequestMethod.POST)
	public @ResponseBody Object ping(@RequestBody PingRequest req, HttpSession session) {
		return callProc.run("ping", req, session, ms -> {
			// log.debug("ping from browser");
			PingResponse res = new PingResponse();
			res.setServerInfo("Server: t=" + System.currentTimeMillis());
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/sendTestEmail", method = RequestMethod.POST)
	public @ResponseBody Object sendTestEmail(@RequestBody SendTestEmailRequest req, HttpSession session) {
		return callProc.run("sendTestEmail", req, session, ms -> {
			SendTestEmailResponse res = new SendTestEmailResponse();
			if (!ThreadLocals.getSC().isAdmin()) {
				throw ExUtil.wrapEx("admin only function.");
			}
			log.debug("SendEmailTest detected on server.");

			String timeString = new Date().toString();
			synchronized (EmailSender.getLock()) {
				try {
					mail.init();
					mail.sendMail("wclayf@gmail.com", null,
							"<h1>Hello! Time=" + timeString + "</h1>This is the test email requested from the "
									+ prop.getConfigText("brandingAppName") + " admin menu.",
							"Test Subject");
				} finally {
					mail.close();
				}
			}
			res.setSuccess(true);
			return res;
		});
	}

	@RequestMapping(value = API_PATH + "/splitNode", method = RequestMethod.POST)
	public @ResponseBody Object splitNode(@RequestBody SplitNodeRequest req, HttpSession session) {
		return callProc.run("splitNode", req, session, ms -> {
			return edit.splitNode(ms, req);
		});
	}

	//
	// @RequestMapping(value = API_PATH + "/openSystemFile", method =
	// RequestMethod.POST)
	// public @ResponseBody OpenSystemFileResponse saveUserPreferences(@RequestBody
	// OpenSystemFileRequest req) {
	// logRequest("openSystemFile", req);
	// OpenSystemFileResponse res = new OpenSystemFileResponse();
	//
	// DesktopApi.open(new File(req.getFileName()));
	// return res;
	// }

	// reference: https://www.baeldung.com/spring-server-sent-events
	@GetMapping(API_PATH + "/serverPush")
	public SseEmitter serverPush(HttpSession session) {
		return (SseEmitter) callProc.run("serverPush", null, session, ms -> {
			synchronized (ThreadLocals.getSC().getPushEmitter()) {
				return ThreadLocals.getSC().getPushEmitter();
			}
		});
	}

	@RequestMapping(value = API_PATH + "/captcha", method = RequestMethod.GET, produces = MediaType.IMAGE_PNG_VALUE)
	public @ResponseBody byte[] captcha(HttpSession session) {
		return (byte[]) callProc.run("captcha", null, session, ms -> {
			String captcha = CaptchaMaker.createCaptchaString();
			ThreadLocals.getSC().setCaptcha(captcha);
			return CaptchaMaker.makeCaptcha(captcha);
		});
	}
}