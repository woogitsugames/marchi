package be.communica.marchia;

import android.graphics.Rect;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.util.Consumer;
import androidx.window.java.layout.WindowInfoTrackerCallbackAdapter;
import androidx.window.layout.DisplayFeature;
import androidx.window.layout.FoldingFeature;
import androidx.window.layout.WindowInfoTracker;
import androidx.window.layout.WindowLayoutInfo;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

/**
 * Capacitor activity plus a foldable fallback (D-16): Android WebView does not always expose the
 * Viewport Segments API, so the hinge reported by androidx.window (FoldingFeature) is forwarded
 * to the page as window.__marchiaFold and a 'marchia:fold' CustomEvent, in CSS px relative to
 * the WebView. The page decides the layout (src/ui/layout.ts). Everything here is best effort:
 * if androidx.window or the device's window extensions are missing, the game simply runs flat.
 *
 * System back (D-522): Capacitor's BridgeActivity has no back handling of its own (that lives in the
 * @capacitor/app plugin, not used here), so back always left the game — also with a card or the pause
 * menu open. It is offered to the page first (window.__marchiaBack: close the top sheet, put a tool
 * away, open the pause menu); only when the page does not take it does Android's default run.
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "MarchiaFold";

    private WindowInfoTrackerCallbackAdapter foldTracker;
    private Consumer<WindowLayoutInfo> foldListener;
    /** Last payload sent, re-sent after page loads (a reload would otherwise forget it). */
    private String lastFoldJson = "null";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Required by androidx.core:core-splashscreen; install before super.onCreate.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                offerBackToPage(this);
            }
        });
    }

    /** The page answers "true" when it used the back (src/ui/app.ts systemBack); otherwise Android's default. */
    private void offerBackToPage(OnBackPressedCallback self) {
        WebView wv = webView();
        if (wv == null) {
            defaultBack(self);
            return;
        }
        try {
            wv.evaluateJavascript(
                "(function(){try{return !!(window.__marchiaBack&&window.__marchiaBack());}catch(e){return false;}})()",
                (res) -> { if (!"true".equals(res)) defaultBack(self); });
        } catch (Throwable t) {
            Log.i(TAG, "back dispatch failed: " + t);
            defaultBack(self);
        }
    }

    private void defaultBack(OnBackPressedCallback self) {
        self.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        self.setEnabled(true);
    }

    @Override
    public void onStart() {
        super.onStart();
        startFoldTracking();
    }

    @Override
    public void onStop() {
        stopFoldTracking();
        super.onStop();
    }

    @Override
    public void onResume() {
        super.onResume();
        // the page may have (re)loaded while we were away: repeat the last known state
        scheduleResend();
    }

    private void startFoldTracking() {
        if (foldListener != null) return;
        try {
            foldTracker = new WindowInfoTrackerCallbackAdapter(WindowInfoTracker.getOrCreate(this));
            foldListener = this::onLayoutInfo;
            foldTracker.addWindowLayoutInfoListener(this, ContextCompat.getMainExecutor(this), foldListener);
        } catch (Throwable t) {
            // NoClassDefFoundError / UnsupportedOperationException on devices without window extensions
            Log.i(TAG, "fold tracking unavailable: " + t);
            foldTracker = null;
            foldListener = null;
        }
    }

    private void stopFoldTracking() {
        try {
            if (foldTracker != null && foldListener != null) foldTracker.removeWindowLayoutInfoListener(foldListener);
        } catch (Throwable t) {
            Log.i(TAG, "fold tracking stop failed: " + t);
        }
        foldListener = null;
        foldTracker = null;
    }

    private void onLayoutInfo(WindowLayoutInfo info) {
        String json = "null";
        try {
            for (DisplayFeature f : info.getDisplayFeatures()) {
                if (!(f instanceof FoldingFeature)) continue;
                json = foldJson((FoldingFeature) f);
                break;
            }
        } catch (Throwable t) {
            Log.i(TAG, "fold info failed: " + t);
        }
        lastFoldJson = json;
        sendFold(json);
        scheduleResend();
    }

    /** Hinge bounds (window px) -> CSS px relative to the WebView's top-left. */
    private String foldJson(FoldingFeature f) {
        WebView wv = webView();
        float density = getResources().getDisplayMetrics().density;
        int[] loc = new int[] { 0, 0 };
        if (wv != null) {
            wv.getLocationInWindow(loc);
            // WebView zoom is locked (user-scalable=no), but respect a non-default scale if any
            float scale = wv.getScale();
            if (scale > 0) density = scale;
        }
        Rect b = f.getBounds();
        String state = f.getState() == FoldingFeature.State.HALF_OPENED ? "HALF_OPENED" : "FLAT";
        String orient = f.getOrientation() == FoldingFeature.Orientation.HORIZONTAL ? "HORIZONTAL" : "VERTICAL";
        return String.format(Locale.ROOT,
            "{\"state\":\"%s\",\"orientation\":\"%s\",\"separating\":%b,\"occluding\":%b,\"x\":%.1f,\"y\":%.1f,\"w\":%.1f,\"h\":%.1f}",
            state, orient, f.isSeparating(), f.getOcclusionType() == FoldingFeature.OcclusionType.FULL,
            (b.left - loc[0]) / density, (b.top - loc[1]) / density, b.width() / density, b.height() / density);
    }

    private WebView webView() {
        try {
            return getBridge() != null ? getBridge().getWebView() : null;
        } catch (Throwable t) {
            return null;
        }
    }

    private void sendFold(String json) {
        WebView wv = webView();
        if (wv == null) return;
        String js = "(function(){try{window.__marchiaFold=" + json +
            ";window.dispatchEvent(new CustomEvent('marchia:fold',{detail:window.__marchiaFold}));}catch(e){}})();";
        wv.post(() -> {
            try {
                wv.evaluateJavascript(js, null);
            } catch (Throwable t) {
                Log.i(TAG, "fold dispatch failed: " + t);
            }
        });
    }

    /** The first layout info usually arrives before the page has loaded: repeat it a few times. */
    private void scheduleResend() {
        WebView wv = webView();
        if (wv == null) return;
        for (long delay : new long[] { 600, 2000, 5000 }) {
            wv.postDelayed(() -> sendFold(lastFoldJson), delay);
        }
    }
}
