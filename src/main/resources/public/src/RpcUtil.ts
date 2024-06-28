import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { ProgressDlg } from "./dlg/ProgressDlg";
import * as J from "./JavaIntf";
import { S } from "./Singletons";
import { Constants as C } from "./Constants";
import { RpcQueueItem } from "./RpcQueueItem";

export class RpcUtil {
    log: boolean = false;
    logVerbose: boolean = false;

    rpcPath: string = null;
    rhost: string = null;
    callId: number = 0;
    concurrency: number = 0;
    timer: any = null;
    unauthMessageShowing: boolean = false;

    /*
    * We use this variable to determine if we are waiting for an ajax call, but the server also
    * enforces that each session is only allowed one concurrent call and simultaneous calls just
    * "queue up".
    */
    rpcCounter: number = 0;
    waitCounter: number = 0;
    pgrsDlg: ProgressDlg = null;
    RPC_TIMER_INTERVAL = 1000;

    // Setting to zero disables the ability for the server to 'retry' RPC calls Until we have
    // AppVersion embedded in the Redis Objects, and also into all request objects it won't be safe
    // to yet to allow this retry feature because it would be able to cause the browser to keep
    // running with outdated interfaces instead of foring it to reload whenver it truly needs to
    // reload.
    RPC_RETRIES: number = 0;
    SLOW_INTERVAL = 1000;
    FAST_INTERVAL = 10;
    lifoInterval = this.SLOW_INTERVAL;
    static MAX_LIFO_SIZE = 70;

    removedDomIds: string[] = [];
    lifoQueue: RpcQueueItem[] = [];

    lifoQueuePush = (qi: RpcQueueItem) => {
        this.lifoQueue.push(qi);

        // Currently this queue processes just OpenGraph querying from the server and we dont't
        // allow more than MAX_LIFO_SIZE to be queued up at a time before we start dropping them.
        // This is because as users navigate around real fast this queue could just create a ton of
        // wasted queries to the server. 
        if (this.lifoQueue.length > RpcUtil.MAX_LIFO_SIZE) {
            this.lifoQueue.shift();
        }
    }

    clearQueue = () => {
        this.lifoQueue = [];
    }

    lifoQueueProcessor = () => {
        if (this.lifoQueue.length > 0 && this.concurrency == 0) {
            const idx = this.lifoQueue.length - 1;
            if (this.lifoQueue[idx].func && this.lifoQueue[idx].promise) {
                const qi = this.lifoQueue.pop();
                qi.func();
            }
        }

        // if queue is empty and we're ticking at high speed slow down slow speed, to save CPU
        if (this.lifoQueue.length == 0 && this.lifoInterval < this.SLOW_INTERVAL) {
            this.setIntervalSpeed(this.SLOW_INTERVAL);
        }
        // if items are queued and we're ticking at slow rate, then speed up to fast rate to
        // process the queue asap
        else if (this.lifoQueue.length > 1 && this.lifoInterval >= this.SLOW_INTERVAL) {
            this.setIntervalSpeed(this.FAST_INTERVAL);
        }
    }

    rpcQueInterval = setInterval(this.lifoQueueProcessor, this.lifoInterval);

    // For all domIds in removeDomIds we remove those from lifoQueue, and then reset
    // removeDomIds back to empty array
    rpcQueCleanupInterval = setInterval(() => {
        if (this.removedDomIds.length == 0 || this.lifoQueue.length == 0) return;
        this.lifoQueue = this.lifoQueue.filter(qi => this.removedDomIds.findIndex(id => id == qi.compId) != -1);
        this.removedDomIds = [];
    }, 2000);

    setIntervalSpeed = (interval: number) => {
        clearInterval(this.rpcQueInterval);
        this.lifoInterval = interval;
        this.rpcQueInterval = setInterval(this.lifoQueueProcessor, this.lifoInterval);
    }

    getRemoteHost = (): string => {
        if (this.rhost) {
            return this.rhost;
        }

        this.rhost = S.util.getParameterByName("rhost");
        this.rhost = this.rhost || window.location.origin;
        return this.rhost;
    }

    getRpcPath = (): string => {
        return this.rpcPath || (this.rpcPath = this.getRemoteHost() + "/api/");
    }

    /* RPC calls to server that support retries. Retries are currently disabled, but when enabled it
    makes the browser smart enough to continue working seamlessly even during a server restart, and
    even with the server is retstarting a SINGLE REPLICA swarm. (i.e. Zero Downtime even for single
    replia swarm)

    NOTE: Currently getOpenGraph is the only call that has queue=true.

    'compId' is the elementId of the element requesting the data, such that if we detect the element
    has been remove from the dom we know we can cancel any queued query
    */
    rpc = <RequestType extends J.RequestBase, ResponseType extends J.ResponseBase> //
        (postName: string, postData: RequestType = null,
            background: boolean = false, allowErrorDlg: boolean = true, lifoQueue = false, compId: string = null): Promise<ResponseType> => {

        let qi = null;
        if (lifoQueue) {
            qi = new RpcQueueItem();
            qi.info = postName;
            qi.compId = compId;
            // Queueing postName
            this.lifoQueuePush(qi);
        }

        const retPromise = new Promise<ResponseType>((resolve, reject) => {
            const func = () => {
                const callId = ++this.callId;
                postData = postData || {} as RequestType;
                this.concurrency++;
                if (this.log) {
                    console.log("POST(" + callId + ", conc=" + this.concurrency + "): [" + this.getRpcPath() + postName + "]");
                }

                if (this.logVerbose) {
                    if (!S.crypto.userSignature) {
                        console.warn("Request will have no signature.");
                    }
                    console.log("   RET: " + S.util.prettyPrint(postData));
                }

                if (!background) {
                    this.rpcCounter++;
                    S.quanta.setOverlay(true);
                }

                const inner = this.rpcInner<RequestType, ResponseType>(postName, callId, postData);
                inner.then((data: ResponseType) => {
                    this.concurrency--;
                    if (this.log) {
                        console.log("SUCCESS (conc=" + this.concurrency + ")=" + postName);
                    }
                    resolve(data);
                })
                    .catch((error: any) => {
                        this.concurrency--;
                        console.error("ERROR (conc=" + this.concurrency + ")=" + S.util.prettyPrint(error));
                        if (this.RPC_RETRIES == 0) reject(error);
                        let retries = 0;

                        // if we did get a response with a status we can immediately call reject(),
                        // but otherwise that indicates server was unreachable so we start retrying 
                        if (error?.response?.status) {
                            reject(error);
                            return;
                        }
                        console.log("rpcNew FAIL. Server down or network failing. (will retry): " + postName);
                        let retrying = false;

                        const timeoutId = setInterval(() => {
                            if (retrying) return;
                            retries++;

                            // on the 3rd retry show the user a "Reconnecting message so they know what's happening"
                            if (retries == 3) {
                                // we should make it where we can do a state change on the ProgressDlg without
                                // having to open a new one.
                                if (this.pgrsDlg) {
                                    this.pgrsDlg.close();
                                }
                                const dlg = new ProgressDlg("Reconnecting to server.");
                                this.pgrsDlg = dlg;
                                this.pgrsDlg.open();
                            }

                            if (retries >= this.RPC_RETRIES) {
                                // console.log("rpcNew FAIL (giving up, exhausted retries): " + postName);
                                clearTimeout(timeoutId);
                                reject(error);
                            }

                            retrying = true;
                            console.log("rpcNew retry " + retries + ": " + postName);
                            this.rpcInner<RequestType, ResponseType>(postName, callId, postData)
                                .then((data: ResponseType) => {
                                    clearTimeout(timeoutId);
                                    retrying = false;
                                    // console.log("rpcNew SUCCESS FINALLY: " + postName);
                                    resolve(data);
                                })//
                                .catch((error: any) => {
                                    if (retries >= this.RPC_RETRIES) {
                                        // console.log("rpcNew FAIL (giving up, exhausted retries): " + postName);
                                        clearTimeout(timeoutId);
                                        reject(error);
                                    }
                                    retrying = false;
                                });
                        }, 3000);
                    });
            }

            // queue the function
            if (lifoQueue) {
                qi.func = func;
            }
            // or else run immediately
            else {
                func();
            }
        });

        retPromise.then((data: J.ResponseBase) => this.rpcSuccess(data, background, postName))
            .catch((error: any) => this.rpcFail(error, background, allowErrorDlg, postName, postData));

        if (lifoQueue) {
            qi.promise = retPromise;
        }

        return retPromise;
    }

    /* Makes calls to server (Called thru 'rpc' rather than called directly) */
    private rpcInner = <RequestType extends J.RequestBase, ResponseType extends J.ResponseBase> //
        (postName: string, callId: number, postData: RequestType = null): Promise<ResponseType> => {

        return new Promise<ResponseType>((resolve, reject) => {

            // const startTime = new Date().getTime();
            // console.log("fetch: " + this.getRpcPath() + postName + " Bearer: " + S.quanta.authToken);
            fetch(this.getRpcPath() + postName, {
                method: "POST",
                body: JSON.stringify(postData),
                headers: {
                    "Content-Type": "application/json",
                    Bearer: S.quanta.authToken || "",
                    Sig: S.crypto.userSignature || "",
                    callId: callId.toString()
                },
                mode: "cors", // no-cors, *cors, same-origin
                cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
                credentials: "same-origin", // include, *same-origin, omit
                referrerPolicy: "no-referrer"
            })
                .then((res: Response) => {
                    // Unauthorized refers to the session, and our session has likely timed out.
                    if (res.status === C.RESPONSE_CODE_UNAUTHORIZED) {
                        console.error("UNAUTHORIZED(401) error for: " + postName + " RES: " + res);
                        reject({ response: res });
                        this.authFail();
                    }
                    else if (res.status === C.RESPONSE_CODE_FORBIDDEN) {
                        console.error("FORBIDDEN(403) error for: " + postName + " RES: " + res);
                        reject({ response: res });
                        S.util.showMessage("Content not visible to you.", "Message");
                    }
                    else if (res.status !== C.RESPONSE_CODE_OK) {
                        console.log("reject: res: " + S.util.prettyPrint(res) + " PATH=" + this.getRpcPath() + postName + " Bearer: " + S.quanta.authToken);
                        reject({ response: res });
                    }
                    else {
                        return res.text();
                    }
                })
                .then((json: string) => {
                    /* if we did a reject above in the first 'then' we will get here with json
                    undefined so we ignore that */
                    if (json) {
                        const obj = JSON.parse(json);
                        resolve(obj);
                    }
                    else {
                        reject(null);
                    }
                })
                .catch((error) => {
                    console.log("reject: " + this.getRpcPath() + postName + " Bearer: " + S.quanta.authToken);
                    reject(error);
                });
        });
    }

    rpcSuccess = (res: J.ResponseBase, background: boolean, postName: string) => {
        try {
            if (!background) {
                this.rpcCounter--;
                if (this.rpcCounter < 0) {
                    this.rpcCounter = 0;
                }
                this.progressInterval();
            }

            if (res?.code == C.RESPONSE_CODE_OK) {
                if (this.log) {
                    console.log("RES: " + postName + " REPL: " + res.replica);
                }
                if (this.logVerbose) {
                    console.log("   RET: " + S.util.prettyPrint(res));
                }
            }

            if (res.code === C.RESPONSE_CODE_UNAUTHORIZED) {
                console.error("UNAUTHORIZED(401b) error for: " + postName + " RES: " + res);
                this.authFail();
                return;
            }

            if (res.code === C.RESPONSE_CODE_FORBIDDEN) {
                console.error("FORBIDDEN(403b) error for: " + postName + " RES: " + res);
                S.util.showMessage("Content not visible to you.", "Message");
                return;
            }

            if (res.code != C.RESPONSE_CODE_OK) {
                if (!this.logVerbose) {
                    let trace = res.stackTrace;
                    if (trace) {
                        trace = trace.replaceAll("\\n", "\n");
                        trace = trace.replaceAll("\\t", "\t");

                        // remove this so the prettyPrint doesn't contain it.
                        delete res.stackTrace;
                    }
                    console.error("FAILED RESULT: " + postName + "\n    JSON: " +
                        S.util.prettyPrint(res));
                    if (trace) {
                        console.error("TRACE: " + trace);
                    }
                }

                if (res.message) {
                    (res as any).errorShown = true;
                    S.util.showMessage(res.message, "Message");

                    // get rid of message so it can't be shown again
                    res.message = null;
                }
                return;
            }
        } catch (ex) {
            S.util.logErr(ex, "Failed handling result of: " + postName);
            throw ex;
        }
        finally {
            if (!background) {
                S.quanta.setOverlay(false);
            }
        }
    }

    /**
     * We should only reach here when there's an actual failure to call the server, and is
     * completely separete from the server perhaps haveing an exception where it sent back an error.
     */
    rpcFail = (error: any, background: boolean, allowErrorDlg: boolean, postName: string, postData: any) => {
        try {
            if (!background) {
                this.rpcCounter--;
                if (this.rpcCounter < 0) {
                    this.rpcCounter = 0;
                }
                this.progressInterval();
            }

            console.log("FAIL [" + postName + "]\n    ERROR: " + S.util.prettyPrint(error) + //
                "\n    POST DATA: " + S.util.prettyPrint(postData));

            switch (error?.response?.status) {
                case C.RESPONSE_CODE_UNAUTHORIZED:
                    console.error("UNAUTHORIZED (401) error");
                    this.authFail();
                    return;
                case C.RESPONSE_CODE_FORBIDDEN:
                    console.error("FORBIDDEN (403) error");
                    S.util.showMessage("Content not visible to you.", "Message");
                    return;
                case C.RESPONSE_CODE_SERVER_TOO_BUSY:
                    S.util.showMessage("Server too busy (503). Try again later.", "Warning", true);
                    return;
            }

            if (!background && allowErrorDlg) {
                S.util.showMessage("Something went wrong. Try refreshing your browser.", "Warning", true);
            }
        } catch (ex) {
            S.util.logErr(ex, "Failed processing: " + postName);
            throw ex;
        }
        finally {
            if (!background) {
                S.quanta.setOverlay(false);
            }
        }
    }

    authFail = async () => {
        if (this.unauthMessageShowing) return;
        this.unauthMessageShowing = true;

        const dlg = new ConfirmDlg("<p class='alertText'>Unauthorized (or Logged Out)<br><br>Login now?</p>", "Session Message",
            "btn-info", "alert alert-info");
        await dlg.open();
        if (dlg.yes) {
            window.location.href = window.location.origin + "?login=y";
        }

        this.unauthMessageShowing = false;
    }

    incRpcCounter = () => {
        this.rpcCounter++;
        S.quanta.setOverlay(true);

        // incrementing waitCounter to 1 will make the progress indicator come up faster
        this.waitCounter = 1;
        this.progressInterval();
    }

    decRpcCounter = () => {
        this.rpcCounter--;
        S.quanta.setOverlay(false);
        if (this.rpcCounter < 0) {
            this.rpcCounter = 0;
        }
        this.progressInterval();
    }

    isRpcWaiting = (): boolean => {
        return this.rpcCounter > 0;
    }

    initRpcTimer = () => {
        // This timer is a singleton that runs always so we don't need to ever clear the timeout.
        // Not a resource leak.
        this.timer = setInterval(this.progressInterval, this.RPC_TIMER_INTERVAL);
    }

    startBlockingProcess = () => {
        S.quanta.setOverlay(true);
    }

    stopBlockingProcess = () => {
        S.quanta.setOverlay(false);
    }

    progressInterval = () => {
        const isWaiting = S.rpcUtil.isRpcWaiting();
        if (isWaiting) {
            this.waitCounter++;
            if (this.waitCounter >= 3) {
                if (!this.pgrsDlg) {
                    const dlg = new ProgressDlg();
                    this.pgrsDlg = dlg;
                    this.pgrsDlg.open();
                }
            }
        } else {
            this.waitCounter = 0;
            if (this.pgrsDlg) {
                this.pgrsDlg.close();
                this.pgrsDlg = null;
            }
        }
    }
}
