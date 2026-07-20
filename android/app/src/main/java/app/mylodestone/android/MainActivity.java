package app.mylodestone.android;

import android.os.Bundle;
import com.capacitorjs.plugins.app.AppPlugin;
import com.capacitorjs.plugins.filesystem.FilesystemPlugin;
import com.capacitorjs.plugins.share.SharePlugin;
import com.capacitorjs.plugins.statusbar.StatusBarPlugin;
import com.getcapacitor.BridgeActivity;
import com.revenuecat.purchases.capacitor.PurchasesPlugin;
import com.revenuecat.purchases.capacitor.ui.RevenueCatUIPlugin;

// Explicit registration — Capacitor's usual build-time auto-discovery of
// plugins isn't taking effect in this project for reasons not yet root-
// caused (both AppPlugin and StatusBarPlugin's classes are confirmed
// present in the compiled APK's dex, but calling either from JS threw
// "plugin is not implemented on android" at runtime). registerPlugin()
// is Capacitor's own documented manual-registration API and sidesteps
// whatever's wrong with auto-discovery entirely.
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(AppPlugin.class);
    registerPlugin(StatusBarPlugin.class);
    registerPlugin(PurchasesPlugin.class);
    registerPlugin(RevenueCatUIPlugin.class);
    registerPlugin(FilesystemPlugin.class);
    registerPlugin(SharePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
