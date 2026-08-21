(function () {
  var LIVE_API = 'https://bolkarigar.onrender.com';
  var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (isNative) {
    window.API_URL = LIVE_API;
    window.BK_LIVE_API = LIVE_API;
    document.documentElement.classList.add('capacitor-native');
  }
  window.bkGetApiUrl = function () {
    return window.API_URL || window.BK_LIVE_API || window.location.origin;
  };
})();
