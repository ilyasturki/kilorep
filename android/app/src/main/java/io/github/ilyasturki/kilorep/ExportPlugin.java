package io.github.ilyasturki.kilorep;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

/** The WebView cannot download a Blob, so an export is written to the cache and shared from there. */
@CapacitorPlugin(name = "Export")
public class ExportPlugin extends Plugin {

    @PluginMethod
    public void share(PluginCall call) {
        JSArray files = call.getArray("files");

        if (files == null || files.length() == 0) {
            call.reject("nothing to share");
            return;
        }

        File dir = new File(getContext().getCacheDir(), "exports");
        ArrayList<Uri> uris = new ArrayList<>();
        String mime = null;

        try {
            clear(dir);

            for (int i = 0; i < files.length(); i++) {
                JSONObject file = files.getJSONObject(i);
                File out = new File(dir, new File(file.getString("name")).getName());

                try (OutputStream stream = new FileOutputStream(out)) {
                    stream.write(file.getString("text").getBytes(StandardCharsets.UTF_8));
                }

                uris.add(FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", out));

                String type = file.getString("mime");
                mime = mime == null || mime.equals(type) ? type : "*/*";
            }
        } catch (JSONException | IOException | IllegalArgumentException e) {
            call.reject("could not write the export", e);
            return;
        }

        Intent send;

        if (uris.size() == 1) {
            send = new Intent(Intent.ACTION_SEND);
            send.putExtra(Intent.EXTRA_STREAM, uris.get(0));
        } else {
            send = new Intent(Intent.ACTION_SEND_MULTIPLE);
            send.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
        }

        ClipData clip = ClipData.newRawUri(null, uris.get(0));

        for (int i = 1; i < uris.size(); i++) {
            clip.addItem(new ClipData.Item(uris.get(i)));
        }

        send.setType(mime);
        send.setClipData(clip);
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        getActivity().runOnUiThread(() -> getActivity().startActivity(Intent.createChooser(send, null)));

        call.resolve();
    }

    private void clear(File dir) throws IOException {
        if (!dir.isDirectory() && !dir.mkdirs()) {
            throw new IOException("no cache directory");
        }

        File[] old = dir.listFiles();

        if (old != null) {
            for (File file : old) {
                file.delete();
            }
        }
    }
}
