package org.subnode.service;

import java.io.File;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.config.AppProp;
import org.subnode.config.SessionContext;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.ExecuteNodeRequest;
import org.subnode.response.ExecuteNodeResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.FileUtils;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;

@Component
public class BashService {
	private static final Logger log = LoggerFactory.getLogger(BashService.class);

	@Autowired
	private MongoRead read;

	@Autowired
	private AppProp appProp;

	@Autowired
	private SubNodeUtil util;

	@Autowired
	private SessionContext sessionContext;

	/*
	 * For now we only support synchronous runs, so that the response from the
	 * server happens only after the script has completed
	 */
	public void executeNode(MongoSession session, ExecuteNodeRequest req, ExecuteNodeResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		if (true) {
			throw ExUtil.wrapEx("disabled pending security review.");
		}

		if (!sessionContext.isAdmin()) {
			throw ExUtil.wrapEx("executeNode is an admin-only feature.");
		}

		String nodeId = req.getNodeId();
		SubNode node = read.getNode(session, nodeId);
		String script;

		/*
		 * if a filename is given we wrap it in a command string that will make it
		 * execute in a new terminal, and this is just a convenience which could have
		 * also been entered directly as the content.
		 */
		String fileName = node.getStrProp(NodeProp.FILENAME.s());
		if (fileName != null) {
			script = "gnome-terminal -- /bin/bash -c '" + fileName + "'";
		} else {
			script = node.getContent();
		}

		// for now we just assume every script is bash.
		log.debug("script:\n" + script);
		runBashScript(script, res);

		// I guess in order to send back data i will persist as child nodes representing
		// each execution.
		// api.saveSession(session);
		res.setSuccess(true);
	}

	public void runBashScript(String script, ExecuteNodeResponse res) {
		if (!FileUtils.dirExists(appProp.getAdminDataFolder())) {
			throw ExUtil.wrapEx("adminDataFolder does not exist");
		}

		String shortFileName = "bash-" + util.getGUID() + ".sh";
		String fullFileName = appProp.getAdminDataFolder() + File.separator + shortFileName;
		FileUtils.writeEntireFile(fullFileName, "#!/bin/bash\n\n" + script);

		// String shortFileName = "bash-" + util.getGUID() + ".sh";
		// String fullFileName = appProp.getAdminDataFolder() + File.separator +
		// shortFileName;
		// FileUtils.writeEntireFile(fullFileName, "#!/bin/bash\n\ngnome-terminal --
		// /bin/bash -c '"+_fullFileName+"'");

		try {
			/*
			 * We simply write the file and make it runnable, and the exec-deamon.sh (if
			 * running) will take over from there and run the script on the host. It's
			 * actually the host that picks up the script and executes it, which gives it
			 * full power on the host beyond what could be done from inside a docker
			 * container.
			 * 
			 * Of course if SubNode were being run OUTSIDE a docker container, or if we
			 * wanted these scripts to be run INSIDE the docker container, then the actual
			 * Executor code below that's commented out could be used, but for now that's
			 * not the architecture needed.
			 */
			FileUtils.makeFileRunnable(fullFileName);
			log.debug("Wrote file: " + fullFileName);

			// The rest of this is commented becasue running in a Docker Container precludes
			// the type of
			// host manipulation i wanted to do EVEN if the folder itself is shared.

			// // ExecuteWatchdog watchdog = null;
			// // PrintResultHandler resultHandler;

			// // // build up the command line to using a 'java.io.File'
			// // final Map<String, File> map = new HashMap<String, File>();
			// // map.put("file", file);
			// // final CommandLine commandLine = new CommandLine(acroRd32Script);
			// // commandLine.addArgument("/p");
			// // commandLine.addArgument("/h");
			// // commandLine.addArgument("${file}");
			// // commandLine.setSubstitutionMap(map);

			// final CommandLine commandLine = new CommandLine(fullFileName);

			// // // create the executor and consider the exitValue '1' as success
			// final Executor executor = new DefaultExecutor();
			// executor.setWorkingDirectory(new File(appProp.getAdminDataFolder()));

			// // // create a watchdog if requested
			// // if (printJobTimeout > 0) {
			// // watchdog = new ExecuteWatchdog(printJobTimeout);
			// // executor.setWatchdog(watchdog);
			// // }
			// ByteArrayOutputStream outputStream = null;

			// ///////////////////
			// outputStream = new ByteArrayOutputStream();
			// // CommandLine commandline = CommandLine.parse(command);
			// // DefaultExecutor exec = new DefaultExecutor();
			// PumpStreamHandler streamHandler = new PumpStreamHandler(outputStream);
			// executor.setStreamHandler(streamHandler);
			// // exec.execute(commandline);
			// // return(outputStream.toString());
			// /////////////////////

			// // // pass a "ExecuteResultHandler" when doing background printing
			// // if (printInBackground) {
			// // resultHandler = new PrintResultHandler(watchdog);
			// // executor.execute(commandLine, resultHandler);
			// // }
			// // else {

			// log.debug("Running Command: " + commandLine);
			// int exitValue = executor.execute(commandLine);
			// String result = outputStream.toString() + "\n\nResult: " + exitValue;
			// res.setOutput(result);
			// res.setReturnCode(exitValue);
			// resultHandler = new PrintResultHandler(exitValue);
			// }
		} catch (Exception e) {
			log.error("Failed running Script.", e);
			throw new RuntimeEx(e);
		}
	}
}
