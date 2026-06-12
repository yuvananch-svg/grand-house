function Auth_login(payload, deviceId) {
  Auth_assertDeviceNotBlocked(deviceId);
  var config = Config_get();
  var users = SheetDB_all("Users");
  var user = users.filter(function (row) { return row.user_id === payload.user_id && String(row.active).toUpperCase() !== "FALSE"; })[0];
  if (!user) {
    Audit_log(null, "LOGIN_FAILED", payload.user_id || "unknown", {}, false, "SUSPICIOUS", deviceId);
    throw makeError("INVALID_LOGIN", "Invalid login");
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    Audit_log(null, "LOGIN_LOCKED", user.user_id, { locked_until: user.locked_until }, false, "SUSPICIOUS", deviceId);
    throw makeError("LOCKED_OUT", "Too many failed attempts. Try again later.");
  }
  var actual = hashSecret(payload.password || "", user.salt || "", true);
  if (actual !== user.password_hash) {
    var failed = Auth_recordFailedLogin(user, config);
    Audit_log(null, "LOGIN_FAILED", payload.user_id || "unknown", { failed_attempts: failed.failed_attempts, locked_until: failed.locked_until }, false, "SUSPICIOUS", deviceId);
    if (failed.locked_until) throw makeError("LOCKED_OUT", "Too many failed attempts. Try again later.");
    throw makeError("INVALID_LOGIN", "Invalid login");
  }
  Auth_resetFailedLogin(user);
  var token = Utilities.getUuid() + Utilities.getUuid();
  var session = {
    token_hash: hashToken(token),
    user_id: user.user_id,
    role: user.role,
    branch_id: user.branch_id,
    device_id: deviceId,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revoked: false
  };
  SheetDB_insert("Sessions", session);
  registerDevice(deviceId, user.branch_id, user.display_name);
  Audit_log({ user_id: user.user_id, role: user.role, branch_id: user.branch_id }, "LOGIN", user.user_id, {}, true, "", deviceId);
  return { token: token, user_id: user.user_id, display_name: user.display_name, role: user.role, branch_id: user.branch_id, device_id: deviceId, expires_at: session.expires_at };
}

function Auth_verifyToken(token, deviceId) {
  if (!token) return null;
  var hash = hashToken(token);
  var session = SheetDB_all("Sessions").filter(function (row) {
    return row.token_hash === hash && String(row.revoked).toUpperCase() !== "TRUE" && new Date(row.expires_at) > new Date();
  })[0];
  if (!session) return null;
  Auth_assertDeviceNotBlocked(deviceId);
  var user = SheetDB_all("Users").filter(function (row) {
    return row.user_id === session.user_id && String(row.active).toUpperCase() !== "FALSE";
  })[0];
  if (!user) {
    SheetDB_update("Sessions", "token_hash", session.token_hash, { revoked: true });
    Audit_log({ user_id: session.user_id, role: session.role, branch_id: session.branch_id }, "INACTIVE_USER_TOKEN", "session", {}, false, "SUSPICIOUS", deviceId);
    return null;
  }
  return { user_id: session.user_id, role: session.role, branch_id: session.branch_id, device_id: deviceId };
}

function Auth_userManage(payload, session, deviceId) {
  if (session.role !== "owner") throw makeError("FORBIDDEN", "Owner only");
  if (payload.mode === "block_device" || payload.mode === "unblock_device") {
    SheetDB_update("Devices", "device_id", payload.device_id, { status: payload.mode === "block_device" ? "blocked" : "active" });
    Audit_log(session, "DEVICE_STATUS_CHANGE", payload.device_id, payload, true, "SUSPICIOUS", deviceId);
  }
  if (payload.mode === "set_config" && payload.config) {
    Object.keys(payload.config).forEach(function (key) {
      var existing = SheetDB_findById("Config", "key", key);
      if (existing) SheetDB_update("Config", "key", key, { value: payload.config[key] });
      else SheetDB_insert("Config", { key: key, value: payload.config[key] });
    });
    Audit_log(session, "CONFIG_CHANGE", "CONFIG", payload.config, true, "", deviceId);
  }
  if (payload.mode === "add_user" && payload.user && payload.user.user_id) {
    if (SheetDB_all("Users").filter(function (u) { return u.user_id === payload.user.user_id; }).length) {
      throw makeError("DUPLICATE_USER", "user_id already exists");
    }
    var salt = Utilities.getUuid();
    var u = payload.user;
    // password and approval PIN share the user's single salt column (see Inventory.gs PIN check)
    SheetDB_insert("Users", {
      id: newId("USR"),
      user_id: u.user_id,
      password_hash: hashSecret(u.password || "changeme", salt, true),
      salt: salt,
      display_name: u.display_name || u.user_id,
      role: u.role || "staff",
      branch_id: u.branch_id || "BR-KASET",
      active: true,
      approval_pin_hash: u.approval_pin ? hashSecret(u.approval_pin, salt, true) : "",
      failed_attempts: 0,
      locked_until: "",
      pin_failed_attempts: 0,
      pin_locked_until: ""
    });
    Audit_log(session, "USER_CREATE", u.user_id, { role: u.role, branch_id: u.branch_id }, true, "", deviceId);
  }
  if (payload.mode === "update_user" && payload.id) {
    var patch = {};
    if (payload.user) {
      if (payload.user.display_name !== undefined) patch.display_name = payload.user.display_name;
      if (payload.user.role) patch.role = payload.user.role;
      if (payload.user.branch_id) patch.branch_id = payload.user.branch_id;
      if (typeof payload.user.active === "boolean") patch.active = payload.user.active;
    }
    SheetDB_update("Users", "id", payload.id, patch);
    if (patch.active === false) Auth_revokeSessionsForUserId(payload.id);
    Audit_log(session, "USER_UPDATE", payload.id, patch, true, "", deviceId);
  }
  if (payload.mode === "reset_password" && payload.id && payload.password) {
    // keep the existing salt so the user's approval PIN hash stays valid
    var ru = SheetDB_findById("Users", "id", payload.id);
    if (!ru) throw makeError("NOT_FOUND", payload.id);
    SheetDB_update("Users", "id", payload.id, { password_hash: hashSecret(payload.password, ru.salt || "", true), failed_attempts: 0, locked_until: "" });
    Audit_log(session, "USER_RESET_PASSWORD", payload.id, {}, true, "SUSPICIOUS", deviceId);
  }
  if (payload.mode === "set_pin" && payload.id && payload.approval_pin) {
    var pu = SheetDB_findById("Users", "id", payload.id);
    if (!pu) throw makeError("NOT_FOUND", payload.id);
    SheetDB_update("Users", "id", payload.id, { approval_pin_hash: hashSecret(payload.approval_pin, pu.salt || "", true), pin_failed_attempts: 0, pin_locked_until: "" });
    Audit_log(session, "USER_SET_PIN", payload.id, {}, true, "SUSPICIOUS", deviceId);
  }
  if (payload.mode === "force_logout" && payload.id) {
    var target = SheetDB_findById("Users", "id", payload.id);
    if (target) {
      Auth_revokeSessionsForUserId(payload.id);
      Audit_log(session, "USER_FORCE_LOGOUT", payload.id, { user_id: target.user_id }, true, "SUSPICIOUS", deviceId);
    }
  }
  return { ok: true };
}

function Auth_revokeSessionsForUserId(userId) {
  var target = SheetDB_findById("Users", "id", userId);
  if (!target) return;
  SheetDB_all("Sessions").filter(function (s) { return s.user_id === target.user_id && String(s.revoked).toUpperCase() !== "TRUE"; })
    .forEach(function (s) { SheetDB_update("Sessions", "token_hash", s.token_hash, { revoked: true }); });
}

function registerDevice(deviceId, branchId, label) {
  var existing = SheetDB_findById("Devices", "device_id", deviceId);
  if (existing) {
    SheetDB_update("Devices", "device_id", deviceId, { last_seen: nowIso() });
    return;
  }
  SheetDB_insert("Devices", { device_id: deviceId, label: label || deviceId, branch_id: branchId, first_seen: nowIso(), last_seen: nowIso(), status: "active" });
}

function Auth_enforceRateLimit(deviceId, token) {
  var config = Config_get();
  Auth_rateLimitKey("GLOBAL", Number(config.global_rate_limit_per_min || 600));
  Auth_rateLimitKey("login:" + String(deviceId || "UNKNOWN").slice(0, 80), Number(config.rate_limit_per_min || 60));
  Auth_rateLimitKey("principal:" + String(deviceId || token || "UNKNOWN").slice(0, 80), Number(config.rate_limit_per_min || 60));
}

function Auth_rateLimitKey(principal, limit) {
  if (!limit || limit <= 0) return;
  var cache = CacheService.getScriptCache();
  var key = "rate:" + principal + ":" + Math.floor(Date.now() / 60000);
  var count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), 70);
  if (count > limit) throw makeError("RATE_LIMITED", "Too many requests");
}

function Auth_assertDeviceNotBlocked(deviceId) {
  if (!deviceId) return;
  var device = SheetDB_findById("Devices", "device_id", deviceId);
  if (device && device.status === "blocked") throw makeError("DEVICE_BLOCKED", "Device blocked");
}

function Auth_recordFailedLogin(user, config) {
  var attempts = Number(user.failed_attempts || 0) + 1;
  var maxAttempts = Number(config.login_lockout_attempts || 5);
  var lockoutMinutes = Number(config.lockout_minutes || 15);
  var lockedUntil = "";
  if (attempts >= maxAttempts) {
    lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000).toISOString();
  }
  SheetDB_update("Users", "user_id", user.user_id, { failed_attempts: attempts, locked_until: lockedUntil });
  return { failed_attempts: attempts, locked_until: lockedUntil };
}

function Auth_resetFailedLogin(user) {
  if (Number(user.failed_attempts || 0) || user.locked_until) {
    SheetDB_update("Users", "user_id", user.user_id, { failed_attempts: 0, locked_until: "" });
  }
}

function hashToken(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token).map(function (b) {
    return ("0" + (b & 0xff).toString(16)).slice(-2);
  }).join("");
}

function hashSecret(secret, salt, usePepper) {
  var pepper = usePepper ? (PropertiesService.getScriptProperties().getProperty("PEPPER") || "") : "";
  var value = secret + salt + pepper;
  for (var i = 0; i < 10000; i++) {
    value = hashToken(value);
  }
  return value;
}
