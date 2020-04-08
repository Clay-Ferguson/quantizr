package org.subnode.service;

import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

@Component
@Scope("prototype")
public class ImportTarService {
	//this will be implemented AFTER the ImportZipService is transitioned over to use Apache Commons rather than java native.
}
