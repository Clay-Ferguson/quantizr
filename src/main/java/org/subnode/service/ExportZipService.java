package org.subnode.service;

import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveOutputStream;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.subnode.util.ExUtil;

import java.io.FileOutputStream;
import java.io.InputStream;

@Component
@Scope("prototype")
public class ExportZipService extends ExportArchiveBase {
    private static final Logger log = LoggerFactory.getLogger(ExportZipService.class);

    // JDK Version (do not delete)
    // private ZipOutputStream zos;

    private ZipArchiveOutputStream out = null;

    @Override
    public void openOutputStream(String fileName) {
        log.debug("Opening Export File: " + fileName);
        try {
            // JDK Version (do not delete)
            //zos = new ZipOutputStream(new FileOutputStream(fullFileName));

            out = new ZipArchiveOutputStream(new FileOutputStream(fileName));
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        }
    }

    @Override
    public void closeOutputStream() {
        try {
            // JDK Version (do not delete)
            //StreamUtil.close(zos);

            out.finish(); 
            out.close();
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        }
    }

    @Override
    public void addEntry(String fileName, byte[] bytes) {
        while (fileName.startsWith("/")) {
            fileName = fileName.substring(1);
        }
        log.debug("Add Entry: " + fileName + " bytes.length=" + bytes.length);
        try {
            ZipArchiveEntry entry = new ZipArchiveEntry(fileName);

            // I saw this in an example but haven't tried using it.
            // CRC32 crc32 = new CRC32();
            // crc32.update(tail);
            // zipEntry.setCrc(crc32.getValue());

            entry.setSize(bytes.length);
            out.putArchiveEntry(entry);
            out.write(bytes);
            out.closeArchiveEntry();

            // JDK Version (do not delete)
            // ZipEntry zi = new ZipEntry(fileName);
            // try {
            //     zos.putNextEntry(zi);
            //     zos.write(bytes);
            //     zos.closeEntry();
            // } catch (Exception ex) {
            //     throw ExUtil.newEx(ex);
            // }
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        }
    }

    @Override
    public void addEntry(String fileName, InputStream stream, long length) {
        while (fileName.startsWith("/")) {
            fileName = fileName.substring(1);
        }
        log.debug("Add Entry: " + fileName);
        try {
            ZipArchiveEntry entry = new ZipArchiveEntry(fileName);

            entry.setSize(length);
            out.putArchiveEntry(entry);
            IOUtils.copyLarge(stream, out, 0, length);
            out.closeArchiveEntry();

            // JDK Version (do not delete)
            // ZipEntry zi = new ZipEntry(fileName);
            // try {
            //     zos.putNextEntry(zi);
            //     zos.write(bytes);
            //     zos.closeEntry();
            // } catch (Exception ex) {
            //     throw ExUtil.newEx(ex);
            // }
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        }
    }

    @Override
    public String getFileExtension() {
        return "zip";
    }
}
