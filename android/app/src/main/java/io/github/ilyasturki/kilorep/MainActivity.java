package io.github.ilyasturki.kilorep;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Before `super`: the bridge reads the registry while it builds the WebView,
        // and a plugin registered after that is invisible to JS.
        registerPlugin(FeedbackPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
