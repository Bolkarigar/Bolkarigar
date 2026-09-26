(function () {
  var LIVE_API = 'https://app.accountsorbit.com';
  var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (isNative) {
    window.API_URL = LIVE_API;
    window.BK_LIVE_API = LIVE_API;
    document.documentElement.classList.add('capacitor-native');
  }
  window.bkGetApiUrl = function () {
    return window.API_URL || window.BK_LIVE_API || window.location.origin;
  };

  var KEEP_LOCAL = {
    bk_app_build: 1,
    bk_ui_lang: 1,
    bk_voice_lang: 1,
    bk_help_lang: 1,
    bk_voice_auto: 1,
    ao_phone_ui: 1
  };

  window.bkClearAccountLocalData = function () {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach(function (k) {
        if (!k || KEEP_LOCAL[k]) return;
        if (k.indexOf('bk_build_reloaded_') === 0) return;
        if (
          k === 'bk_token' ||
          k === 'token' ||
          k === 'bk_user' ||
          k === 'company_profile' ||
          k === 'business_profile' ||
          k.indexOf('bolkarigar_') === 0 ||
          k.indexOf('bk_') === 0
        ) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) { /* ignore */ }
  };

  window.bkBeginAccountSession = function (username) {
    var next = String(username || '').trim();
    var prev = '';
    try { prev = String(localStorage.getItem('bk_user') || '').trim(); } catch (e) { /* ignore */ }
    if (!next || !prev || prev.toLowerCase() !== next.toLowerCase()) {
      window.bkClearAccountLocalData();
    }
  };
})();
