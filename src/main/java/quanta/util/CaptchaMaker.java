package quanta.util;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Random;
import javax.imageio.ImageIO;
import javax.imageio.stream.ImageOutputStream;

public class CaptchaMaker {
    private static final Random rand = new Random();

    // returns a random string of at least 5 numeric characters
    public static String createCaptchaString() {
        StringBuilder captcha = new StringBuilder();

        while (captcha.length() < CAPTCHA_NUM_CHARS) {
            // add random character between 0 and 9
            captcha.append(String.valueOf(rand.nextInt(10)));
        }
        return captcha.toString();
    }

    public static final int CAPTCHA_MAX_REQUESTS = 5;
    public static final int CAPTCHA_CHAR_SIZE = 40;
    public static final int CAPTCHA_NUM_CHARS = 6;

    /**
     * Create a GIF image with the given CAPTCHA string.
     */
    public static byte[] makeCaptcha(String captchaString) throws IOException {
        // Dimensions for the CAPTCHA images
        int width = 80;
        int height = 80;

        // Create a stream to hold the output
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageOutputStream output = ImageIO.createImageOutputStream(bos);

        // Create a buffered image to draw the first frame (empty frame) and initialize GifSequenceWriter
        BufferedImage first = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        GifSequenceWriter writer = new GifSequenceWriter(output, first.getType(), 500, true);
        Graphics2D g = null;
        try {
            // Write the first (empty) frame with a 2 seconds delay to allow users to focus
            g = first.createGraphics();
            g.setColor(Color.LIGHT_GRAY); // assuming white background
            g.fillRect(0, 0, width, height);
            writer.writeToSequence(first);

            BufferedImage space = createImageWithCharacter(' ', width, height);
            // For each character in the captcha string, create an image and write to the sequence
            for (char character : captchaString.toCharArray()) {
                BufferedImage image = createImageWithCharacter(character, width, height);
                writer.writeToSequence(image);

                image = createImageWithCharacter(' ', width, height);
                writer.writeToSequence(space);
            }
            writer.writeToSequence(space);
        } finally {
            if (g != null)
                g.dispose();

            // Close the writer to complete the GIF
            if (writer != null)
                writer.close();
            if (output != null)
                output.close();
        }

        // Return the byte array containing the GIF data
        return bos.toByteArray();
    }

    private static BufferedImage createImageWithCharacter(char character, int width, int height) {
        // This method should create an image with a single character
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = null;
        try {
            g = image.createGraphics();
            g.setColor(Color.LIGHT_GRAY); // assuming white background
            g.fillRect(0, 0, width, height);
            g.setColor(Color.BLACK); // assuming black text
            g.setFont(new Font("Courier New", Font.BOLD, 24));
            FontMetrics fm = g.getFontMetrics();
            int x = (width - fm.charWidth(character)) / 2;
            int y = ((height - fm.getHeight()) / 2) + fm.getAscent();
            g.drawString(String.valueOf(character), x, y);
        } finally {
            if (g != null)
                g.dispose();
        }

        return image;
    }

    // DO NOT DELETE (we may eventually need this)
    // private static BufferedImage createImageWithText(String text, int width, int height) {
    // // This method should create an image with the whole CAPTCHA text
    // BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
    // Graphics2D g = image.createGraphics();
    // g.setColor(Color.WHITE); // assuming white background
    // g.fillRect(0, 0, width, height);
    // g.setColor(Color.BLACK); // assuming black text
    // g.setFont(new Font("Arial", Font.BOLD, 24));
    // FontMetrics fm = g.getFontMetrics();
    // int x = (width - fm.stringWidth(text)) / 2;
    // int y = ((height - fm.getHeight()) / 2) + fm.getAscent();
    // g.drawString(text, x, y);
    // g.dispose();
    // return image;
    // }

    // DO NOT DELETE
    // NOTE: This was the simple image version that we used before we switched to GIFs
    // private static final BasicStroke stroke = new BasicStroke(3.0f);
    // private static Font fontKnown = null;
    // public static byte[] makeCaptcha_simple(String captcha) {
    // /* set some parameters */
    // int len = captcha.length();
    // int imgWidth = len * CAPTCHA_CHAR_SIZE - CAPTCHA_CHAR_SIZE / 2;
    // int imgHeight = CAPTCHA_CHAR_SIZE * 2;

    // /* setup image to draw into */
    // BufferedImage outBufferedImage = new BufferedImage(imgWidth, imgHeight,
    // BufferedImage.TYPE_INT_RGB);
    // Graphics2D g = outBufferedImage.createGraphics();

    // g.setColor(Color.black);
    // g.fillRect(0, 0, imgWidth, imgHeight);
    // g.setColor(Color.green);

    // /*
    // due to wierdness on various comptuers the rendering size of any given font is not known and we
    // must iterate to find the appropriate font to match our image size
    ///
    // if (fontKnown != null) {
    // g.setFont(fontKnown);
    // } else {
    // int fontPoints = 12;

    // while (fontPoints < 50) {
    // g.setFont(fontKnown = new Font("Courier New", Font.BOLD, fontPoints));
    // if (g.getFontMetrics().getHeight() >= CAPTCHA_CHAR_SIZE) {
    // break;
    // }
    // fontPoints += 1;
    // }
    // }
    // FontMetrics fm = g.getFontMetrics();
    // Rectangle2D sb = fontKnown.getStringBounds(captcha, g.getFontRenderContext());
    // int charWidth = ((int) sb.getWidth()) / captcha.length();
    // int charHeight = fm.getHeight();

    // char[] chars = captcha.toCharArray();
    // int charBase = charHeight + charHeight / 3;
    // int advance = charWidth + charWidth / 2;
    // int x = charWidth;
    // g.setStroke(stroke);

    // /* now draw the captcha characters into the image */
    // for (int i = 0; i < len; i++, x += advance) {
    // g.drawChars(chars, i, 1, x, charBase);
    // }

    // ByteArrayOutputStream tmp = null;
    // try {
    // BufferedImage scaledImage = ImageUtil.scaleImage(outBufferedImage, imgWidth);
    // tmp = new ByteArrayOutputStream();
    // ImageIO.write(scaledImage, "png", tmp);
    // } catch (IOException e) {
    // throw ExUtil.wrapEx(e);
    // } finally {
    // StreamUtil.close(tmp);
    // }
    // return tmp.toByteArray();
    // }

    public static Object cm_getCaptcha() {
        String captcha = CaptchaMaker.createCaptchaString();
        TL.getHttpSession().setAttribute("captcha", captcha);
        try {
            return CaptchaMaker.makeCaptcha(captcha);
        } catch (IOException e) {
            throw ExUtil.wrapEx(e);
        }
    }
}
