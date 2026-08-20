package io.github.ilyasturki.kilorep;

import android.os.Build;
import android.view.HapticFeedbackConstants;
import android.view.SoundEffectConstants;
import android.view.View;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The touch feedback a native Android control gives for free, handed to the WebView.
 *
 * Both calls go through the WebView itself rather than AudioManager or Vibrator,
 * because a View asks two questions before it obliges: whether the user left touch
 * sounds and touch vibration on in system settings, and whether this view has them
 * enabled. That is the point — a lifter who silenced their phone silences the app
 * with it, and no in-app toggle has to exist. @capacitor/haptics drives the Vibrator
 * directly and answers to neither, which is why taps do not go through it.
 *
 * The rest-timer alarm still does: it is a signal, not touch feedback, and it has to
 * arrive with touch vibration off.
 */
@CapacitorPlugin(name = "Feedback")
public class FeedbackPlugin extends Plugin {

    /** The sound every clickable View plays on ACTION_UP. */
    @PluginMethod
    public void click(PluginCall call) {
        final View view = view();

        if (view != null) {
            getActivity().runOnUiThread(() -> view.playSoundEffect(SoundEffectConstants.CLICK));
        }

        call.resolve();
    }

    @PluginMethod
    public void haptic(PluginCall call) {
        final View view = view();
        final int effect = effectFor(call.getString("kind"));

        if (view != null) {
            getActivity().runOnUiThread(() -> view.performHapticFeedback(effect));
        }

        call.resolve();
    }

    /**
     * `CONFIRM` is API 30; below that `VIRTUAL_KEY` is the closest thing the platform
     * has to "that landed", and it exists everywhere back to minSdk 24.
     */
    private int effectFor(String kind) {
        if ("hold".equals(kind)) {
            return HapticFeedbackConstants.LONG_PRESS;
        }

        if ("tick".equals(kind)) {
            return HapticFeedbackConstants.CLOCK_TICK;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return HapticFeedbackConstants.CONFIRM;
        }

        return HapticFeedbackConstants.VIRTUAL_KEY;
    }

    private View view() {
        return getBridge() == null ? null : getBridge().getWebView();
    }
}
