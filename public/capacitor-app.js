/**
 * BolKarigar — Android/iOS native shell helpers (Capacitor).
 * Sirf app (APK) mein chalega; browser mein skip ho jata hai.
 */
(function () {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;

  document.documentElement.classList.add('capacitor-native');

  var plugins = window.Capacitor.Plugins || {};

  function hideSplash() {
    if (plugins.SplashScreen && plugins.SplashScreen.hide) {
      plugins.SplashScreen.hide().catch(function () {});
    }
  }

  function setupStatusBar() {
    if (!plugins.StatusBar) return;
    plugins.StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(function () {});
    plugins.StatusBar.setStyle({ style: 'DARK' }).catch(function () {});
  }

  function setupBackButton() {
    if (!plugins.App || !plugins.App.addListener) return;
    plugins.App.addListener('backButton', function (ev) {
      var canGoBack = ev && ev.canGoBack;
      if (canGoBack) {
        window.history.back();
        return;
      }
      if (plugins.App.minimizeApp) {
        plugins.App.minimizeApp();
      }
    });
  }

  function setupAppState() {
    if (!plugins.App || !plugins.App.addListener) return;
    plugins.App.addListener('appStateChange', function (state) {
      if (state && state.isActive && typeof window.bkRefreshOnResume === 'function') {
        window.bkRefreshOnResume();
      }
    });
  }

  setupStatusBar();
  setupBackButton();
  setupAppState();

  window.bkRefreshOnResume = function () {
    if (typeof window.BolKarigarLive?.loadDailySummary === 'function') {
      window.BolKarigarLive.loadDailySummary();
      window.BolKarigarLive.loadLowStockAlerts();
    }
    if (typeof window.BolKarigarLive?.updateTodayDateLabel === 'function') {
      window.BolKarigarLive.updateTodayDateLabel();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideSplash);
  } else {
    hideSplash();
  }
})();
