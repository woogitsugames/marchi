package be.communica.marchia;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Required by androidx.core:core-splashscreen; install before super.onCreate.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
