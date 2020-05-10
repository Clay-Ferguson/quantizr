package org.subnode.util;

import javax.servlet.RequestDispatcher;
import javax.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.subnode.config.SessionContext;

@Controller
public class AppErrorController implements ErrorController {

    @Autowired
    private SessionContext sessionContext;

    @RequestMapping("/error")
    public String handleError(HttpServletRequest httpReq) {
        String requestUri = (String) httpReq.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
        sessionContext.setError("Not found: " + requestUri);
        return "forward:/index.html";
    }

    @Override
    public String getErrorPath() {
        return "/error";
    }
}