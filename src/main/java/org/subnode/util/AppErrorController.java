package org.subnode.util;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.subnode.config.ConstantsProvider;

@RestController
public class AppErrorController implements ErrorController {

    @Autowired
    private ConstantsProvider constProvider;

    private static final String ERROR_MAPPING = "/error";

    @RequestMapping(value = ERROR_MAPPING)
    public ResponseEntity<String> error() {
        String link = "<a style=\"margin-left: 3em; font-family: 'Courier New',Courier, monospace\" href="+constProvider.getHostAndPort()+">Go Back to "+constProvider.getHostAndPort()+"</a>";
        return new ResponseEntity<String>("<h3 style=\"margin: 2em; font-family: 'Courier New',Courier, monospace\">Oops. Nothing found.</h3>"+link, HttpStatus.NOT_FOUND);
    }

    @Override
    public String getErrorPath() {
        return ERROR_MAPPING;
    }
}
