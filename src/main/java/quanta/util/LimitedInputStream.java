package quanta.util;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * An input stream, which limits its data size. This stream is used, if the content length is
 * unknown.
 *
 * NOTE: We cannot use the Apache Commons version of this class because it has private members that
 * we need access to, like 'count' for example.
 */
public abstract class LimitedInputStream extends FilterInputStream {
    private final long sizeMax;
    private long count;
    private boolean closed;

    public LimitedInputStream(InputStream inputStream, long pSizeMax) {
        super(inputStream);
        sizeMax = pSizeMax;
    }

    public long getCount() {
        return count;
    }

    protected abstract void raiseError(long pSizeMax, long pCount) throws IOException;

    private void checkLimit() throws IOException {
        if (count > sizeMax) {
            raiseError(sizeMax, count);
        }
    }

    @Override
    public int read() throws IOException {
        int res = super.read();
        if (res != -1) {
            count++;
            checkLimit();
        }
        return res;
    }

    @Override
    public int read(byte[] b, int off, int len) throws IOException {
        int res = super.read(b, off, len);
        if (res > 0) {
            count += res;
            checkLimit();
        }
        return res;
    }

    public boolean isClosed() throws IOException {
        return closed;
    }

    @Override
    public void close() throws IOException {
        closed = true;
        super.close();
    }
}
